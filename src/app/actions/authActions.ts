'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail } from '@/lib/email';

function buildClientEmailOrFilter(cleanEmail: string) {
  return [
    { contactEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { invoiceEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail2: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail3: { equals: cleanEmail, mode: 'insensitive' as const } },
    { representativeEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
  ];
}

export async function registerClientUserAction(name: string, email: string, password: string) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanName || !cleanEmail || !cleanPassword) {
    return { error: 'Todos los campos son obligatorios.' };
  }

  if (cleanPassword.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  // Detectar si el portal se está abriendo bajo el dominio específico de una marca
  let hostBrandId: string | null = null;
  try {
    const headersList = await headers();
    let host = headersList.get('host') || '';
    if (host.includes(':')) host = host.split(':')[0];
    if (host) {
      const hostBrand = await prisma.brand.findFirst({
        where: { domain: host },
        select: { id: true },
      });
      hostBrandId = hostBrand?.id || null;
    }
  } catch {
    // Fallback si no hay cabeceras
  }

  const emailOr = buildClientEmailOrFilter(cleanEmail);

  // Validate if email belongs to any client (prioritizing host brand if matched)
  let client = hostBrandId
    ? await prisma.client.findFirst({
        where: { brandId: hostBrandId, OR: emailOr },
      })
    : null;

  if (!client) {
    client = await prisma.client.findFirst({
      where: { OR: emailOr },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!client) {
    return {
      error:
        'El sistema es solo para clientes. La dirección de correo electrónico introducida no consta en nuestra base de datos.',
    };
  }

  // Check if user already exists (case-insensitive)
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });
  if (existingUser) {
    return { error: 'El usuario ya está registrado en el sistema. Por favor, inicia sesión.' };
  }

  // Create User
  try {
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: 'CLIENT',
        isActive: true,
        brandId: client.brandId,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { error: 'Error interno al registrar el usuario: ' + err.message };
  }
}

export async function requestPasswordResetAction(email: string) {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { error: 'Introduce un correo electrónico válido.' };
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    });

    if (!user) {
      // Comprobar si existe como cliente (case-insensitive)
      const client = await prisma.client.findFirst({
        where: {
          OR: buildClientEmailOrFilter(cleanEmail),
        },
      });

      if (client) {
        return { error: 'not_registered_client' };
      } else {
        return { error: 'not_found' };
      }
    }

    if (user.isActive === false) {
      return {
        error: 'Esta cuenta se encuentra desactivada. Contacta con el soporte de tu comercializadora.',
      };
    }

    // Generar token único válido por 1 hora
    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    // Borrar tokens anteriores de este email
    await prisma.passwordResetToken.deleteMany({
      where: { email: { equals: user.email, mode: 'insensitive' } },
    });

    // Guardar nuevo token
    await prisma.passwordResetToken.create({
      data: { email: user.email, token, expires },
    });

    // Enviar email
    const emailRes = await sendPasswordResetEmail(user.email, token);

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
    const cleanPassword = (newPassword || '').trim();
    if (cleanPassword.length < 8) {
      return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    // Buscar el token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return { error: 'El enlace de recuperación no es válido o ha expirado.' };
    }

    if (new Date() > resetToken.expires) {
      // Expirado, lo borramos para limpiar
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return { error: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' };
    }

    const targetUser = await prisma.user.findFirst({
      where: { email: { equals: resetToken.email.trim(), mode: 'insensitive' } },
    });

    if (!targetUser) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return { error: 'No se ha encontrado el usuario asociado a este enlace.' };
    }

    if (targetUser.isActive === false) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return { error: 'Esta cuenta está desactivada y no puede restablecer su contraseña.' };
    }

    // Actualizar contraseña usando el ID primario exacto
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { password: hashedPassword },
    });

    // Borrar el token ya usado
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    return { success: true };
  } catch (error: any) {
    return { error: 'Error interno al restablecer la contraseña: ' + error.message };
  }
}
