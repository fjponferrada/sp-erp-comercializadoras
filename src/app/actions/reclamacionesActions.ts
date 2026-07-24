'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { normalizeProvincia, normalizeMunicipio, normalizeTipoVia } from '@/lib/normalizeAddress';
import { unstable_noStore as noStore } from 'next/cache';

const escapeXml = (unsafe: string | null | undefined) => {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const removeAccentsAndEscape = (str: string | null | undefined) => {
  if (!str) return '';
  const noAccents = String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return escapeXml(noAccents);
};

export async function searchCupsForClaim(cups: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const supplyPoints = await prisma.supplyPoint.findMany({
      where: { cups: { equals: cups, mode: 'insensitive' } },
      include: {
        client: true,
        contracts: true,
        f1Invoices: {
          orderBy: { fechaEmision: 'desc' },
          // Limitamos a las facturas más recientes para no saturar
          take: 20
        }
      }
    });

    if (supplyPoints.length === 0) {
      return { success: false, error: 'CUPS no encontrado' };
    }

    // Lógica para coger el SupplyPoint correcto (ACTIVO o el más reciente)
    let supplyPoint = supplyPoints.find(s => s.contracts?.some(c => c.status === 'ACTIVO'));
    if (!supplyPoint) {
       let latestDate = new Date(0);
       for (const s of supplyPoints) {
         for (const c of s.contracts || []) {
           const tDate = c.terminationDate || c.expectedEndDate;
           if (tDate && tDate > latestDate) {
             latestDate = tDate;
             supplyPoint = s;
           }
         }
       }
       if (!supplyPoint) supplyPoint = supplyPoints[0];
    }

    return {
      success: true,
      data: {
        supplyPointId: supplyPoint.id,
        cups: supplyPoint.cups,
        tariff: supplyPoint.tariff || (supplyPoint.client as any)?.airtableData?.TARIFA || '',
        clientName: supplyPoint.client.businessName || `${supplyPoint.client.firstName || ''} ${supplyPoint.client.lastName || ''}`.trim(),
        clientVat: supplyPoint.client.vatNumber,
        f1Invoices: supplyPoint.f1Invoices.map(f1 => {
          const jsonData: any = f1.jsonData || {};
          const dGenFact = jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || {};
          
          const getArray = (obj: any) => obj ? (Array.isArray(obj) ? obj : [obj]) : [];
          const pEnergia = getArray(jsonData?.EnergiaActiva?.TerminoEnergiaActiva?.Periodo);
          const pPotencia = getArray(jsonData?.Potencia?.TerminoPotencia?.Periodo);

          const getE = (i: number, k1: string, k2: string) => pEnergia[i]?.ValorEnergiaActiva ?? (jsonData[k1] ?? (jsonData[k2] ?? '0'));
          const getP = (i: number, k1: string, k2: string) => pPotencia[i]?.PotenciaAFacturar ?? (pPotencia[i]?.PotenciaContratada ?? (jsonData[k1] ?? (jsonData[k2] ?? '0')));

          const dFacturaAtr = jsonData?.DatosGeneralesFacturaATR?.DatosFacturaATR || jsonData?.DatosFacturaATR || {};
          return {
            id: f1.id,
            codigoFiscal: f1.numeroFactura || dGenFact.CodigoFiscalFactura || jsonData.codigoFiscal || jsonData['Codigo Fiscal'] || '',
            fechaEmision: f1.fechaEmision,
            fechaInicio: f1.fechaInicio || dFacturaAtr.Periodo?.FechaDesdeFactura || dFacturaAtr.FechaInicioPeriodo,
            fechaFin: f1.fechaFin || dFacturaAtr.Periodo?.FechaHastaFactura || dFacturaAtr.FechaFinPeriodo,
            tipoFactura: dGenFact.TipoFactura || jsonData.tipoFactura || 'Normal',
            motivoFactura: dGenFact.MotivoFacturacion || jsonData.motivoFactura || 'De ciclo',
            excedentes: jsonData.excedentes || '0',
            energiaP1: getE(0, 'energiaP1', 'P1E'),
            energiaP2: getE(1, 'energiaP2', 'P2E'),
            energiaP3: getE(2, 'energiaP3', 'P3E'),
            energiaP4: getE(3, 'energiaP4', 'P4E'),
            energiaP5: getE(4, 'energiaP5', 'P5E'),
            energiaP6: getE(5, 'energiaP6', 'P6E'),
            potenciaP1: getP(0, 'potenciaP1', 'P1C'),
            potenciaP2: getP(1, 'potenciaP2', 'P2C'),
            potenciaP3: getP(2, 'potenciaP3', 'P3C'),
            potenciaP4: getP(3, 'potenciaP4', 'P4C'),
            potenciaP5: getP(4, 'potenciaP5', 'P5C'),
            potenciaP6: getP(5, 'potenciaP6', 'P6C'),
            jsonData: jsonData
          };
        })
      }
    };
  } catch (error: any) {
    console.error('Error in searchCupsForClaim:', error);
    return { success: false, error: 'Error buscando CUPS' };
  }
}

export async function searchInvoicesForMassClaim(desde: string, hasta: string, procedencia: string, tipoFactura: string = 'Normal') {
  noStore();
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autorizado' };

    const whereClause: any = {};
    if (desde || hasta) {
      whereClause.issueDate = {};
      if (desde) {
        const d = new Date(desde + 'T00:00:00.000Z');
        d.setHours(d.getHours() - 4); // Margen de seguridad para atrapar 22:00 UTC del día anterior
        whereClause.issueDate.gte = d;
      }
      if (hasta) {
        const h = new Date(hasta + 'T23:59:59.999Z');
        h.setHours(h.getHours() + 4);
        whereClause.issueDate.lte = h;
      }
    }
    
    if (tipoFactura) {
      whereClause.invoiceType = { equals: tipoFactura, mode: 'insensitive' };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: { client: true, supplyPoint: true, contract: true },
      orderBy: { issueDate: 'desc' },
      take: 5000 // Increased from 300 to allow in-memory filtering of 'Procedencia' without cutting off older dates
    });

    const mapped = invoices.map(inv => {
      const d = (inv.invoiceData && typeof inv.invoiceData === 'object') ? inv.invoiceData as any : {};
      
      let procHasta = inv.origin || d['Procedencia Hasta'] || '';
      let procDesde = d['Procedencia Desde'] || '';
      let cf = String(d['Codigo Fiscal'] || '').trim();
      if (cf.startsWith('CF ')) cf = cf.substring(3).trim();
      else if (cf.startsWith('CF')) cf = cf.substring(2).trim();

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.businessName || `${inv.client?.firstName || ''} ${inv.client?.lastName || ''}`.trim(),
        cups: inv.supplyPoint?.cups || '',
        contractCode: inv.contract?.contractCode || '',
        codigoFiscal: cf,
        invoiceType: inv.invoiceType || d['Tipo Factura'] || '',
        issueDate: inv.issueDate,
        procedenciaDesde: procDesde,
        procedenciaHasta: procHasta,
        billingStart: inv.billingStart,
        billingEnd: inv.billingEnd,
        totalAmount: inv.totalAmount,
        pdfUrl: inv.pdfUrl || d['pdfUrl'] || d['Factura PDF'] || '',
        origin: procHasta
      };
    });

    const final = procedencia 
      ? mapped.filter(i => i.origin?.toLowerCase().includes(procedencia.toLowerCase()))
      : mapped;

    return { success: true, invoices: final };
  } catch (err: any) {
    console.error('Error in searchInvoicesForMassClaim:', err);
    return { success: false, error: err.message };
  }
}

import PizZip from 'pizzip';

export async function generateClaim(data: any) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const { mode, motivo, submotivo, cups, clientData, selectedF1Id, comentarios, csvContent, dynamicFields, fechaLectura, lecturas } = data;

    const buildR1Xml = async (claimCups: string, claimMotivo: string, claimSubmotivo: string, f1Id?: string) => {
      const now = new Date();
      
      // Convert to Europe/Madrid timezone string YYYY-MM-DDTHH:MM:SS
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);
      const formattedDate = localISOTime.split('.')[0];
      
      const limitDateObj = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const limitLocalISO = (new Date(limitDateObj.getTime() - limitDateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, -1);
      const limitDate = limitLocalISO.split('T')[0];
      
      const code = Math.random().toString().slice(2, 14); // 12 digits
      
      const tipo = claimMotivo ? claimMotivo.split('-')[0].trim() : '';
      const subtipo = claimSubmotivo ? claimSubmotivo.split('-')[0].trim() : '';

      // Obtener todos los SupplyPoints para ese CUPS
      const supplyPoints = await prisma.supplyPoint.findMany({
        where: { cups: { equals: claimCups, mode: 'insensitive' } },
        include: { 
          client: { include: { brand: { include: { company: true } } } },
          contracts: {
            orderBy: { activationDate: 'desc' },
            include: { client: { include: { brand: { include: { company: true } } } } }
          }
        }
      });

      let sp = null;
      if (supplyPoints.length > 0) {
        // Buscar el que tenga un contrato ACTIVO
        sp = supplyPoints.find(s => s.contracts?.some(c => c.status === 'ACTIVO'));
        
        // Si no hay ninguno activo, buscar el que tenga el contrato finalizado más reciente
        if (!sp) {
           let latestDate = new Date(0);
           for (const s of supplyPoints) {
             for (const c of s.contracts || []) {
               const tDate = c.terminationDate || c.expectedEndDate;
               if (tDate && tDate > latestDate) {
                 latestDate = tDate;
                 sp = s;
               }
             }
           }
           if (!sp) sp = supplyPoints[0];
        }
      }

      // El titular real es el del contrato más reciente
      const activeClient = sp?.contracts?.[0]?.client || sp?.client;

      const emisora = activeClient?.brand?.company?.codigoRee || '1713';
      const destino = sp?.distributorReeCode || (claimCups && claimCups.length >= 6 ? claimCups.substring(2, 6) : '0031');
      
      const vat = activeClient?.vatNumber || '00000000T';
      const isCif = /^[A-Z]/.test(vat);
      
      // En el estándar CNMC, tanto NIF como CIF se envían como 'NI' (o 'NV' si es NIF-IVA, pero por defecto 'NI').
      // No existe el código 'CI'.
      const tipoIdentificador = 'NI';
      const tipoPersona = isCif ? 'J' : 'F';
      
      let xmlNombre = '';
      if (tipoPersona === 'J') {
        const razonSocial = activeClient?.businessName || 'DESCONOCIDO';
        xmlNombre = `<RazonSocial>${removeAccentsAndEscape(razonSocial)}</RazonSocial>`;
      } else {
        const nombrePila = activeClient?.firstName || activeClient?.businessName || 'DESCONOCIDO';
        const primerApellido = activeClient?.lastName || 'DESCONOCIDO';
        const segundoApellido = activeClient?.lastName2 || '';
        
        xmlNombre = `<NombreDePila>${removeAccentsAndEscape(nombrePila)}</NombreDePila>\n<PrimerApellido>${removeAccentsAndEscape(primerApellido)}</PrimerApellido>`;
        if (segundoApellido.trim()) {
          xmlNombre += `\n<SegundoApellido>${removeAccentsAndEscape(segundoApellido.trim())}</SegundoApellido>`;
        }
      }

      const phone = activeClient?.contactPhone || '000000000';
      
      // Titular Address Logic
      // Try to get address from Client first, then Client's AirtableData, then SupplyPoint
      let province = activeClient?.billingProvince;
      let city = activeClient?.billingCity;
      let zip = activeClient?.billingPostalCode;
      let streetType = 'CL';
      let street = activeClient?.billingAddress;
      let number = '0';

      const cAirtable: any = activeClient?.airtableData || {};
      
      if (!zip || zip === '00000') {
          zip = cAirtable['Código Postal Titular'] || cAirtable['Código Postal Instalación'] || sp?.postalCode || '00000';
      }
      if (!province || province === '00') {
          province = cAirtable['PROVINCIA SOC'] || sp?.province || '00';
      }
      if (!city || city === '000000') {
          city = cAirtable['POBLACION SOC'] || sp?.city || '000000';
      }
      if (!street || street === 'DESCONOCIDA') {
          street = cAirtable['Calle Titular'] || cAirtable['DOMICILIO SOC'] || sp?.street || sp?.address || 'DESCONOCIDA';
          streetType = cAirtable['Tipo de vía Titular'] || sp?.streetType || 'CL';
          number = cAirtable['Número Titular'] !== undefined ? String(cAirtable['Número Titular']) : (sp?.streetNumber || '0');
      }

      const normProvincia = normalizeProvincia(zip || '');
      // Construct exact 6-digit CNMC code combining province and municipality padding
      const rawMuni = normalizeMunicipio(zip || '', city || '');
      const normMunicipio = rawMuni === '000' ? '00000' : `${normProvincia}${rawMuni}`;
      const normTipoVia = normalizeTipoVia(streetType);

      const companyContact = activeClient?.brand?.company?.contactPerson || activeClient?.brand?.contactPerson || 'RESPONSABLE DE RECLAMACIONES';
      const companyPhone = activeClient?.brand?.company?.phone || activeClient?.brand?.phone || '900000000';
      const companyEmail = activeClient?.brand?.company?.email || activeClient?.brand?.email || 'reclamaciones@comercializadora.com';

      let numFacturaAtrXml = '';
      if (f1Id) {
        const f1 = await prisma.f1Invoice.findFirst({ 
          where: { 
            OR: [
              { id: f1Id },
              { numeroFactura: f1Id }
            ]
          } 
        });
        if (f1 && f1.numeroFactura) {
          numFacturaAtrXml = `\n<NumFacturaATR>${f1.numeroFactura}</NumFacturaATR>`;
        } else {
          // Fallback para CSV: asume que es el código fiscal directamente
          numFacturaAtrXml = `\n<NumFacturaATR>${f1Id}</NumFacturaATR>`;
        }
      } else if (dynamicFields && dynamicFields['NUM FACTURA ATR']) {
          numFacturaAtrXml = `\n<NumFacturaATR>${dynamicFields['NUM FACTURA ATR']}</NumFacturaATR>`;
      }
      
      let lecturasXml = '';
      if (fechaLectura) {
        lecturasXml += `\n<FechaLectura>${fechaLectura}</FechaLectura>`;
      }
      if (lecturas) {
        const periodos = Object.keys(lecturas).filter(k => lecturas[k] !== '');
        if (periodos.length > 0) {
          lecturasXml += '\n<LecturasAportadas>';
          for (const p of periodos) {
            const pNum = p.replace('P', ''); // '1', '2'...
            // Para tarifas TD actuales, el estándar CNMC exige 91, 92, 93...
            const codPeriodo = `9${pNum}`;
            lecturasXml += `\n<LecturaAportada>\n<Integrador>AE</Integrador>\n<CodigoPeriodoDH>${codPeriodo}</CodigoPeriodoDH>\n<LecturaPropuesta>${lecturas[p]}</LecturaPropuesta>\n</LecturaAportada>`;
          }
          lecturasXml += '\n</LecturasAportadas>';
        }
      }
      
      let dynamicFieldsXml = '';
      if (dynamicFields) {
        for (const [key, value] of Object.entries(dynamicFields)) {
          if (value && typeof value === 'string' && value.trim() !== '') {
            // Evitar duplicar NumFacturaATR ya que lo procesamos arriba
            if (key === 'NUM FACTURA ATR') continue;
            
            // Remove accents and convert e.g., "CÓDIGO INCIDENCIA" to "CodigoIncidencia"
            const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const xmlTag = normalizedKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            dynamicFieldsXml += `\n<${xmlTag}>${escapeXml(value)}</${xmlTag}>`;
          }
        }
      }

      return `<MensajeReclamacionPeticion xmlns="http://localhost/elegibilidad">
<CabeceraReclamacion>
<CodigoREEEmpresaEmisora>${emisora}</CodigoREEEmpresaEmisora>
<CodigoREEEmpresaDestino>${destino}</CodigoREEEmpresaDestino>
<CodigoDelProceso>R1</CodigoDelProceso>
<CodigoDePaso>01</CodigoDePaso>
<CodigoDeSolicitud>${code}</CodigoDeSolicitud>
<SecuencialDeSolicitud>01</SecuencialDeSolicitud>
<FechaSolicitud>${formattedDate}</FechaSolicitud>
<CUPS>${claimCups || ''}</CUPS>
</CabeceraReclamacion>
<SolicitudReclamacion>
<DatosSolicitud>
<Tipo>${tipo}</Tipo>
<Subtipo>${subtipo}</Subtipo>
<FechaLimite>${limitDate}</FechaLimite>
<Prioritario>S</Prioritario>
</DatosSolicitud>
<VariablesDetalleReclamacion>
<VariableDetalleReclamacion>
<Contacto>
<PersonaDeContacto>${escapeXml(companyContact)}</PersonaDeContacto>
<Telefono>
<PrefijoPais>34</PrefijoPais>
<Numero>${escapeXml(companyPhone)}</Numero>
</Telefono>
<CorreoElectronico>${escapeXml(companyEmail)}</CorreoElectronico>
</Contacto>
${dynamicFieldsXml}${numFacturaAtrXml}${lecturasXml}</VariableDetalleReclamacion>
</VariablesDetalleReclamacion>
<Cliente>
<IdCliente>
<TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
<Identificador>${vat}</Identificador>
<TipoPersona>${tipoPersona}</TipoPersona>
</IdCliente>
<Nombre>
${xmlNombre}
</Nombre>
<Telefono>
<PrefijoPais>34</PrefijoPais>
<Numero>${phone}</Numero>
</Telefono>
<IndicadorTipoDireccion>F</IndicadorTipoDireccion>
<Direccion>
<Pais>Espana</Pais>
<Provincia>${normProvincia}</Provincia>
<Municipio>${normMunicipio}</Municipio>
<CodPostal>${zip}</CodPostal>
<Via>
<TipoVia>${normTipoVia}</TipoVia>
<Calle>${removeAccentsAndEscape(street || '').substring(0, 30)}</Calle>
<NumeroFinca>${escapeXml(number)}</NumeroFinca>
</Via>
</Direccion>
</Cliente>
<TipoReclamante>06</TipoReclamante>
<Comentarios>${escapeXml(comentarios || '')}</Comentarios>
</SolicitudReclamacion>
</MensajeReclamacionPeticion>`;
    };

    if (mode === 'Individual') {
      const xml = await buildR1Xml(cups, motivo, submotivo, selectedF1Id);
      const base64 = Buffer.from(xml).toString('base64');
      return {
        success: true,
        isZip: false,
        fileName: `Reclamacion_${cups}_${new Date().getTime()}.xml`,
        fileContent: base64
      };
    } else if (mode === 'Masiva' && csvContent) {
      const lines = csvContent.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
      // Skip header
      const rows = lines.slice(1);
      
      const zip = new PizZip();
      let count = 0;
      
      for (const row of rows) {
        const [c, codigoFiscal, marca] = row.split(';');
        if (!c) continue;
        const xml = await buildR1Xml(c, motivo, submotivo, codigoFiscal);
        zip.file(`Reclamacion_${c}_${count}.xml`, xml);
        count++;
      }
      
      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_CSV_${new Date().getTime()}.zip`,
        fileContent: zipBase64
      };
    } else if (mode === 'Masiva' && data.invoiceIds && Array.isArray(data.invoiceIds) && data.invoiceIds.length > 0) {
      const zip = new PizZip();
      let count = 0;

      const invoices = await prisma.invoice.findMany({
        where: { id: { in: data.invoiceIds } },
        include: { supplyPoint: true }
      });

      for (const inv of invoices) {
        if (!inv.supplyPoint?.cups) continue;
        
        let f1IdToUse = '';
        
        if (inv.invoiceData && typeof inv.invoiceData === 'object') {
          const d = inv.invoiceData as any;
          if (d['Codigo Fiscal']) {
            let cf = String(d['Codigo Fiscal']).trim();
            if (cf.startsWith('CF ')) {
              cf = cf.substring(3).trim();
            } else if (cf.startsWith('CF')) {
              cf = cf.substring(2).trim();
            }
            f1IdToUse = cf;
          }
        }

        if (!f1IdToUse && inv.billingEnd) {
          const f1 = await prisma.f1Invoice.findFirst({
            where: {
              supplyPointId: inv.supplyPointId,
              fechaFin: {
                gte: new Date(inv.billingEnd.getTime() - 2 * 24 * 60 * 60 * 1000),
                lte: new Date(inv.billingEnd.getTime() + 2 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: { fechaFin: 'desc' }
          });
          if (f1) {
            f1IdToUse = f1.id;
          }
        }

        const xml = await buildR1Xml(inv.supplyPoint.cups, motivo, submotivo, f1IdToUse);
        zip.file(`Reclamacion_${inv.supplyPoint.cups}_${count}.xml`, xml);
        count++;
      }

      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_Facturas_${new Date().getTime()}.zip`,
        fileContent: zipBase64
      };
    } else if (mode === 'Masiva' && data.cupsIds && Array.isArray(data.cupsIds) && data.cupsIds.length > 0) {
      const zip = new PizZip();
      let count = 0;

      for (const cups of data.cupsIds) {
        if (!cups) continue;
        const xml = await buildR1Xml(cups, motivo, submotivo);
        zip.file(`Reclamacion_${cups}_${count}.xml`, xml);
        count++;
      }

      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_Retrasos_${new Date().getTime()}.zip`,
        fileContent: zipBase64
      };
    }

    return { success: false, error: 'Modo no soportado o falta CSV/Facturas/CUPS' };
  } catch (error: any) {
    console.error('Error in generateClaim:', error);
    return { success: false, error: 'Error al generar la reclamación' };
  }
}

export async function searchCupsWithBillingDelay(minDays: number = 45) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autorizado' };

    // Buscar CUPS que tengan al menos un contrato ACTIVO, BAJA o FINALIZADO
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: { contracts: { some: { status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] } } } },
      include: {
        client: { select: { businessName: true, firstName: true, lastName: true, vatNumber: true, airtableData: true } },
        contracts: {
          where: { status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] } },
          select: { contractCode: true, activationDate: true, terminationDate: true, expectedEndDate: true, status: true },
          orderBy: { activationDate: 'desc' }
        }
      }
    });

    const extendedCupsList = new Set<string>();
    for (const sp of supplyPoints) {
      extendedCupsList.add(sp.cups);
      if (sp.cups.length > 20) {
        extendedCupsList.add(sp.cups.substring(0, 20));
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: { 
        supplyPoint: { cups: { in: Array.from(extendedCupsList) } },
        billingEnd: { not: null }
      },
      select: { billingEnd: true, supplyPoint: { select: { cups: true } } },
      orderBy: { billingEnd: 'desc' }
    });

    const latestInvoiceByCups = new Map<string, Date>();
    for (const inv of invoices) {
      if (inv.supplyPoint?.cups && inv.billingEnd) {
        const baseCups = inv.supplyPoint.cups.substring(0, 20);
        const existing = latestInvoiceByCups.get(baseCups);
        if (!existing || new Date(inv.billingEnd) > existing) {
          latestInvoiceByCups.set(baseCups, new Date(inv.billingEnd));
        }
      }
    }

    const results = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const sp of supplyPoints) {
      let effectiveStartDate: Date | null = null;
      let effectiveEndDate: Date | null = null;
      
      const latestContract = sp.contracts[0];
      if (!latestContract) continue;
      
      effectiveStartDate = latestContract.activationDate;
      if (!effectiveStartDate) continue;

      // Si el último contrato está dado de baja, recogemos su fecha de fin
      if (latestContract.status !== 'ACTIVO') {
        effectiveEndDate = latestContract.terminationDate || latestContract.expectedEndDate || null;
      }

      let currentStart = new Date(effectiveStartDate);
      
      // Buscar contratos anteriores contiguos
      for (let i = 1; i < sp.contracts.length; i++) {
        const prevContract = sp.contracts[i];
        if (!prevContract.activationDate) continue;
        
        const prevEnd = prevContract.terminationDate || prevContract.expectedEndDate;
        if (!prevEnd) break;
        
        const diffTime = currentStart.getTime() - prevEnd.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        
        if (diffDays <= 2 && diffDays >= -2) {
          currentStart = new Date(prevContract.activationDate);
        } else {
          break;
        }
      }

      effectiveStartDate = currentStart;

      let lastBilledDate: Date | null = null;
      const baseCups = sp.cups.substring(0, 20);
      const latestBillingEnd = latestInvoiceByCups.get(baseCups);
      
      if (latestBillingEnd && latestBillingEnd >= effectiveStartDate) {
        lastBilledDate = new Date(latestBillingEnd);
      } else {
        lastBilledDate = new Date(effectiveStartDate.getTime() - (24 * 3600 * 1000));
      }

      lastBilledDate.setHours(0, 0, 0, 0);

      // Regla: si el CUPS ya causó baja definitiva y la factura llega hasta o pasa la fecha de baja, no se reclama
      if (effectiveEndDate) {
        effectiveEndDate.setHours(0, 0, 0, 0);
        if (lastBilledDate >= effectiveEndDate) {
          continue; // Ya está facturado hasta el final
        }
      }

      let delayDays = Math.floor((now.getTime() - lastBilledDate.getTime()) / (1000 * 3600 * 24));

      if (sp.isBimonthly) {
        delayDays -= 30;
      }

      if (delayDays >= minDays) {
        results.push({
          cupsId: sp.id,
          cups: sp.cups,
          titular: sp.client.businessName || `${sp.client.firstName || ''} ${sp.client.lastName || ''}`.trim(),
          tarifa: (sp as any).tariff || (sp.client.airtableData as any)?.TARIFA || '',
          contrato: latestContract.contractCode || 'N/A',
          inicioPeriodoContinuo: effectiveStartDate.toISOString(),
          ultimoDiaFacturado: lastBilledDate.toISOString(),
          diasRetraso: delayDays
        });
      }
    }

    results.sort((a, b) => b.diasRetraso - a.diasRetraso);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Error en searchCupsWithBillingDelay:', error);
    return { success: false, error: 'Error al calcular retrasos' };
  }
}
