const fs = require('fs');
const path = require('path');
const xlsx = require('C:/Users/Administrator/tmp_backup/node_modules/xlsx');

const docsDir = path.join(__dirname, 'docs');
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

for (const file of files) {
    const wb = xlsx.readFile(path.join(docsDir, file));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = xlsx.utils.sheet_to_csv(sheet);
    fs.writeFileSync(path.join(docsDir, file.replace('.xlsx', '.txt')), csv);
    console.log(`Converted ${file} to TXT`);
}
