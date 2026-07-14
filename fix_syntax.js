const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('\\`') || content.includes('\\${')) {
    content = content.replace(/\\`/g, '`');
    content = content.replace(/\\\${/g, '${');
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
    changedCount++;
  }
}
console.log('Total files fixed:', changedCount);
