const fs = require('fs');

const file1 = 'C:\\tmp\\reganecu\\C2_reganecu_20260301_18X000000000O0IA';
const content1 = fs.readFileSync(file1, 'utf-8');

const lines = content1.split('\n');
const results = {};

lines.forEach(line => {
  const parts = line.split(';');
  if (parts.length < 15) return; // skip header
  
  const dateStr = parts[0];
  const hour = parts[1];
  const unit = parts[2];
  const energy = parseFloat(parts[3]) || 0;
  const price = parseFloat(parts[5]) || 0;
  const cost = parseFloat(parts[7]) || 0;
  const concept = parts[10];
  const upr = parts[12];
  
  if (!results[concept]) {
    results[concept] = 0;
  }
  results[concept] += cost;
});

console.log("Reganecu Hourly (Cost sums for 2026-03-01):");
console.log(JSON.stringify(results, null, 2));

const file2 = 'C:\\tmp\\reganecu\\C2_liquidia_20260301_18X000000000O0IA';
const content2 = fs.readFileSync(file2, 'utf-8');
const lines2 = content2.split('\n');
const results2 = {};

lines2.forEach(line => {
  const parts = line.split(';');
  if (parts.length < 10) return;
  
  const type = parts[0]; // C, E, R, T
  if (type === 'T') {
     // Total row?
  }
  
  // Concept is at index 14 for liquidia, wait, let's find it
  let concept = '';
  if (parts.length >= 15) {
     concept = parts[14];
  } else if (parts.length >= 14) {
     concept = parts[13];
  }
  
  // let's just collect all numbers to see
  const nums = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
  
  if (!results2[concept]) results2[concept] = [];
  results2[concept].push(nums);
});

console.log("\nLiquidia (All numbers):");
console.log(JSON.stringify(results2, null, 2));
