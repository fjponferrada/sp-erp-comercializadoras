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
          // No usamos 'take: 1' para poder ver si hay contratos ACTIVOS anteriores
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
      if (sp.contracts.length === 0) return null;

      // Buscar si el CUPS tiene ALGÚN contrato ACTIVO. 
      // Si lo tiene, ese es el contrato vigente real. Si no, usamos el último (TRAMITANDO, FINALIZADO...).
      const activeContract = sp.contracts.find(c => c.status === 'ACTIVO');
      const referenceContract = activeContract || sp.contracts[0];

      return {
        id: sp.id,
        cups: sp.cups,
        status: referenceContract.status === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO',
        clientName: referenceContract.client?.businessName || (referenceContract.client?.firstName ? `${referenceContract.client.firstName} ${referenceContract.client.lastName}` : 'Sin nombre'),
        clientEmail: referenceContract.client?.contactEmail || referenceContract.client?.invoiceEmail || referenceContract.client?.representativeEmail || '',
        channelName: referenceContract.user?.channel?.name || 'Sin Canal',
        channelId: referenceContract.user?.channel?.id || 'NO_CHANNEL',
        contractId: referenceContract.id
      };
    }) as any[];
    
    // Remove nulls
    const filteredResult = result.filter(r => r !== null);

    return { success: true, data: filteredResult };
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
          include: { client: true }
        }
      }
    });

    // 2. Group by Client to avoid sending 5 emails to the same client for 5 CUPS
    const clientsMap = new Map<string, { email: string; name: string; cupsList: string[] }>();

    supplyPoints.forEach(sp => {
      const activeContract = sp.contracts.find(c => c.status === 'ACTIVO');
      const contract = activeContract || sp.contracts[0];
      if (!contract) return;
      
      const email = contract.client?.contactEmail || contract.client?.invoiceEmail || contract.client?.representativeEmail;
      if (!email || !email.includes('@')) return;

      const clientName = contract.client?.businessName || (contract.client?.firstName ? `${contract.client.firstName} ${contract.client.lastName}` : 'Cliente');
      
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
            <p>Hola ${client.name},</p>
            <p>${personalizedBody.replace(/\n/g, '<br/>')}</p>
            <br/>
            <p>Para cualquier duda que tengas, puedes ponerte en contacto con nosotros respondiendo a este email, o en el 900525826 o por Whatsapp <a href="https://wa.me/34900525826" style="color: #0056b3;">haciendo clic aqu&iacute;</a>.</p>
            <p>Gracias por confiar en nosotros,<br/><br/><strong>El Equipo AED Energ&iacute;a</strong></p>
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
