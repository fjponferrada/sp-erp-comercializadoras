'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function addDocumentAction(data: {
  name: string;
  type: string;
  url: string;
  sizeBytes: number;
  supplyPointId?: string;
  clientId?: string;
  contractId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const document = await prisma.document.create({
      data: {
        name: data.name,
        type: data.type,
        url: data.url,
        sizeBytes: data.sizeBytes,
        supplyPointId: data.supplyPointId || null,
        clientId: data.clientId || null,
        contractId: data.contractId || null,
      },
    });
    return { success: true, document };
  } catch (error: any) {
    console.error('Error adding document:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteDocumentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    await prisma.document.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return { success: false, error: error.message };
  }
}
