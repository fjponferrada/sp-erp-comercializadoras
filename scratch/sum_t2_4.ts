import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2026_T2 (4).txt';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let totalIntegra = 0;
  let totalMinima = 0;
  
  content.trim().split('\n').forEach(line => {
    const parts = line.split(';');
    if (parts.length >= 12) {
      const integra = parseFloat(parts[10]) || 0;
      const minima = parseFloat(parts[11]) || 0;
      totalIntegra += integra;
      totalMinima += minima;
    }
  });

  console.log(`TXT Cuota Integra Total: ${totalIntegra.toFixed(2)}`);
  console.log(`TXT Cuota Minima Total: ${totalMinima.toFixed(2)}`);
  console.log(`Total Final: ${(totalIntegra + totalMinima).toFixed(2)}`);
} else {
  console.log('Fichero no encontrado');
}
