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

function extractClientFirstName(client: any) {
  if (!client) return 'Cliente';
  if (client.firstName) return client.firstName;
  
  const fullName = client.businessName || '';
  if (client.clientType !== 'FISICA') return fullName;
  
  const apellidos = client.lastName;
  
  if (apellidos && fullName.toLowerCase().includes(apellidos.toLowerCase())) {
    const regex = new RegExp(apellidos, 'i');
    const extracted = fullName.replace(regex, '').trim();
    if (extracted) return extracted;
  }

  return fullName || 'Cliente';
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
          include: { client: { include: { brand: true } } }
        }
      }
    });

    // 2. Group by Client to avoid sending 5 emails to the same client for 5 CUPS
    const clientsMap = new Map<string, { email: string; name: string; rawClient: any; cupsList: string[]; brand: any }>();

    supplyPoints.forEach(sp => {
      const activeContract = sp.contracts.find(c => c.status === 'ACTIVO');
      const contract = activeContract || sp.contracts[0];
      if (!contract) return;
      
      const email = contract.client?.contactEmail || contract.client?.invoiceEmail || contract.client?.representativeEmail;
      if (!email || !email.includes('@')) return;

      const clientName = extractClientFirstName(contract.client);
      
      if (!clientsMap.has(email)) {
        clientsMap.set(email, { email, name: clientName, rawClient: contract.client, cupsList: [], brand: contract.client?.brand });
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

        const brand = client.brand;
        const brandName = brand?.name || 'AED Energía';
        const brandColor = brand?.accentColor || '#4F46E5';
        const fromEmail = brand?.supportEmail 
          ? `${brandName} <${brand.supportEmail}>` 
          : `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`;
        
        let contactMethods = `respondiendo a este email`;
        if (brand?.whatsappPhone || brand?.phone) {
          contactMethods += `, o `;
          const methods = [];
          if (brand?.phone) methods.push(`en el <a href="tel:${brand.phone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">${brand.phone}</a>`);
          if (brand?.whatsappPhone) methods.push(`por Whatsapp <a href="https://wa.me/${brand.whatsappPhone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">haciendo clic aquí</a>`);
          contactMethods += methods.join(' o ');
        }

        const logoUrl = brand?.invoiceLogoUrl || brand?.logoUrl;
        const logoHtml = logoUrl 
          ? `<div style="text-align: left; margin-top: 40px;"><img src="${logoUrl}" alt="${brandName}" style="max-height: 80px;" /></div>`
          : '';

        const fullHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #333;">
            <p>Hola <b>${client.name}</b>,</p>
            ${personalizedBody}
            <br/>
            <p>Para cualquier duda que tengas, puedes ponerte en contacto con nosotros ${contactMethods}.</p>
            <p>Gracias por confiar en nosotros,</p>
            <p><b>El Equipo ${brandName}</b></p>
            ${logoHtml}
          </div>
        `;

        return {
          from: fromEmail,
          to: [client.email],
          subject: subject,
          html: fullHtml
        };
      });

      const { data, error } = await resend.batch.send(emailPayloads);
      
      if (error) {
        console.error('Resend batch send error:', error);
        return { success: false, error: error.message || JSON.stringify(error) };
      }

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
