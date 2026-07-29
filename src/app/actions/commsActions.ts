'use server';

import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { getUserVisibilityFilter } from '@/lib/permissions';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function getSupplyPointsForComms() {
  try {
    const filter = await getUserVisibilityFilter();

    // Fetch SupplyPoints along with their latest contract to determine active status and channel
    const supplyPoints = await prisma.supplyPoint.findMany({
      include: {
        contracts: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            client: true,
            user: {
              include: {
                channel: true
              }
            }
          }
        }
      }
    });

    const result = supplyPoints.map(sp => {
      const latestContract = sp.contracts[0];
      if (!latestContract) return null; // Ignore SPs with no contracts

      return {
        id: sp.id,
        cups: sp.cups,
        status: latestContract.status === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO',
        clientName: latestContract.client?.businessName || latestContract.client?.name || 'Sin nombre',
        clientEmail: latestContract.client?.email || '',
        channelName: latestContract.user?.channel?.name || 'Sin Canal',
        channelId: latestContract.user?.channel?.id || 'NO_CHANNEL',
        contractId: latestContract.id
      };
    }).filter(Boolean); // Remove nulls

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error fetching supply points for comms:', error);
    return { success: false, error: error.message };
  }
}

export async function sendMassCommunication(subject: string, bodyTemplate: string, supplyPointIds: string[]) {
  if (!resend) {
    return { success: false, error: 'Resend no está configurado.' };
  }

  try {
    // 1. Fetch details for selected supply points
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: { id: { in: supplyPointIds } },
      include: {
        contracts: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { client: true }
        }
      }
    });

    // 2. Group by Client to avoid sending 5 emails to the same client for 5 CUPS
    const clientsMap = new Map<string, { email: string; name: string; cupsList: string[] }>();

    supplyPoints.forEach(sp => {
      const contract = sp.contracts[0];
      const email = contract?.client?.email;
      if (!email || !email.includes('@')) return;

      const clientName = contract.client?.businessName || contract.client?.name || 'Cliente';
      
      if (!clientsMap.has(email)) {
        clientsMap.set(email, { email, name: clientName, cupsList: [] });
      }
      clientsMap.get(email)!.cupsList.push(sp.cups);
    });

    const clientsToEmail = Array.from(clientsMap.values());
    if (clientsToEmail.length === 0) {
      return { success: false, error: 'Ninguno de los CUPS seleccionados tiene un email válido.' };
    }

    // 3. Batch send emails (Up to 100 per batch per Resend limits)
    const BATCH_SIZE = 50;
    let sentCount = 0;

    for (let i = 0; i < clientsToEmail.length; i += BATCH_SIZE) {
      const batch = clientsToEmail.slice(i, i + BATCH_SIZE);
      
      const emailPayloads = batch.map(client => {
        // Simple merge tags replacement
        let personalizedBody = bodyTemplate
          .replace(/\{\{nombre_cliente\}\}/g, client.name)
          .replace(/\{\{cups\}\}/g, client.cupsList.join(', '));

        return {
          from: 'Ultra Energía <no-reply@ultra.sp-energia.com>',
          to: [client.email],
          subject: subject,
          html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <p>${personalizedBody.replace(/\n/g, '<br/>')}</p>
          </div>`
        };
      });

      await resend.batch.send(emailPayloads);
      sentCount += emailPayloads.length;

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < clientsToEmail.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { success: true, sentCount };
  } catch (error: any) {
    console.error('Error sending mass communication:', error);
    return { success: false, error: error.message };
  }
}
