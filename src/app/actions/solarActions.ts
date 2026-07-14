'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createSolarQuoteAction(data: any) {
  try {
    // Generar número de expediente único
    const count = await prisma.solarQuote.count();
    const quoteNumber = `AC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const quote = await prisma.solarQuote.create({
      data: {
        quoteNumber,
        clientName: data.clientName,
        clientLastName: data.clientLastName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        address: data.address,
        city: data.city,
        province: data.province,
        cups: data.cups,
        clientId: data.clientId || null,
        supplyPointId: data.supplyPointId || null,
        status: 'VIABILIDAD',
      }
    });

    revalidatePath('/autoconsumo');
    revalidatePath(`/clientes/${data.clientId}`);
    return { success: true, quote };
  } catch (error: any) {
    console.error("Error creating solar quote:", error);
    return { success: false, error: error.message };
  }
}

export async function updateSolarQuoteStatusAction(id: string, newStatus: string) {
  try {
    await prisma.solarQuote.update({
      where: { id },
      data: { status: newStatus }
    });
    revalidatePath('/autoconsumo');
    revalidatePath(`/autoconsumo/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateSolarQuoteDetailsAction(id: string, data: any) {
  try {
    await prisma.solarQuote.update({
      where: { id },
      data: {
        panelsCount: data.panelsCount ? parseInt(data.panelsCount) : undefined,
        panelPowerWp: data.panelPowerWp ? parseInt(data.panelPowerWp) : undefined,
        peakPowerKwp: data.peakPowerKwp ? parseFloat(data.peakPowerKwp) : undefined,
        inverter: data.inverter,
        inverterPower: data.inverterPower ? parseFloat(data.inverterPower) : undefined,
        totalBudget: data.totalBudget ? parseFloat(data.totalBudget) : undefined,
        subsidy: data.subsidy ? parseFloat(data.subsidy) : undefined,
        observations: data.observations,
      }
    });
    revalidatePath(`/autoconsumo/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
