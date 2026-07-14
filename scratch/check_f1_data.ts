import { prisma } from '../src/lib/prisma';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: 'ES0031101499771003GD0F' } },
    orderBy: { fechaEmision: 'desc' }
  });
  
  if (f1) {
    const jsonData = f1.jsonData as any;
    console.log("Activa: ", JSON.stringify(jsonData?.EnergiaActiva, null, 2));
    console.log("Reactiva: ", JSON.stringify(jsonData?.EnergiaReactiva, null, 2));
    console.log("Potencias: ", JSON.stringify(jsonData?.Potencias, null, 2));
  } else {
    console.log("No F1 found");
  }
}

main().catch(console.error);
