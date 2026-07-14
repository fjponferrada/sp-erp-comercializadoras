import 'dotenv/config';
import municipiosJson from '../src/lib/municipios.json';

const set = new Set();
let count = 0;
for (const m of (municipiosJson as any[])) {
    const fullCode = `${m.parent_code}${String(m.code).padStart(3, '0')}`;
    if (!set.has(fullCode)) {
        set.add(fullCode);
        count++;
    }
}
console.log(`Unique fullCodes: ${count}`);
