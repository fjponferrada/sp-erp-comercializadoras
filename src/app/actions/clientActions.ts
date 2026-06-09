'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';

// Inicializamos Resend (requerirá RESEND_API_KEY en el .env)
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function updateClient(clientId: string, data: any) {
  try {
    const oldClient = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!oldClient) {
      throw new Error("Cliente no encontrado");
    }

    // Comprobamos si el IBAN ha cambiado
    const ibanChanged = data.iban && data.iban !== oldClient.iban;

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        businessName: data.businessName !== undefined ? data.businessName : oldClient.businessName,
        vatNumber: data.vatNumber !== undefined ? data.vatNumber : oldClient.vatNumber,
        contactEmail: data.contactEmail !== undefined ? data.contactEmail : oldClient.contactEmail,
        contactPhone: data.contactPhone !== undefined ? data.contactPhone : oldClient.contactPhone,
        billingAddress: data.billingAddress !== undefined ? data.billingAddress : oldClient.billingAddress,
        iban: data.iban !== undefined ? data.iban : oldClient.iban,
      }
    });

    // Automatización: Notificar al dpto financiero si cambió el IBAN
    if (ibanChanged) {
      console.log(`[AUTOMATIZACIÓN] IBAN modificado para ${updatedClient.businessName}. Enviando email a clientes@aed-energia.com...`);
      
      try {
        await resend.emails.send({
          from: 'crm@aed-energia.com', // Requiere dominio verificado en Resend
          to: 'clientes@aed-energia.com',
          subject: 'Cambio IBAN - ' + updatedClient.businessName,
          html: `
            <p><strong>${updatedClient.businessName}</strong>, con NIF <strong>${updatedClient.vatNumber}</strong> ha modificado su cuenta bancaria.</p>
            <p>Por favor, actualice en Sage y GoCardless.</p>
            <br/>
            <p><strong>Antiguo IBAN:</strong> ${oldClient.iban || 'Ninguno'}</p>
            <p><strong>Nuevo IBAN:</strong> <span style="color: blue; font-weight: bold;">${updatedClient.iban}</span></p>
          `
        });
        console.log("Email enviado con éxito.");
      } catch (emailError) {
        console.error("No se pudo enviar el email real (Falta configurar Resend), pero el trigger funcionó:", emailError);
      }
    }

    revalidatePath(`/clientes/${clientId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating client:", error);
    return { success: false, error: error.message };
  }
}
