import fs from 'fs';
import path from 'path';

function findCsv(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory() && !full.includes('node_modules')) {
      findCsv(full);
    } else if (f.toUpperCase().endsWith('.CSV') && f.toUpperCase().includes('5D')) {
      console.log('Found:', full);
      const lines = fs.readFileSync(full, 'utf8').split('\n').slice(0, 5);
      console.log(lines.join('\n'));
    }
  }
}

findCsv(__dirname);
