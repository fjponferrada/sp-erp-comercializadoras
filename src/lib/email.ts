import { Resend } from 'resend';

// Verifica que la API key esté presente
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Usamos el dominio verificado
const FROM_EMAIL = 'noreply@sp-energia.com'; 

const getAppUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_ENV === 'production') return 'https://ultra.sp-energia.com';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

export async function sendPasswordResetEmail(email: string, token: string) {
  const appUrl = getAppUrl();

  if (!resend) {
    console.error('RESEND_API_KEY no está configurada en las variables de entorno.');
    // Fallback silencioso para desarrollo si no hay key
    console.log(`[Email de prueba generado para ${email}]:`);
    console.log(`Enlace de reseteo: ${appUrl}/reset-password?token=${token}`);
    return { success: false, error: 'Servicio de email no configurado' };
  }

  const resetLink = `${appUrl}/reset-password?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `SP Energía ERP <${FROM_EMAIL}>`,
      to: [email],
      subject: 'Restablecer tu contraseña en SP Energía ERP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #111827; text-align: center;">SP Energía ERP</h2>
          <p style="color: #4b5563; font-size: 16px;">Hola,</p>
          <p style="color: #4b5563; font-size: 16px;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón inferior para elegir una nueva contraseña.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #DEFF9A; color: #0B0F19; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="color: #4b5563; font-size: 14px;">Este enlace expirará en 1 hora.</p>
          <p style="color: #4b5563; font-size: 14px;">Si no has solicitado este cambio, puedes ignorar este correo con seguridad.</p>
          <hr style="border-top: 1px solid #eaeaea; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} SP Energía. Todos los derechos reservados.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Error al enviar email con Resend:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error inesperado enviando email:', error);
    return { success: false, error: error.message };
  }
}
