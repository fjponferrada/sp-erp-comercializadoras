const fs = require('fs');
const path = 'docs/BUSINESS_RULES.md';
let content = fs.readFileSync(path, 'utf8');

// Replace rule 11 content
const oldRule11 = `- **Creación de nuevos campos**: Si al revisar un diccionario o una tabla de Airtable se detecta que un campo no tiene un lugar en \`schema.prisma\` de PostgreSQL, **ES OBLIGATORIO** crear el campo nuevo en Prisma, hacer la migración de base de datos (\`db push\`), y actualizar el Excel del diccionario antes de ejecutar la importación. No se puede omitir ni un solo campo en los scripts de importación. Absolutamente todos los datos originales deben quedar guardados en PostgreSQL para que no haya pérdida de información ni descuadres con el SaaS o herramientas de terceros.`;
const newRule11 = `- **Uso del campo JSON \`airtableData\`**: Para cumplir con la regla del 100% sin ensuciar la base de datos relacional, todo el registro bruto de Airtable debe insertarse en el campo \`airtableData (JSON)\` de las entidades principales. **ESTÁ ESTRICTAMENTE PROHIBIDO** crear campos "basura" o crudos de Airtable directamente en \`schema.prisma\`. Los campos nativos de Prisma deben mantenerse limpios y los scripts de migración deben mapear los datos relevantes (como NIF, consumos) a estas columnas tipadas.`;

content = content.replace(oldRule11, newRule11);

// Remove rules 14 and 15
const rule14Index = content.indexOf('## 14. Mapeo de Leads Importados');
if (rule14Index !== -1) {
  content = content.substring(0, rule14Index).trim();
}

fs.writeFileSync(path, content, 'utf8');
console.log('BUSINESS_RULES.md updated successfully.');
