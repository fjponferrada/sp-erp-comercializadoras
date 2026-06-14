import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function generateContractPdfBuffer(contractData: any, isB2B: boolean): Promise<Buffer> {
  const templateName = isB2B ? 'B2B.pdf' : 'CORE.pdf';
  const templatePath = path.join(process.cwd(), 'public', 'templates', templateName);
  
  if (!fs.existsSync(templatePath)) {
    console.warn(`Plantilla no encontrada en ${templatePath}. Devolviendo PDF vacío por defecto.`);
    // Return an empty PDF just so it doesn't crash before they upload it
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText(`Plantilla PDF no encontrada.`, { x: 50, y: 750, size: 14 });
    page.drawText(`Por favor, guarde su PDF con formulario en:`, { x: 50, y: 720, size: 12 });
    page.drawText(`public/templates/${templateName}`, { x: 50, y: 690, size: 12 });
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  const existingPdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  // Rellenar campos iterando sobre contractData
  for (const [key, value] of Object.entries(contractData)) {
    try {
      const field = form.getTextField(key);
      if (field && value !== undefined && value !== null) {
        field.setText(String(value));
      }
    } catch (e) {
      // El campo no existe en el PDF o no es un campo de texto, lo ignoramos
    }
  }

  // Aplanar el formulario para que no se pueda modificar después
  form.flatten();
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

