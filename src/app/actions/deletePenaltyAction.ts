'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function deletePenaltyInvoiceAction(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    // Find the invoice and its contract
    const invoice = await prisma.penaltyInvoice.findUnique({
      where: { id }
    });

    if (!invoice) return { success: false, error: 'Invoice not found' };

    // Update the contract to revert the status
    await prisma.contract.update({
      where: { id: invoice.contractId },
      data: {
        penaltyStatus: 'PENDIENTE'
      }
    });

    // Delete the invoice record
    await prisma.penaltyInvoice.delete({
      where: { id }
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
