const fs = require('fs');

const path = 'prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// We want to add `airtableData Json?` before the closing brace if the model is one of the target ones.
const targetModels = ['Client', 'Lead', 'SupplyPoint', 'Contract', 'Invoice'];

let lines = content.split('\n');
let newLines = [];
let inDeleteBlock = false;
let currentModel = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
  if (modelMatch) {
    currentModel = modelMatch[1];
  }

  if (line.includes('// ---> NEW AIRTABLE FIELDS')) {
    inDeleteBlock = true;
    continue; // Skip this line
  }

  if (inDeleteBlock && line.trim() === '}') {
    inDeleteBlock = false;
    
    // We reached the end of the model. 
    // Add airtableData if applicable.
    if (targetModels.includes(currentModel)) {
      newLines.push('  airtableData Json?');
    }
    newLines.push('}');
    currentModel = null;
    continue;
  }

  if (inDeleteBlock) {
    continue; // Skip garbage columns
  }

  // If we reach the end of a model normally (without a delete block)
  if (line.trim() === '}') {
    if (targetModels.includes(currentModel)) {
      // Check if airtableData is already there
      const hasAirtableData = newLines.slice(-10).some(l => l.includes('airtableData'));
      if (!hasAirtableData) {
        newLines.push('  airtableData Json?');
      }
    }
    newLines.push('}');
    currentModel = null;
    continue;
  }

  newLines.push(line);
}

fs.writeFileSync(path, newLines.join('\n'));
console.log('Schema cleaned successfully.');
