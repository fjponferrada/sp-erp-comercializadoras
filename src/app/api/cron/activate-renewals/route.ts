import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    console.log('🚀 Iniciando CRON: Activación automática de renovaciones...');

    const now = new Date();
    // Normalizamos a medianoche UTC para comparar solo fechas
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Buscar contratos ACEPTADOS que sean de tipo Renovación (R)
    const pendingRenewals = await prisma.contract.findMany({
      where: {
        tipo: 'R',
        status: { in: ['ACEPTADO', 'Aceptado'] },
        previousContractId: { not: null }
      },
      include: {
        contract: true
      }
    });

    let activatedCount = 0;
    const results = [];

    for (const renewal of pendingRenewals) {
      if (!renewal.contract || !renewal.contract.expectedEndDate) {
        results.push({ id: renewal.id, cups: renewal.contractCode, status: 'SKIPPED', reason: 'No previous contract or expectedEndDate' });
        continue;
      }

      const prevEndDate = new Date(renewal.contract.expectedEndDate);
      const prevEndDay = new Date(Date.UTC(prevEndDate.getUTCFullYear(), prevEndDate.getUTCMonth(), prevEndDate.getUTCDate()));

      // Si la fecha actual ya superó o igualó la fecha de vencimiento + 1 día
      // O si preferimos activarlo estrictamente en el día siguiente:
      // prevEndDay + 1 día:
      const expectedActivationDay = new Date(prevEndDay.getTime() + 24 * 60 * 60 * 1000);

      if (today >= expectedActivationDay) {
        // Ejecutar transición
        try {
          await prisma.$transaction(async (tx) => {
            // 1. Dar de baja el antiguo (FINALIZADO)
            await tx.contract.update({
              where: { id: renewal.previousContractId! },
              data: {
                status: 'FINALIZADO',
                terminationDate: renewal.contract!.expectedEndDate
              }
            });

            // 2. Activar el nuevo (ACTIVO)
            await tx.contract.update({
              where: { id: renewal.id },
              data: {
                status: 'ACTIVO',
                activationDate: expectedActivationDay
              }
            });
          });

          activatedCount++;
          results.push({ id: renewal.id, cups: renewal.contractCode, status: 'ACTIVATED', prevContract: renewal.previousContractId, newActivationDate: expectedActivationDay });
        } catch (txError: any) {
          console.error(`Error procesando renovación ${renewal.id}:`, txError);
          results.push({ id: renewal.id, cups: renewal.contractCode, status: 'ERROR', reason: txError.message });
        }
      } else {
        results.push({ id: renewal.id, cups: renewal.contractCode, status: 'PENDING', reason: 'Aún no llega la fecha', expectedActivationDay });
      }
    }

    console.log(`✅ CRON finalizado. Renovaciones activadas: ${activatedCount}`);
    return NextResponse.json({
      success: true,
      message: `Se han activado ${activatedCount} renovaciones automáticamente.`,
      results
    });

  } catch (error: any) {
    console.error('❌ Error crítico en CRON activate-renewals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
