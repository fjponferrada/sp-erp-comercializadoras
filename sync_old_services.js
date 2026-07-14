const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando migración de servicios antiguos...");

  const service = await prisma.additionalService.findFirst({
    where: { name: { contains: 'Asesoramiento', mode: 'insensitive' } }
  });

  if (!service) {
    console.log("Servicio 'Asesoramiento energético' no encontrado en BBDD.");
    return;
  }
  
  console.log(`Servicio encontrado: ${service.name} (ID: ${service.id})`);

  const contracts = await prisma.contract.findMany({
    where: {
      airtableData: { not: null }
    },
    include: {
      additionalServices: true
    }
  });

  console.log(`Evaluando ${contracts.length} contratos...`);

  let updatedCount = 0;

  for (const c of contracts) {
    const data = c.airtableData;
    if (!data || typeof data !== 'object') continue;

    const servicioField = data['Servicio'];
    if (!servicioField) continue;

    // servicioField could be an array of strings or a single string
    let hasTargetService = false;
    const targetIds = ['recDNE5NjUQdbAOK5', 'rec4m16hzWuPSCFC7'];

    if (Array.isArray(servicioField)) {
      hasTargetService = servicioField.some(id => targetIds.includes(id));
    } else if (typeof servicioField === 'string') {
      hasTargetService = targetIds.some(id => servicioField.includes(id));
    }

    if (hasTargetService) {
      // Comprobar si ya lo tiene
      const alreadyConnected = c.additionalServices.some(s => s.id === service.id);
      
      let snapshot = c.additionalServicesSnapshot;
      let snapshotArr = [];
      if (snapshot && Array.isArray(snapshot)) {
        snapshotArr = snapshot;
      }

      const alreadyInSnapshot = snapshotArr.some(s => s.id === service.id);

      if (!alreadyConnected || !alreadyInSnapshot) {
        if (!alreadyInSnapshot) {
          snapshotArr.push({
            id: service.id,
            name: service.name,
            monthlyPrice: service.monthlyPrice,
            dailyPrice: service.dailyPrice,
            isCommissionable: service.isCommissionable
          });
        }

        await prisma.contract.update({
          where: { id: c.id },
          data: {
            additionalServices: {
              connect: [{ id: service.id }]
            },
            additionalServicesSnapshot: snapshotArr
          }
        });
        updatedCount++;
        console.log(`Contrato ${c.contractCode || c.id} actualizado.`);
      }
    }
  }

  console.log(`Proceso finalizado. Contratos actualizados: ${updatedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
