"use server";

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function getLiquidacionComisionesAction(startDateStr: string, endDateStr: string, decommStartDateStr: string, decommEndDateStr: string, channelId: string = 'todos', mode: 'upfront' | 'carterizada' = 'upfront', customCutoffDateStr?: string) {
  // FETCH ALL COMMISSION RULES IN MEMORY
  const allRules = await prisma.commissionRule.findMany();

  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const cookieStore = await cookies();
    const brandId = cookieStore.get('active-brand')?.value || (session.user as any).brandId;
    if (!brandId) {
      return { success: false, error: 'Marca no seleccionada' };
    }

    const whereClause: any = {
      brandId,
      status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] },
      activationDate: { not: null }
    };

    if (channelId && channelId !== 'todos') {
      const userIdsInChannel = await prisma.user.findMany({
        where: { channelId, assignedBrands: { some: { id: brandId } } },
        select: { id: true }
      }).then(users => users.map(u => u.id));

      whereClause.userId = { in: userIdsInChannel };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        commissionFinal: true,
        activationDate: true,
        terminationDate: true,
        p1c: true, p2c: true, p3c: true, p4c: true, p5c: true, p6c: true,
        contractCode: true,
        version: true,
        annualConsumption: true,
        tramitationType: true,
        airtableData: true,
        additionalServicesSnapshot: true,
        client: { select: { businessName: true } },
        supplyPoint: { select: { cups: true, tariff: true, annualConsumption: true } },
        product: {
          select: {
            name: true, type: true, tariff: true,
            ip1: true, ip2: true, ip3: true, ip4: true, ip5: true, ip6: true,
            marginFC: true
          }
        },
        user: {
          select: {
            channel: { select: { commissionTierId: true } }
          }
        }
      }
    });

    const isM1orE1 = (type: string | null, airtableData?: any) => {
      const t1 = type?.toLowerCase() || '';
      const t2 = (airtableData && typeof airtableData === 'object' && airtableData['Tipo']) ? String(airtableData['Tipo']).toLowerCase() : '';
      const check = (t: string) => t === 'm1' || t === 'e1' || t.includes('modificación') || t.includes('error') || t.includes('renovación');
      return check(t1) || check(t2) || true; // Let's just rely on version > 0 and baseCode to be safe.
    };

    const getTarifa = (c: any) => {
      if (c.supplyPoint?.tariff) return c.supplyPoint.tariff;
      if (c.airtableData && typeof c.airtableData === 'object') {
        return c.airtableData['Tarifa'] || c.airtableData['Tarifa (from Producto)'] || '-';
      }
      return '-';
    };

    const getConsumo = (c: any) => {
      if (c.annualConsumption !== null && c.annualConsumption !== undefined) return c.annualConsumption;
      if (c.supplyPoint?.annualConsumption) return c.supplyPoint.annualConsumption;
      if (c.airtableData && typeof c.airtableData === 'object') {
        const ad = c.airtableData;
        if (ad['CONSUMO COMISION'] !== undefined) return Number(ad['CONSUMO COMISION']) || 0;
        if (ad['CONSUMO ANUAL'] !== undefined) return Number(ad['CONSUMO ANUAL']) || 0;
      }
      return 0;
    };

    const getP1c = (c: any) => {
      if (c.p1c !== null && c.p1c !== undefined) return c.p1c;
      if (c.supplyPoint?.p1c !== null && c.supplyPoint?.p1c !== undefined) return c.supplyPoint.p1c;
      if (c.airtableData && typeof c.airtableData === 'object') {
        if (c.airtableData['P1'] !== undefined) return Number(c.airtableData['P1']) || 0;
      }
      return 0;
    };

    const getPotencias = (c: any) => {
      const getPx = (c: any, field: string, airtableField: string) => {
        if (c[field] !== null && c[field] !== undefined) return c[field];
        if (c.supplyPoint?.[field] !== null && c.supplyPoint?.[field] !== undefined) return c.supplyPoint[field];
        if (c.airtableData && typeof c.airtableData === 'object' && c.airtableData[airtableField] !== undefined) {
          return Number(c.airtableData[airtableField]) || 0;
        }
        return 0;
      };
      return [
        getPx(c, 'p1c', 'P1'),
        getPx(c, 'p2c', 'P2'),
        getPx(c, 'p3c', 'P3'),
        getPx(c, 'p4c', 'P4'),
        getPx(c, 'p5c', 'P5'),
        getPx(c, 'p6c', 'P6')
      ];
    };

    const actStart = new Date(startDateStr);
    const actEnd = new Date(endDateStr);
    actEnd.setUTCHours(23, 59, 59, 999);

    const termStart = new Date(decommStartDateStr);
    const termEnd = new Date(decommEndDateStr);
    termEnd.setUTCHours(23, 59, 59, 999);

    // Group by baseCode to find the true lifecycle of the commission
    const chains = new Map<string, any[]>();
    for (const c of contracts) {
      if (!c.contractCode) continue;
      const baseCode = c.contractCode.split('-V')[0];
      if (!chains.has(baseCode)) chains.set(baseCode, []);
      chains.get(baseCode)!.push(c);
    }

    let totalLiquidacion = 0; // Total Neto (Upfront) o Devengado (Carterizada)
    const commissions = []; // Activaciones Upfront
    const decommissions = []; // Bajas Upfront
    const carterizadas = []; // Devengos mensuales

    // Also fetch all V0s if they are not in the current filter (e.g., they were in another channel or already BAJA)
    const missingBaseCodes = Array.from(chains.keys()).filter(bc => !chains.get(bc)!.find(c => c.version === 0));
    if (missingBaseCodes.length > 0) {
      const v0s = await prisma.contract.findMany({
        where: {
          contractCode: { in: missingBaseCodes },
          version: 0,
          activationDate: { not: null }
        },
        select: {
          id: true, commissionFinal: true, activationDate: true, terminationDate: true,
          contractCode: true, version: true, tramitationType: true, airtableData: true,
          p1c: true, p2c: true, p3c: true, p4c: true, p5c: true, p6c: true,
          annualConsumption: true, additionalServicesSnapshot: true, permanenceMonths: true,
          client: { select: { businessName: true } },
          supplyPoint: { select: { cups: true, tariff: true, annualConsumption: true } },
          product: {
            select: {
              name: true, type: true, tariff: true,
              ip1: true, ip2: true, ip3: true, ip4: true, ip5: true, ip6: true,
              marginFC: true
            }
          },
          user: {
            select: {
              channel: { select: { commissionTierId: true } }
            }
          }
        }
      });
      for (const v0 of v0s) {
        if (v0.contractCode) {
          chains.get(v0.contractCode)!.push(v0);
        }
      }
    }

    for (const [baseCode, chainContracts] of chains.entries()) {
      // Sort by version asc
      chainContracts.sort((a, b) => a.version - b.version);
      
      const v0 = chainContracts[0];
      if (!v0 || !v0.activationDate) continue;

      const actDate = v0.activationDate;
      let commission = v0.commissionFinal || 0;

      const dailyCommission = commission / 365;

      // Find if the chain is terminated
      // A chain is terminated if the LATEST version has a terminationDate
      const latest = chainContracts[chainContracts.length - 1];
      const termDate = latest.terminationDate;

      const getProductoLabel = (c: any) => {
        const base = c.product?.name || '-';
        if (c.additionalServicesSnapshot && Array.isArray(c.additionalServicesSnapshot) && c.additionalServicesSnapshot.length > 0) {
          const services = c.additionalServicesSnapshot.map((s: any) => s.name).join(' + ');
          return `${base} + ${services}`;
        }
        return base;
      };

      // Check for quick drop rule:
      // If a contract activates in month X and drops before the 11th of month X+1, ignore it completely.
      let skipDueToQuickDrop = false;
      if (termDate && actDate) {
        // Parse the custom cutoff date if provided and we are evaluating a contract activated THIS month
        const customCutoffDate = customCutoffDateStr ? new Date(customCutoffDateStr) : null;
        
        if (actDate >= actStart && actDate <= actEnd && customCutoffDate) {
          if (termDate < customCutoffDate) {
            skipDueToQuickDrop = true;
          }
        } else {
          // Standard logic for contracts activated in previous months
          const activationYear = actDate.getUTCFullYear();
          const activationMonth = actDate.getUTCMonth(); 
          const defaultCutoffDate = new Date(Date.UTC(activationYear, activationMonth + 1, 11, 0, 0, 0));
          if (termDate < defaultCutoffDate) {
            skipDueToQuickDrop = true;
          }
        }
      }

      if (skipDueToQuickDrop) continue;

      if (mode === 'upfront') {
        // 1. Commission (Activation)
        if (actDate >= actStart && actDate <= actEnd) {
          commissions.push({
            id: v0.id,
            titular: v0.client?.businessName || '-',
            codigoContrato: v0.contractCode || '-',
            fechaAltaV0: v0.activationDate,
            producto: getProductoLabel(v0),
            cups: v0.supplyPoint?.cups || '-',
            tarifa: getTarifa(v0),
            consumoAnual: getConsumo(v0),
            p1c: getP1c(v0),
            potencias: getPotencias(v0),
            comisionOriginal: commission,
            diasComputados: 365,
            importeLiquidado: commission,
            tipo: 'COMISION'
          });
          totalLiquidacion += commission;
        }

        // 2. Decommission (Early Termination)
        if (termDate && termDate >= termStart && termDate <= termEnd) {
          const daysActive = Math.max(0, Math.round((termDate.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24)));
          const tarifa = getTarifa(latest);
          
          if (tarifa === '2.0TD') {
            if (daysActive < 365) {
              const daysToReturn = 365 - daysActive;
              const decommissionAmount = daysToReturn * dailyCommission;
              
              // Only apply decommission if the amount to return is at least 1 euro
              if (decommissionAmount >= 1) {
                  decommissions.push({
                    titular: latest.client?.businessName || '-',
                    codigoContrato: latest.contractCode || '-',
                    fechaAltaV0: v0.activationDate,
                    fechaBajaVFinal: latest.terminationDate,
                producto: getProductoLabel(latest),
                cups: latest.supplyPoint?.cups || '-',
                tarifa: tarifa,
                consumoAnual: getConsumo(latest),
                p1c: getP1c(latest),
                potencias: getPotencias(latest),
                comisionOriginal: commission,
                diasComputados: daysToReturn,
                importeLiquidado: decommissionAmount,
                tipo: 'DECOMISION',
                diasActivos: daysActive
              });
              totalLiquidacion -= decommissionAmount;
              }
            }
          } else {
            // Resto Tarifas True-Up
            const tierId = v0.user?.channel?.commissionTierId;
            if (tierId) {
              const tierRules = await prisma.commissionRule.findMany({
                 where: { tierId },
                 include: { 
                   products: { select: { id: true } },
                   additionalServices: { select: { id: true } }
                 }
              });

              let matchedRule = null;
              let bestSpecificity = -1;
              const avgPower = ((v0.p1c || 0) + (v0.p2c || 0)) / 2;
              const p = latest.product;

              if (p) {
                for (const rule of tierRules) {
                   let specificity = 0;
                   let match = true;

                   if (rule.additionalServices.length > 0 && rule.products.length === 0 && !rule.tariff && !rule.productType) continue;

                   if (rule.tariff) {
                     if (rule.tariff !== tarifa) match = false;
                     else specificity += 1;
                   }
                   if (rule.productType) {
                     const rType = rule.productType;
                     const pTypeStr = (p.type || '').toLowerCase();
                     if (rType === 'Fijo') {
                       if (!pTypeStr.includes('fijo')) match = false;
                       else specificity += 1;
                     } else if (rType === 'Indexado' || rType === 'Index') {
                       if (!pTypeStr.includes('indexado')) match = false;
                       else specificity += 1;
                     } else {
                       if (rType !== p.type) match = false;
                       else specificity += 2;
                     }
                   }
                   if (rule.powerMin !== null) {
                     if (avgPower < rule.powerMin) match = false;
                     else specificity += 1;
                   }
                   if (rule.powerMax !== null) {
                     if (avgPower >= rule.powerMax) match = false;
                     else specificity += 1;
                   }
                   if (rule.products && rule.products.length > 0) {
                     if (!rule.products.some(rp => rp.id === p.id)) match = false;
                     else specificity += 100;
                   }

                   if (match && specificity > bestSpecificity) {
                     matchedRule = rule;
                     bestSpecificity = specificity;
                   }
                }
              }

              if (matchedRule) {
                 const chainIds = chainContracts.map(c => c.id);
                 const invoices = await prisma.invoice.findMany({
                    where: { contractId: { in: chainIds } },
                    select: { totalMWh: true, billingStart: true, billingEnd: true, invoiceType: true }
                 });

                 let totalMWh = 0;
                 let totalBillingDays = 0;
                 for (const inv of invoices) {
                    if (inv.billingStart && inv.billingEnd) {
                       const days = Math.round((inv.billingEnd.getTime() - inv.billingStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                       if (days > 0) {
                          const isAbono = inv.invoiceType?.toLowerCase().includes('abono');
                          
                          totalBillingDays += isAbono ? -days : days;
                          
                          // Invert sign if it's an abono, as providers send absolute values
                          const mwh = isAbono ? -Math.abs(inv.totalMWh) : inv.totalMWh;
                          // totalMWh is actually stored in kWh in the DB, so we divide by 1000 to get true MWh
                          totalMWh += (mwh / 1000);
                       }
                    }
                 }

                 let dailyMWh = 0;
                 if (totalBillingDays > 0) {
                    dailyMWh = totalMWh / totalBillingDays;
                 } else {
                    dailyMWh = getConsumo(latest) / 365;
                 }

                 const billableDays = daysActive;
                 const extrapolatedConsumo = dailyMWh * billableDays;
                 const energyMargin = extrapolatedConsumo * (p?.marginFC || 0);

                 let powerMargin = 0;
                 const startLife = actDate.getTime();
                 const endOfBillable = startLife + billableDays * 24 * 60 * 60 * 1000;

                 for (const cVersion of chainContracts) {
                    const startV = cVersion.activationDate ? cVersion.activationDate.getTime() : startLife;
                    let endV = cVersion.terminationDate ? cVersion.terminationDate.getTime() : endOfBillable;
                    endV = Math.min(endV, endOfBillable);
                    
                    if (endV > startV) {
                       const daysV = (endV - startV) / (1000 * 60 * 60 * 24);
                       const marginV = (cVersion.p1c || 0) * (p?.ip1 || 0) +
                                       (cVersion.p2c || 0) * (p?.ip2 || 0) +
                                       (cVersion.p3c || 0) * (p?.ip3 || 0) +
                                       (cVersion.p4c || 0) * (p?.ip4 || 0) +
                                       (cVersion.p5c || 0) * (p?.ip5 || 0) +
                                       (cVersion.p6c || 0) * (p?.ip6 || 0);
                       powerMargin += marginV * (daysV / 365);
                    }
                 }

                 let comisionReal = 0;
                 let comisionMargenEnergia = 0;
                 let comisionMargenPotencia = 0;
                 if (matchedRule.commissionType === 'FIXED') {
                     comisionReal = matchedRule.value * (billableDays / 365);
                     comisionMargenEnergia = comisionReal;
                 } else if (matchedRule.commissionType === 'PERCENTAGE') {
                     comisionMargenEnergia = energyMargin * (matchedRule.value / 100);
                     comisionMargenPotencia = powerMargin * (matchedRule.value / 100);
                     comisionReal = comisionMargenEnergia + comisionMargenPotencia;
                 }

                 let serviceCommission = 0;
                 if (v0.additionalServicesSnapshot && Array.isArray(v0.additionalServicesSnapshot)) {
                     const permanenceMonths = v0.permanenceMonths || 12;
                     const permanenceDays = permanenceMonths * (365 / 12);
                     v0.additionalServicesSnapshot.forEach((s: any) => {
                         if (s.isCommissionable) {
                             const serviceRule = tierRules.find(r => r.additionalServices.some(as => as.id === s.id));
                             if (serviceRule) {
                                 if (serviceRule.commissionType === 'FIXED') {
                                     serviceCommission += serviceRule.value * (billableDays / permanenceDays);
                                 } else if (serviceRule.commissionType === 'PERCENTAGE' && s.monthlyPrice) {
                                     const trueUpServiceMargin = s.monthlyPrice * (billableDays / (365 / 12));
                                     serviceCommission += trueUpServiceMargin * (serviceRule.value / 100);
                                 }
                             }
                         }
                     });
                 }

                 comisionReal += serviceCommission;

                 const diferencia = comisionReal - commission;

                 decommissions.push({
                     titular: latest.client?.businessName || '-',
                     codigoContrato: latest.contractCode || '-',
                     fechaAltaV0: v0.activationDate,
                     fechaBajaVFinal: latest.terminationDate,
                     producto: getProductoLabel(latest),
                     cups: latest.supplyPoint?.cups || '-',
                     tarifa: tarifa,
                     consumoAnual: getConsumo(latest),
                     p1c: getP1c(latest),
                     potencias: getPotencias(latest),
                     comisionOriginal: commission,
                     diasComputados: billableDays,
                     diasActivos: daysActive,
                     comisionReal: comisionReal,
                     comisionMargenEnergia: comisionMargenEnergia,
                     comisionMargenPotencia: comisionMargenPotencia,
                     energiaConsiderada: extrapolatedConsumo,
                     comisionResto: serviceCommission,
                     importeLiquidado: diferencia,
                     tipo: 'DECOMISION_RESTO'
                 });
                 totalLiquidacion += diferencia;
              }
            }
          }
        }
      } else {
        // Modo Carterizada
        const commissionEndDate = new Date(actDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        const actualEndDate = termDate && termDate < commissionEndDate ? termDate : commissionEndDate;

        const periodStart = actDate > actStart ? actDate : actStart;
        const periodEnd = actualEndDate < actEnd ? actualEndDate : actEnd;

        if (periodStart <= periodEnd) {
          const diffTime = periodEnd.getTime() - periodStart.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const liquidacionAmount = dailyCommission * diffDays;

          if (liquidacionAmount >= 0) {
             carterizadas.push({
                id: latest.id,
                titular: latest.client?.businessName || '-',
                codigoContrato: latest.contractCode || '-',
                producto: getProductoLabel(latest),
                cups: latest.supplyPoint?.cups || '-',
                tarifa: getTarifa(latest),
                consumoAnual: getConsumo(latest),
                p1c: getP1c(latest),
                potencias: getPotencias(latest),
                comisionOriginal: commission,
                diasComputados: diffDays,
                importeLiquidado: liquidacionAmount
             });
             totalLiquidacion += liquidacionAmount;
          }
        }
      }
    }

    const sortFn = (a: any, b: any) => {
      const tarifaCompare = (a.tarifa || '').localeCompare(b.tarifa || '');
      if (tarifaCompare !== 0) return tarifaCompare;
      
      const productoCompare = (a.producto || '').localeCompare(b.producto || '');
      if (productoCompare !== 0) return productoCompare;
      
      const p1cA = a.p1c || 0;
      const p1cB = b.p1c || 0;
      return p1cA - p1cB;
    };

    commissions.sort(sortFn);
    decommissions.sort(sortFn);
    carterizadas.sort(sortFn);

    return { 
      success: true, 
      data: {
        totalLiquidacion,
        commissions,
        decommissions,
        carterizadas
      }
    };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

export async function recalculateCommissionAction(contractId: string) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    const c = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        product: true,
        supplyPoint: true,
        user: { include: { channel: true } }
      }
    });

    if (!c || !c.product || !c.user?.channel?.commissionTierId) {
      return { success: false, error: 'El contrato no tiene producto o el canal no tiene un nivel de comisión asignado.' };
    }

    const tierId = c.user.channel.commissionTierId;
    const p = c.product;
    const tierRules = await prisma.commissionRule.findMany({
      where: { tierId },
      include: { 
        products: { select: { id: true } },
        additionalServices: { select: { id: true } }
      }
    });

    let matchedRule = null;
    let bestSpecificity = -1;

    const p1c = c.p1c || 0;
    const p2c = c.p2c || 0;
    const avgPower = (p1c + p2c) / 2;

    const getTarifa = (c: any) => {
      if (c.supplyPoint?.tariff) return c.supplyPoint.tariff;
      if (c.airtableData && typeof c.airtableData === 'object') {
        return c.airtableData['Tarifa'] || c.airtableData['Tarifa (from Producto)'] || '-';
      }
      return '-';
    };

    for (const rule of tierRules) {

      let specificity = 0;
      let match = true;

      // Exclude rules that are purely for services if we are evaluating the main product
      if (rule.additionalServices.length > 0 && rule.products.length === 0 && !rule.tariff && !rule.productType) {
        continue;
      }

      if (rule.tariff) {
        if (rule.tariff !== getTarifa(c)) match = false;
        else specificity += 1;
      }
      if (rule.productType) {
        const rType = rule.productType;
        const pTypeStr = (p.type || '').toLowerCase();
        
        if (rType === 'Fijo') {
          if (!pTypeStr.includes('fijo')) match = false;
          else specificity += 1;
        } else if (rType === 'Indexado' || rType === 'Index') {
          if (!pTypeStr.includes('indexado')) match = false;
          else specificity += 1;
        } else {
          // Strict match for exactly specific types (e.g., "Precio fijo único")
          if (rType !== p.type) match = false;
          else specificity += 2; // Extra specificity for exactly matching the full product type name
        }
      }
      if (rule.powerMin !== null) {
        if (avgPower < rule.powerMin) match = false;
        else specificity += 1;
      }
      if (rule.powerMax !== null) {
        if (avgPower >= rule.powerMax) match = false;
        else specificity += 1;
      }

      if (rule.products && rule.products.length > 0) {
        if (!rule.products.some((rp: any) => rp.id === p.id)) match = false;
        else specificity += 100; // Exception rule wins over generic rules
      }

      if (match && specificity > bestSpecificity) {
        matchedRule = rule;
        bestSpecificity = specificity;
      }
    }

    if (!matchedRule) {
      return { success: false, error: 'No se encontró ninguna regla aplicable en el Nivel del canal.' };
    }

    let calculatedCommission = 0;

    if (matchedRule.commissionType === 'FIXED') {
      calculatedCommission = matchedRule.value;
    } else if (matchedRule.commissionType === 'PERCENTAGE') {
      const getConsumo = (c: any) => {
        if (c.annualConsumption !== null && c.annualConsumption !== undefined) return c.annualConsumption;
        if (c.supplyPoint?.annualConsumption) return c.supplyPoint.annualConsumption;
        if (c.airtableData && typeof c.airtableData === 'object') {
          const ad = c.airtableData;
          if (ad['CONSUMO COMISION'] !== undefined) return Number(ad['CONSUMO COMISION']) || 0;
          if (ad['CONSUMO ANUAL'] !== undefined) return Number(ad['CONSUMO ANUAL']) || 0;
        }
        return 0;
      };
      
      const consumo = getConsumo(c);
      const marginFC = p.marginFC || 0;
      const energyMargin = consumo * marginFC;
      
      const powerMargin = (c.p1c || 0) * (p.ip1 || 0) +
                          (c.p2c || 0) * (p.ip2 || 0) +
                          (c.p3c || 0) * (p.ip3 || 0) +
                          (c.p4c || 0) * (p.ip4 || 0) +
                          (c.p5c || 0) * (p.ip5 || 0) +
                          (c.p6c || 0) * (p.ip6 || 0);

      const totalMargin = energyMargin + powerMargin;
      calculatedCommission = totalMargin * (matchedRule.value / 100);
    }

    // Calcular comisiones específicas de servicios adicionales
    let serviceCommission = 0;
    if (c.additionalServicesSnapshot && Array.isArray(c.additionalServicesSnapshot)) {
      const permanence = c.permanenceMonths || 12;
      c.additionalServicesSnapshot.forEach((s: any) => {
        if (s.isCommissionable) {
          // Buscar una regla que aplique a este servicio
          const serviceRule = tierRules.find(r => r.additionalServices.some(as => as.id === s.id));
          if (serviceRule) {
            if (serviceRule.commissionType === 'FIXED') {
              serviceCommission += serviceRule.value;
            } else if (serviceRule.commissionType === 'PERCENTAGE' && s.monthlyPrice) {
              const serviceMargin = s.monthlyPrice * permanence;
              serviceCommission += serviceMargin * (serviceRule.value / 100);
            }
          }
        }
      });
    }

    const finalCommissionTotal = calculatedCommission + serviceCommission;

    await prisma.contract.update({
      where: { id: contractId },
      data: { commissionFinal: finalCommissionTotal }
    });

    return { success: true, commissionFinal: finalCommissionTotal };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

export async function updateManualCommissionAction(contractId: string, manualValue: number) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { commissionFinal: manualValue }
    });

    return { success: true, commissionFinal: manualValue };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}
