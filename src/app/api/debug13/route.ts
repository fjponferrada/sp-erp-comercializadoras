import { prisma } from '@/lib/prisma';

export async function GET() {
  const c = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJP221171941A0F' },
    include: { client: true, supplyPoint: true }
  });
  return Response.json({
    code: c?.contractCode,
    tariff: c?.supplyPoint?.tariff,
    pStart: c?.permanenceStartDate,
    bDate: c?.terminationDate,
    cons: c?.supplyPoint?.annualConsumption,
    c_cons: c?.annualConsumption,
    airtable_cons: c?.airtableData?.['CONSUMO COMISION']
  });
}
