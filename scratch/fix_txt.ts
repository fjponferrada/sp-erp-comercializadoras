import * as fs from 'fs';

try {
  // Fix Abril_Mayo
  let am = fs.readFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5.txt', 'utf8');
  let lines = am.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('SBFO;')) {
      let parts = lines[i].split(';');
      // Cuota is index 10
      parts[10] = (parseFloat(parts[10]) - 4.44).toFixed(2);
      // Minimo is index 11
      parts[11] = (parseFloat(parts[11]) - 0.30).toFixed(2);
      lines[i] = parts.join(';');
    }
  }
  fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5_CORREGIDO.txt', lines.join('\n'));

  // Fix Consolidated
  let cons = fs.readFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2 (4).txt', 'utf8');
  let linesCons = cons.split('\n');
  for (let i = 0; i < linesCons.length; i++) {
    if (linesCons[i].startsWith('SBFO;')) {
      let parts = linesCons[i].split(';');
      parts[10] = (parseFloat(parts[10]) - 4.44).toFixed(2);
      parts[11] = (parseFloat(parts[11]) - 0.30).toFixed(2);
      linesCons[i] = parts.join(';');
    }
  }
  fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_CORREGIDO.txt', linesCons.join('\n'));
  
  console.log("TXTs corrected successfully.");
} catch (e) {
  console.error(e);
}
