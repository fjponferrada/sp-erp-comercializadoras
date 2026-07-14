import { prisma } from './src/lib/prisma';

async function main() {
  const fixedPrice = 0.129999;
  console.log(`Precio pactado (Fijo): ${fixedPrice} €/kWh`);
  
  // 2025 values from DB
  const atr2025 = {
    P3: 0.004673 + 0.013001,
    P4: 0.002682 + 0.006501,
    P6: 0.000031 + 0.002600
  };
  
  // 2026 values from DB
  const atr2026 = {
    P3: 0.004943 + 0.014336,
    P4: 0.002627 + 0.007168,
    P6: 0.000031 + 0.002867
  };

  const providerActive = {
    P3: 0.113591,
    P4: 0.122087,
    P6: 0.128656
  };

  for (const p of ['P3', 'P4', 'P6']) {
    const a25 = atr2025[p as keyof typeof atr2025];
    const a26 = atr2026[p as keyof typeof atr2026];
    const diff = a26 - a25;
    const erpActive = fixedPrice - a25;
    const erpTotal = fixedPrice - a25 + a26;
    
    console.log(`\n--- PERIODO ${p} ---`);
    console.log(`ATR 2025: ${a25.toFixed(6)} €/kWh`);
    console.log(`ATR 2026: ${a26.toFixed(6)} €/kWh`);
    console.log(`Variación ATR: ${diff > 0 ? '+' : ''}${diff.toFixed(6)} €/kWh`);
    
    console.log(`\nCálculo ERP:`);
    console.log(`Energía Activa ERP (Precio Pactado - ATR 2025): ${fixedPrice} - ${a25.toFixed(6)} = ${erpActive.toFixed(6)} €/kWh`);
    console.log(`Precio Total Final ERP (Energía Activa + ATR 2026): ${erpTotal.toFixed(6)} €/kWh`);
    
    console.log(`\nFactura Proveedor:`);
    console.log(`Energía Activa Proveedor: ${providerActive[p as keyof typeof providerActive].toFixed(6)} €/kWh`);
    console.log(`Diferencia en Energía Activa (Proveedor - ERP): ${(providerActive[p as keyof typeof providerActive] - erpActive).toFixed(6)} €/kWh`);
  }
}

main().catch(console.error);
