import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2026_T2 (3).txt';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('--- CONTENIDO DEL FICHERO ---');
  console.log(content.trim());
} else {
  console.log('Fichero no encontrado');
}
