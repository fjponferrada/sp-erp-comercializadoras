import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { getUserVisibilityFilter } from '@/lib/permissions'
import LeadsClient, { LeadData } from './LeadsClient'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const visibilityFilter = await getUserVisibilityFilter();

  const leadsDB = await prisma.lead.findMany({
    where: visibilityFilter,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      documents: true,
      user: true,
      contract: true
    }
  });

  // Extraer las direcciones de los puntos de suministro nativos
  const cupsList = leadsDB.map(l => l.cups).filter(Boolean) as string[];
  const supplyPoints = await prisma.supplyPoint.findMany({
    where: { cups: { in: cupsList } },
    select: { cups: true, address: true }
  });
  const spMap = new Map(supplyPoints.map(sp => [sp.cups, sp.address]));

  // Mapeamos el Lead de base de datos a la estructura que requiere LeadsClient
  const mappedLeads: LeadData[] = leadsDB.map(l => {
    let direccion = l.cups ? spMap.get(l.cups) || 'Pendiente' : 'Pendiente';
    let fechaRegistro = l.createdAt.toISOString();
    let comercialName = l.user?.name || 'Sistema';
    let canalName = l.source || 'Directo';
    let cupsDisplay = l.cups || '';

    // Datos extraídos de contractData si existen
    if (l.contractData && typeof l.contractData === 'object') {
      const data = l.contractData as any;
      if ('DOMICILIO PS COMPLETO' in data) direccion = data['DOMICILIO PS COMPLETO'];
      else if ('DOMICILIO PS' in data) direccion = data['DOMICILIO PS'];
      else if ('DOMICILIO SOC' in data) direccion = data['DOMICILIO SOC'];
      else if ('direccion' in data) direccion = data.direccion;
    }

    const airtableData = l.airtableData as any || null;
    const isImported = !!airtableData;

    if (isImported) {
      // Dirección suministro
      if (airtableData['DOMICILIO PS COMPLETO']) direccion = airtableData['DOMICILIO PS COMPLETO'];
      else if (airtableData['DOMICILIO PS']) direccion = airtableData['DOMICILIO PS'];

      // Fecha Registro
      if (airtableData['Fecha Registro']) fechaRegistro = new Date(airtableData['Fecha Registro']).toISOString();

      // CUPS
      if ((!cupsDisplay || cupsDisplay.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) {
        cupsDisplay = airtableData['CUPS2'];
      }

      // Canal (Airtable)
      if (airtableData['CANAL'] && airtableData['CANAL'] !== '') {
        canalName = Array.isArray(airtableData['CANAL']) ? airtableData['CANAL'][0] : airtableData['CANAL'];
      }
      
      // Si el canal tiene nombre de persona y comercial no, intercambiamos o usamos ambos
      if (canalName !== 'Directo' && !airtableData['Comercial']) {
          // Si el comercial está vacío, a veces Airtable lo metió en canal
          comercialName = canalName;
      }
    }

    return {
      id: l.id,
      titular: l.businessName,
      empresa: l.businessName,
      nif: l.vatNumber || 'Pendiente',
      cups: cupsDisplay,
      tarifa: l.tariff || '2.0TD',
      status: l.status || 'NUEVO',
      canal: canalName,
      comercial: comercialName,
      fechaRegistro: fechaRegistro,
      comisionEst: l.estimatedMWh ? l.estimatedMWh * 15 : 0, // Estimación provisional
      sipsOk: l.cups || cupsDisplay ? true : false,
      potencia: 'Varios',
      documentsCount: l.documents.length,
      rawLead: l as any,
      type: l.type,
      address: direccion,
      contractId: l.contractId || undefined,
      contractCode: l.contract?.contractCode || (l.contractData as any)?.['CONTRATO'] || undefined
    };
  })

  return <LeadsClient initialLeads={mappedLeads} />
}
