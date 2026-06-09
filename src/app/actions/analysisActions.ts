'use server';

import { prisma } from '@/lib/prisma';

export async function getEconomicAnalysis() {
  try {
    // 1. Agrupación de Facturas por Año-Mes
    const invoicesData: any[] = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("issueDate", 'YYYY-MM') as month,
        SUM("totalAmount") as total_eur,
        SUM("totalMWh") as total_mwh,
        SUM("margin") as margin
      FROM "Invoice"
      WHERE "issueDate" IS NOT NULL
      GROUP BY TO_CHAR("issueDate", 'YYYY-MM')
      ORDER BY month ASC
    `;

    // 2. Agrupación de Altas de Contratos
    const altasData: any[] = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("activationDate", 'YYYY-MM') as month,
        COUNT(id) as count,
        SUM((SELECT "estimatedMWh" FROM "Lead" WHERE "Lead"."contractId" = "Contract"."id" LIMIT 1)) as mwh
      FROM "Contract"
      WHERE "activationDate" IS NOT NULL AND status IN ('ACTIVO', 'BAJA')
      GROUP BY TO_CHAR("activationDate", 'YYYY-MM')
      ORDER BY month ASC
    `;

    // 3. Agrupación de Bajas de Contratos
    const bajasData: any[] = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("terminationDate", 'YYYY-MM') as month,
        COUNT(id) as count,
        SUM((SELECT "estimatedMWh" FROM "Lead" WHERE "Lead"."contractId" = "Contract"."id" LIMIT 1)) as mwh
      FROM "Contract"
      WHERE "terminationDate" IS NOT NULL AND status = 'BAJA'
      GROUP BY TO_CHAR("terminationDate", 'YYYY-MM')
      ORDER BY month ASC
    `;

    // 4. Consolidar los datos en un solo array de meses
    const allMonths = new Set<string>();
    invoicesData.forEach(d => allMonths.add(d.month));
    altasData.forEach(d => allMonths.add(d.month));
    bajasData.forEach(d => allMonths.add(d.month));

    const sortedMonths = Array.from(allMonths).sort();
    
    let activeContractsCount = 0;
    let activeMWh = 0;

    const results = sortedMonths.map(month => {
      const inv = invoicesData.find(d => d.month === month) || { total_eur: 0, total_mwh: 0, margin: 0 };
      const alt = altasData.find(d => d.month === month) || { count: 0, mwh: 0 };
      const baj = bajasData.find(d => d.month === month) || { count: 0, mwh: 0 };

      // Conversión de BigInt a Number (Prisma queryRaw devuelve BigInt en count y sum a veces)
      const factEur = Number(inv.total_eur) || 0;
      const factMwh = Number(inv.total_mwh) || 0;
      const margin = Number(inv.margin) || 0;
      
      const altasCount = Number(alt.count) || 0;
      const altasMwh = Number(alt.mwh) || 0;
      
      const bajasCount = Number(baj.count) || 0;
      const bajasMwh = Number(baj.mwh) || 0;

      // Acumulados
      activeContractsCount = activeContractsCount + altasCount - bajasCount;
      activeMWh = activeMWh + altasMwh - bajasMwh;

      const crecimientoNeto = activeMWh > 0 ? (altasMwh - bajasMwh) / activeMWh : 0;
      
      return {
        month,
        facturacionEur: factEur,
        facturacionMwh: factMwh,
        eurPerMwh: factMwh > 0 ? factEur / factMwh : 0,
        margenEur: margin,
        margenPercent: factEur > 0 ? margin / factEur : 0,
        altas: altasCount,
        bajas: bajasCount,
        contratosActivos: activeContractsCount,
        mwhAltas: altasMwh,
        mwhBajas: bajasMwh,
        mwhActivos: activeMWh,
        crecimientoMes: crecimientoNeto,
        proyeccionAlta: altasMwh * 200 * ((12 - parseInt(month.split('-')[1])) / 12),
        proyeccionCompleto: altasMwh * 200
      };
    });

    return results;

  } catch (error) {
    console.error("Error generating economic analysis:", error);
    return [];
  }
}
