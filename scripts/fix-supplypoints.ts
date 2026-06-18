import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== INICIANDO SCRIPT DE SEPARACIÓN DE SUPPLY POINTS ===`);
  console.log(`Modo: ${isApply ? 'APPLY (Escritura)' : 'DRY-RUN (Simulación)'}`);
  
  const allContracts = await prisma.contract.findMany({
    include: {
      client: true,
      supplyPoint: true
    }
  });

  const corruptedContracts = allContracts.filter(c => c.clientId !== c.supplyPoint.clientId);

  console.log(`Contratos desvinculados de su propio Supply Point detectados: ${corruptedContracts.length}`);

  let createdSupplyPoints = 0;
  let linkedSupplyPoints = 0;

  for (const contract of corruptedContracts) {
    const correctClientId = contract.clientId;
    const cups = contract.supplyPoint.cups;
    
    // Ver si ya existe un supply point correcto para este cliente y cups
    const existingSp = await prisma.supplyPoint.findFirst({
      where: {
        cups: cups,
        clientId: correctClientId
      }
    });

    if (existingSp) {
      console.log(`[LINK] Contrato ${contract.id} (${contract.client.businessName || contract.client.firstName}) -> Apuntando a Supply Point existente correcto (${existingSp.id})`);
      if (isApply) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { supplyPointId: existingSp.id }
        });
      }
      linkedSupplyPoints++;
    } else {
      console.log(`[CLON] Contrato ${contract.id} (${contract.client.businessName || contract.client.firstName}) -> Clonando Supply Point ${cups} para asegurar privacidad`);
      if (isApply) {
        const newSp = await prisma.supplyPoint.create({
          data: {
            cups: contract.supplyPoint.cups,
            clientId: correctClientId,
            address: contract.supplyPoint.address,
            city: contract.supplyPoint.city,
            postalCode: contract.supplyPoint.postalCode,
            province: contract.supplyPoint.province,
            tariff: contract.supplyPoint.tariff,
            cnae: contract.supplyPoint.cnae,
            // Recuperamos el IBAN correcto del propio contrato. Si no lo tiene, es mejor dejarlo vacío a dejar el del otro cliente.
            iban: contract.iban || null,
            p1c: contract.supplyPoint.p1c,
            p2c: contract.supplyPoint.p2c,
            p3c: contract.supplyPoint.p3c,
            p4c: contract.supplyPoint.p4c,
            p5c: contract.supplyPoint.p5c,
            p6c: contract.supplyPoint.p6c,
            distributor: contract.supplyPoint.distributor,
            annualConsumption: contract.supplyPoint.annualConsumption,
          }
        });

        await prisma.contract.update({
          where: { id: contract.id },
          data: { supplyPointId: newSp.id }
        });
      }
      createdSupplyPoints++;
    }
  }

  console.log('--------------------------------------------------');
  console.log(`RESUMEN:`);
  console.log(`- Contratos corregidos: ${corruptedContracts.length}`);
  console.log(`- Supply Points clonados creados: ${createdSupplyPoints}`);
  console.log(`- Contratos re-vinculados a SP existentes: ${linkedSupplyPoints}`);
  if (!isApply) {
    console.log(`- Ningún dato fue modificado (DRY-RUN). Usa --apply para guardar los cambios.`);
  } else {
    console.log(`- CAMBIOS GUARDADOS EN BASE DE DATOS.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
