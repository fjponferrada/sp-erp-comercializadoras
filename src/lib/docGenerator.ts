import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export async function generateContractDocxBuffer(contractData: any, isB2B: boolean): Promise<Buffer> {
  const templateName = isB2B ? 'B2B.docx' : 'CORE.docx';
  const templatesDir = path.join(process.cwd(), 'public', 'templates');
  const templatePath = path.join(templatesDir, templateName);
  
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  if (!fs.existsSync(templatePath)) {
    console.warn(`Plantilla no encontrada en ${templatePath}. Devolviendo un archivo vacío por defecto.`);
    throw new Error(`Falta el archivo de plantilla ${templateName} en public/templates/`);
  }

  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  // Limpiar valores para que si son null/undefined pasen a string vacío
  const cleanData: any = {};
  for (const [key, value] of Object.entries(contractData)) {
    cleanData[key] = value !== null && value !== undefined ? String(value) : '';
  }

  doc.render(cleanData);

  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buf;
}

export async function generateModificationDocxBuffer(contractData: any, isTecnica: boolean): Promise<Buffer> {
  const templateName = isTecnica ? 'MODTEC.docx' : 'SUBROGACION.docx';
  const templatesDir = path.join(process.cwd(), 'public', 'templates');
  const templatePath = path.join(templatesDir, templateName);
  
  if (!fs.existsSync(templatePath)) {
    console.warn(`Plantilla no encontrada en ${templatePath}.`);
    throw new Error(`Falta el archivo de plantilla ${templateName} en public/templates/`);
  }

  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  const cleanData: any = {};
  for (const [key, value] of Object.entries(contractData)) {
    cleanData[key] = value !== null && value !== undefined ? String(value) : '';
  }

  doc.render(cleanData);

  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buf;
}
