const fs = require('fs');

try {
  const filePath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\2-PRICING\\precios2024-2025.xls';
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist at:', filePath);
  } else {
    const buffer = Buffer.alloc(200);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 200, 0);
    fs.closeSync(fd);
    console.log('First 200 bytes as string:');
    console.log(buffer.toString('utf8'));
    console.log('First 200 bytes as hex:');
    console.log(buffer.toString('hex'));
  }
} catch (err) {
  console.error(err);
}
