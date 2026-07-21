const fs = require('fs');
const code = fs.readFileSync('src/app/actions/contractActions.ts', 'utf8');
const lines = code.split(/\r?\n/);

const newReturnStr = fs.readFileSync('scratch/contractActions.newReturn2.txt', 'utf8');
const newLines = newReturnStr.split(/\r?\n/);

const startStr = "return {";
const endStr = "    });";

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === startStr && lines[i-2] && lines[i-2].includes('formatDate')) {
    startIndex = i;
  }
}

for (let i = startIndex + 1; i < lines.length; i++) {
  if (lines[i] === endStr && lines[i+2] && lines[i+2].includes('success: true, data: exportData')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  lines.splice(startIndex, endIndex - startIndex, ...newLines);
  fs.writeFileSync('src/app/actions/contractActions.ts', lines.join('\n'), 'utf8');
  console.log('Replacement successful!');
} else {
  console.log('Indices not found:', startIndex, endIndex);
}
