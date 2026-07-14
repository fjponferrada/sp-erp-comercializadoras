const fs = require('fs');

try {
  const filePath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\2-PRICING\\precios2024-2025.xls';
  const buffer = fs.readFileSync(filePath);
  const content = buffer.toString('utf8');
  console.log(content.substring(500, 2000));
} catch (err) {
  console.error(err);
}
