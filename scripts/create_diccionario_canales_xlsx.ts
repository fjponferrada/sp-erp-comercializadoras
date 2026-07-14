import * as xlsx from 'xlsx';
import path from 'path';
import * as fs from 'fs';

async function run() {
  const txtPath = 'C:/Users/Administrator/tmp_backup/airtable-canales.txt';
  if (!fs.existsSync(txtPath)) {
      console.error(`File not found: ${txtPath}`);
      return;
  }
  
  const content = fs.readFileSync(txtPath, 'utf-8');
  const lines = content.split('\n');
  
  const fields: string[] = [];
  
  for (const line of lines) {
    const match = line.match(/^(.*?)(fld[a-zA-Z0-9]{14})/);
    if (match) {
      let fieldName = match[1].trim();
      if (fieldName && fieldName !== 'Field Name' && !fields.includes(fieldName)) {
        fields.push(fieldName);
      }
    }
  }
  
  if (fields.length > 0) {
    console.log(`Encontrados ${fields.length} campos en el archivo de texto.`);
    const rows = fields.map(f => {
        return {
            'Campo Airtable': f,
            'Descripción / Uso en el CRM': '',
            'Importado a Base de Datos': 'No'
        };
    });

    const worksheet = xlsx.utils.json_to_sheet(rows);
    
    // Auto-adjust column widths
    const wscols = [
        {wch: 30}, // Campo Airtable
        {wch: 60}, // Descripción
        {wch: 25}  // Importado
    ];
    worksheet['!cols'] = wscols;

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Diccionario CANALES");
    
    const outPath = path.resolve(process.cwd(), 'docs', 'diccionario_canales.xlsx');
    xlsx.writeFile(workbook, outPath);
    console.log("diccionario_canales.xlsx generado en " + outPath);
  } else {
    console.log("No se encontraron campos.");
  }
}

run().catch(console.error);
