const fs = require('fs');
const logPath = 'C:/Users/Administrator/.gemini/antigravity/brain/d9566af1-883c-4f44-9244-8c9d02c997ee/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for(let i=lines.length-1; i>=0; i--) {
  if (lines[i].includes('"type":"PLANNER_RESPONSE"') && lines[i].includes('DOMICILIO PS COMPLETO')) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.tool_calls && obj.tool_calls[0] && obj.tool_calls[0].name === 'replace_file_content' && obj.tool_calls[0].args.TargetFile.includes('NewLeadModal')) {
         fs.writeFileSync('recovered_newlead_replace.json', JSON.stringify(obj.tool_calls[0].args, null, 2));
         console.log('Recovered replace call to recovered_newlead_replace.json');
         break;
      }
    } catch(e) {}
  }
}
