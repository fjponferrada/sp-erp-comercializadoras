const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Recibidas\\Reene PPA\\Aljaval MSA 202694.xlsx';

const wb = xlsx.readFile(filePath);
const sheet = wb.Sheets['RB_VAL_PPA (2)'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

let minPrice = 1000;
let negativeCount = 0;

for (let i = 3; i < data.length; i++) {
    const row = data[i];
    const price = row[3]; // PRECIO OMIE
    if (typeof price === 'number') {
        if (price < minPrice) minPrice = price;
        if (price < 0) negativeCount++;
    }
}

console.log('Min Price in Excel:', minPrice);
console.log('Negative Price Count in Excel:', negativeCount);
