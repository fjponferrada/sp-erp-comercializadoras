'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function registerClientUserAction(name: string, email: string, password: string) {
  // Validate if email belongs to any client
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { contactEmail: email },
        { invoiceEmail: email },
        { contactEmail2: email },
        { contactEmail3: email },
        { representativeEmail: email }
      ]
    }
  });

  if (!client) {
    return { error: 'El sistema es solo para clientes. La dirección de correo electrónico introducida no consta en nuestra base de datos.' };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: 'El usuario ya está registrado en el sistema. Por favor, inicia sesión.' };
  }

  // Create User
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CLIENT',
        brandId: client.brandId
      }
    });

    return { success: true };
  } catch (err: any) {
    return { error: 'Error interno al registrar el usuario: ' + err.message };
  }
}

import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail } from '@/lib/email';

export async function requestPasswordResetAction(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Devolvemos success incluso si no existe por seguridad (no enumeración de emails)
      return { success: true };
    }

    // Generar token único válido por 1 hora
    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    // Borrar tokens anteriores de este email
    await prisma.passwordResetToken.deleteMany({ where: { email } });

    // Guardar nuevo token
    await prisma.passwordResetToken.create({
      data: { email, token, expires }
    });

    // Enviar email
    const emailRes = await sendPasswordResetEmail(email, token);
    
    if (!emailRes.success) {
      return { error: 'No se pudo enviar el correo de recuperación. Inténtalo más tarde.' };
    }

    return { success: true };
  } catch (error: any) {
    return { error: 'Error interno: ' + error.message };
  }
}

export async function resetPasswordAction(token: string, newPassword: string) {
  try {
    // Buscar el token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return { error: 'El enlace de recuperación no es válido o ha expirado.' };
    }

    if (new Date() > resetToken.expires) {
      // Expirado, lo borramos para limpiar
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return { error: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' };
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword }
    });

    // Borrar el token ya usado
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    return { success: true };
  } catch (error: any) {
    return { error: 'Error interno al restablecer la contraseña: ' + error.message };
  }
}
