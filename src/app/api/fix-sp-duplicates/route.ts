import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    // Protegemos la ruta para superadmin (o tú)
    if (!session || !session.user || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allSPs = await prisma.supplyPoint.findMany({
      include: {
        client: true,
        contracts: true,
        invoices: true,
      }
    });

    const normalizedMap = new Map<string, typeof allSPs>();

    for (const sp of allSPs) {
      if (!sp.cups || !sp.client?.vatNumber) continue;
      
      const normCups = sp.cups.substring(0, 20).toUpperCase();
      const normVat = sp.client.vatNumber.trim().toUpperCase();
      const key = `${normCups}_${normVat}`;

      if (!normalizedMap.has(key)) {
        normalizedMap.set(key, []);
      }
      normalizedMap.get(key)!.push(sp);
    }

    let mergedCount = 0;
    const logs = [];

    for (const [key, sps] of normalizedMap.entries()) {
      if (sps.length > 1) {
        // Ordenamos para quedarnos con el "principal"
        // 1. Mayor numero de contratos
        // 2. Mayor longitud del CUPS (22 > 20)
        // 3. Más antiguo
        sps.sort((a, b) => {
          if (b.contracts.length !== a.contracts.length) return b.contracts.length - a.contracts.length;
          if (b.cups.length !== a.cups.length) return b.cups.length - a.cups.length;
          return 0; // SupplyPoint doesn't have createdAt
        });

        const primarySp = sps[0];
        const duplicates = sps.slice(1);

        logs.push(`Found duplicates for ${key}. Primary SP: ${primarySp.id} (${primarySp.cups}). Merging ${duplicates.length} duplicates.`);

        for (const dup of duplicates) {
          // Re-asignar Contratos
          for (const contract of dup.contracts) {
            await prisma.contract.update({
              where: { id: contract.id },
              data: { 
                supplyPointId: primarySp.id,
                clientId: primarySp.clientId // Asegurar consistencia
              }
            });
            logs.push(` - Moved Contract ${contract.id} to primary SP`);
          }

          // Re-asignar Facturas
          for (const invoice of dup.invoices) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { 
                supplyPointId: primarySp.id,
                clientId: primarySp.clientId // Asegurar consistencia
              }
            });
            logs.push(` - Moved Invoice ${invoice.id} to primary SP`);
          }

          // Re-asignar Curvas de Carga (si tienen relation con SP)
          // Actually, LoadCurve mostly uses `cups` string. 
          // But we can just leave loadCurve alone since it relies on the CUPS string which matches the first 20 chars anyway.

          // Finalmente eliminar el SupplyPoint duplicado
          await prisma.supplyPoint.delete({
            where: { id: dup.id }
          });
          mergedCount++;
          logs.push(` - Deleted duplicate SP ${dup.id} (${dup.cups})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      mergedCount,
      logs
    });

  } catch (error: any) {
    console.error('Error fixing duplicates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
