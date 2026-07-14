const fs = require('fs');

try {
  const content = fs.readFileSync('Z:\\AED\\Compras Energia\\SCRIPT FACTURACION PPA FIN\\FACT_PPA_FIN.py', 'utf8');
  console.log(content);
} catch (e) {
  console.error(e);
}
