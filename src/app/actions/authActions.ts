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
