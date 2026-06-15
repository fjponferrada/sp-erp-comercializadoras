import * as fs from 'fs';
import { parseSwitchingXml } from './src/lib/switching/parser';

try {
  const filePath = 'Z:\\AED\\Switching\\Recibidos\\Endesa\\0031_1713_C1_06_ES0031101654201001PA0F_01_006E.xml';
  const xmlString = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseSwitchingXml(xmlString);
  console.log("Parsed Output:", parsed);
} catch (e: any) {
  console.error("Error parsing:", e.message);
}
