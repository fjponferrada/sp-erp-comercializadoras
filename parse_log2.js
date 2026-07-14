const fs = require('fs');
const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f526eb47-95ff-4617-a744-510cff2d37aa\\.system_generated\\tasks\\task-18204.log';

const text = fs.readFileSync(logPath, 'utf-8');
const startIdx = text.indexOf('{\n  "c": {');

if (startIdx !== -1) {
    const data = JSON.parse(text.substring(startIdx));
    const { c } = data;
    console.log('Commission Final:', c.commissionFinal);
    console.log('Annual Consumption SP:', c.supplyPoint?.annualConsumption);
}
