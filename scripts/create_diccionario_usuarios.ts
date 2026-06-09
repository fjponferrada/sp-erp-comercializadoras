import fetch from 'node-fetch';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function run() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/USUARIOS?maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  
  if (!res.ok) throw new Error("Error fetching Airtable");
  
  const data = await res.json();
  if (data.records.length > 0) {
    const fields = Object.keys(data.records[0].fields);
    
    let md = `# Diccionario de Campos: Tabla USUARIOS\n\n`;
    md += `Añade aquí las descripciones de los campos que vengan de Airtable para entender mejor su contexto futuro.\n\n`;
    md += `| Campo Airtable | Descripción / Uso en el CRM | Importado a Base de Datos |\n`;
    md += `| --- | --- | --- |\n`;
    
    for (const f of fields) {
        let imported = "No";
        if (['Email Link', 'Email', 'Nombre2', 'Nombre 2', 'Nombre', 'Código'].includes(f)) {
            imported = "Sí (Tabla User)";
        }
        md += `| **${f}** | *Escribe una descripción aquí* | ${imported} |\n`;
    }
    
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'diccionario_usuarios.md'), md);
    console.log("diccionario_usuarios.md generado en /docs");
  }
}

run().catch(console.error);
