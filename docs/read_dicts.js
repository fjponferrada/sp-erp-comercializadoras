const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Administrator/sp-erp-comercializadoras/docs';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

let output = '';

for (const file of files) {
  output += `# ${file}\n\n`;
  const workbook = XLSX.readFile(path.join(dir, file));
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (json.length > 0) {
    const headers = json[0];
    output += `| ${headers.join(' | ')} |\n`;
    output += `| ${headers.map(() => '---').join(' | ')} |\n`;
    for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (row.length > 0 && row.some(c => c !== undefined && c !== '')) {
            // pad row array to match headers length
            while (row.length < headers.length) {
                row.push('');
            }
            output += `| ${row.map(c => String(c).replace(/\n/g, ' ')).join(' | ')} |\n`;
        }
    }
  }
  output += '\n\n';
}

fs.writeFileSync(path.join(dir, 'dict_dump.md'), output);
console.log('Dumped to dict_dump.md');
