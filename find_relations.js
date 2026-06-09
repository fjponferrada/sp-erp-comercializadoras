const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const lines = schema.split('\n');
let currentModel = '';
lines.forEach(line => {
    const matchModel = line.match(/^model\s+(\w+)\s+\{/);
    if (matchModel) {
        currentModel = matchModel[1];
    } else if (currentModel) {
        // Look for relation fields: `FieldName ModelName` or `FieldName ModelName[]`
        const matchField = line.match(/^\s+([A-Z]\w*)\s+(\w+)(\[\])?(\?|!)?\s+/);
        if (matchField) {
            console.log(`Model ${currentModel} -> has capitalized relation: ${matchField[1]} (${matchField[2]}${matchField[3] || ''})`);
        }
    }
    if (line.includes('}')) currentModel = '';
});
