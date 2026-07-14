const fs = require('fs');
const logPath = 'C:/Users/Administrator/.gemini/antigravity/brain/d9566af1-883c-4f44-9244-8c9d02c997ee/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');
let results = [];
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('"type":"PLANNER_RESPONSE"') && lines[i].includes('DOMICILIO PS COMPLETO')) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.tool_calls && obj.tool_calls[0] && obj.tool_calls[0].name === 'replace_file_content' && obj.tool_calls[0].args.TargetFile.includes('NewLeadModal')) {
         results.push(obj.tool_calls[0].args);
      }
    } catch(e) {}
  }
}
fs.writeFileSync('all_recovered.json', JSON.stringify(results, null, 2));
