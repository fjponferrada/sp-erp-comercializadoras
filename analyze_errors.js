const fs = require('fs');
const errors = JSON.parse(fs.readFileSync('sync_errors.json', 'utf8'));

// Count how many errors of each type
const errorTypes = {};
const contractCodes = {};
let nullCodes = 0;
let duplicateCodes = 0;

for (const err of errors) {
  const msg = err.error.split('\n')[0];
  errorTypes[msg] = (errorTypes[msg] || 0) + 1;
  
  const code = err.fields['CONTRATO'] || null;
  if (code === null) {
    nullCodes++;
  } else {
    contractCodes[code] = (contractCodes[code] || 0) + 1;
  }
}

console.log('--- ERROR TYPES ---');
console.log(errorTypes);

console.log('\n--- CONTRACT CODES ---');
console.log('Null codes:', nullCodes);

const duplicates = Object.entries(contractCodes).filter(([k, v]) => v > 1);
console.log('Duplicate codes within the failing set:', duplicates.length);

// Let's also check if all failing ones have an empty or whitespace contract code
let whitespaceCodes = 0;
for (const err of errors) {
  const code = err.fields['CONTRATO'];
  if (typeof code === 'string' && code.trim() === '') {
    whitespaceCodes++;
  }
}
console.log('Whitespace codes:', whitespaceCodes);

// Let's just print the first 5 contract codes of the failing ones to see
console.log('\nFirst 5 failing contract codes:');
console.log(errors.slice(0, 5).map(e => e.fields['CONTRATO']));
