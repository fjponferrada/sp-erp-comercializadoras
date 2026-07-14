const fs = require('fs');
const cheerio = require('cheerio');

try {
  const filePath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\2-PRICING\\precios2024-2025.xls';
  const buffer = fs.readFileSync(filePath);
  const content = buffer.toString('utf8');
  console.log('File size:', buffer.length);
  
  const $ = cheerio.load(content);
  const rows = $('tr');
  console.log('Number of tr found by cheerio:', rows.length);
  
  // Also let's print the first 500 characters of the file to see if there is a <table>
  console.log('First 500 chars:', content.substring(0, 500));
  
  // Try finding tables
  const tables = $('table');
  console.log('Number of tables:', tables.length);
} catch (err) {
  console.error(err);
}
