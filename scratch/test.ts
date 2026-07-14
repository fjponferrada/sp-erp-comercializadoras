import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function test() {
  try {
    const draft = await prisma.internalInvoice.findFirst({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
    });
    
    if (!draft || !draft.f1InvoiceId) {
      console.log('No draft found');
      return;
    }
    
    const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, true, true);
    
    console.log(`totalBase: ${result.totalBase}`);
    console.log(`totalEnergyCost: ${result.energyCost}`);
    console.log(`ATR: ${result.peajesDistribuidora + result.cargosDistribuidora}`);
    console.log(`powerCost: ${result.powerCost}`);
    console.log(`alquilerEquipo: ${result.alquilerEquipo}`);
    console.log(`bonoSocial: ${result.bonoSocial}`);
    console.log(`taxElectric: ${result.taxElectric}`);
    console.log(`feeCost: ${result.feeCost}`);
    
  } catch (e: any) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
