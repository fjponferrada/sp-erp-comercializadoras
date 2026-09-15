import fs from 'fs';
import { parseSwitchingXml } from './src/lib/switching/parser';

const xmlString = fs.readFileSync('test.xml', 'utf-8');
const parsed = parseSwitchingXml(xmlString);
console.log(JSON.stringify(parsed, null, 2));