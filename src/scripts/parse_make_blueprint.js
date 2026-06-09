const fs = require('fs');
const path = require('path');

const makePath = path.join('C:', 'Users', 'Administrator', 'tmp_backup', 'make-gencontrato.txt');
const content = fs.readFileSync(makePath, 'utf8');
const blueprint = JSON.parse(content);

// The blueprint is a JSON array or object. Usually Make blueprints have a "flow" or "modules" array.
// Let's print out the structure to understand it.
console.log('Keys:', Object.keys(blueprint));
console.log('Type of blueprint:', typeof blueprint, Array.isArray(blueprint));

if (Array.isArray(blueprint)) {
    console.log('First element keys:', Object.keys(blueprint[0]));
} else if (blueprint.flow) {
    console.log('Has flow');
}
