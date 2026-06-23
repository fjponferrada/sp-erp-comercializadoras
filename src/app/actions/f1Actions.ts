'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function getPaginatedF1FilesAction(
  page: number = 1,
  pageSize: number = 20,
  startDate?: string,
  endDate?: string,
  cups?: string,
  billedStatus?: 'ALL' | 'BILLED' | 'PENDING'
) {
  try {
    const session = await auth();
    if (!session) throw new Error('Unauthorized');

    const whereClause: any = {};

    if (cups) {
      whereClause.supplyPoint = { cups: { contains: cups, mode: 'insensitive' } };
    }

    if (startDate || endDate) {
      whereClause.fechaEmision = {};
      if (startDate) whereClause.fechaEmision.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.fechaEmision.lte = end;
      }
    }

    if (billedStatus === 'BILLED') {
      whereClause.invoices = { some: {} };
    } else if (billedStatus === 'PENDING') {
      whereClause.invoices = { none: {} };
    }

    const [files, total] = await Promise.all([
      prisma.f1Invoice.findMany({
        where: whereClause,
        include: {
          supplyPoint: {
            include: {
              contracts: {
                where: { status: { notIn: ['DRAFT', 'Borrador'] } },
                include: { client: true }
              }
            }
          },
          invoices: { select: { id: true } }
        },
        orderBy: { fechaEmision: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.f1Invoice.count({ where: whereClause })
    ]);

    // Format for the frontend table
    const formattedFiles = files.map((file: any) => {
      // Encontrar el contrato que cubría este F1
      const contracts = file.supplyPoint?.contracts || [];
      let activeContract = contracts.find((c: any) => {
        if (!c.activationDate) return false;
        if (!file.fechaFin) return false;
        const startOverlap = c.activationDate <= file.fechaFin;
        const endOverlap = !c.terminationDate || !file.fechaInicio || c.terminationDate >= file.fechaInicio;
        return startOverlap && endOverlap;
      });
      // Si no encuentra superposición exacta, tomar el más reciente
      if (!activeContract && contracts.length > 0) {
        activeContract = contracts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      }

      return {
        ...file,
        contract: activeContract,
        client: activeContract?.client,
      };
    });

    return {
      success: true,
      files: formattedFiles,
      totalCount: total,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error: any) {
    console.error('Error fetching F1 files:', error);
    return { success: false, error: error.message };
  }
}

export async function getPendingF1EnergyAction() {
  try {
    const session = await auth();
    if (!session?.user) throw new Error("No autorizado");

    const result = await prisma.$queryRaw<any[]>`
      SELECT SUM((p->>'ValorEnergiaActiva')::numeric) as total_energia
      FROM "F1Invoice" f
      CROSS JOIN jsonb_array_elements(
        CASE 
          WHEN jsonb_typeof(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo') = 'array' 
          THEN f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo'
          ELSE '[]'::jsonb
        END
      ) as p
      WHERE NOT EXISTS (
        SELECT 1 FROM "Invoice" i WHERE i."f1InvoiceId" = f.id
      )
    `;

    const totalEnergiaKWh = result[0]?.total_energia ? parseFloat(result[0].total_energia) : 0;
    return { success: true, totalMWh: totalEnergiaKWh / 1000 };
  } catch (err: any) {
    console.error("Error fetching pending F1 energy:", err);
    return { success: false, error: err.message };
  }
}

export async function getFianzasAction(
  page: number = 1,
  pageSize: number = 20,
  cups?: string
) {
  try {
    const session = await auth();
    if (!session) throw new Error('Unauthorized');

    const whereClause: any = {
      tipoDocumento: 'OtrasFacturas'
    };

    if (cups) {
      whereClause.supplyPoint = { cups: { contains: cups, mode: 'insensitive' } };
    }

    const [files, total] = await Promise.all([
      prisma.f1Invoice.findMany({
        where: whereClause,
        include: {
          supplyPoint: {
            include: {
              contracts: {
                where: { status: { notIn: ['DRAFT', 'Borrador'] } },
                include: { client: true }
              }
            }
          }
        },
        orderBy: { fechaEmision: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.f1Invoice.count({ where: whereClause })
    ]);

    const formattedFiles = files.map((file: any) => {
      const contracts = file.supplyPoint?.contracts || [];
      let activeContract = contracts.find((c: any) => {
        if (!c.activationDate) return false;
        if (!file.fechaEmision) return false;
        return c.activationDate <= file.fechaEmision;
      });
      if (!activeContract && contracts.length > 0) {
        activeContract = contracts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      }

      return {
        ...file,
        contract: activeContract,
        client: activeContract?.client,
      };
    });

    return {
      success: true,
      files: formattedFiles,
      totalCount: total,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error: any) {
    console.error('Error fetching fianzas:', error);
    return { success: false, error: error.message };
  }
}
