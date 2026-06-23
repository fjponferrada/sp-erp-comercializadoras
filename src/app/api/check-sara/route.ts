import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const c = await prisma.client.findFirst({ where: { vatNumber: '02536257R' } });
  
  const contracts = await prisma.contract.findMany({ where: { clientId: c?.id } });
  const f = contracts[0]?.airtableData as any;

  return NextResponse.json({ 
    client: c, 
    airtableNames: f ? {
      'NOMBRE/RAZON SOCIAL': f['NOMBRE/RAZON SOCIAL'],
      'NOMBRERAZON SOCIAL': f['NOMBRERAZON SOCIAL'],
      'NOMBRE Y APELLIDOS': f['NOMBRE Y APELLIDOS'],
      'Primer Apellido': f['Primer Apellido'],
      'Segundo Apellido': f['Segundo Apellido'],
      'Nombre completo Titular': f['Nombre completo Titular']
    } : null
  });
}
