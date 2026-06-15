const fs = require('fs');
const logPath = 'C:/Users/Administrator/.gemini/antigravity/brain/d9566af1-883c-4f44-9244-8c9d02c997ee/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');
let res = [];
for(let i=0; i<lines.length; i++) {
  if(lines[i].includes('DOMICILIO PS COMPLETO') && lines[i].includes('"type":"PLANNER_RESPONSE"')) {
    res.push(lines[i].substring(0, 500));
  }
}
fs.writeFileSync('debug.txt', res.join('\n'));
