const fs = require('fs');

try {
  const fileContent = fs.readFileSync('Z:\\AED\\Compras Energia\\SCRIPT FACTURACION PPA FIN\\BD_OMIE.csv', 'utf8');
  const lines = fileContent.split('\n').slice(0, 10); // get first 10 lines
  console.log(lines.join('\n'));
} catch (e) {
  console.error(e);
}
