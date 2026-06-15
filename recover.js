const fs = require('fs');
const logPath = 'C:/Users/Administrator/.gemini/antigravity/brain/d9566af1-883c-4f44-9244-8c9d02c997ee/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for(let i=lines.length-1; i>=0; i--) {
  if (lines[i].includes('"type":"VIEW_FILE"') && lines[i].includes('NewLeadModal.tsx') && lines[i].includes('normProdType')) {
    try {
      const obj = JSON.parse(lines[i]);
      fs.writeFileSync('recovered_newlead.txt', obj.content);
      console.log('Recovered to recovered_newlead.txt');
      break;
    } catch(e) {}
  }
}
