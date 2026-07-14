const fs = require('fs');
const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f526eb47-95ff-4617-a744-510cff2d37aa\\.system_generated\\tasks\\task-18204.log';

const text = fs.readFileSync(logPath, 'utf-8');
const startIdx = text.indexOf('{\n  "c": {');

if (startIdx !== -1) {
    const data = JSON.parse(text.substring(startIdx));
    const { invoices } = data;
    
    invoices.sort((a,b) => new Date(a.billingStart).getTime() - new Date(b.billingStart).getTime());
    
    for (const inv of invoices) {
        const start = new Date(inv.billingStart).toISOString().split('T')[0];
        const end = new Date(inv.billingEnd).toISOString().split('T')[0];
        const days = (new Date(inv.billingEnd).getTime() - new Date(inv.billingStart).getTime()) / (1000*60*60*24);
        console.log(`Type: ${inv.invoiceType || 'Factura'}, Start: ${start}, End: ${end}, Days: ${days}, MWh: ${inv.totalMWh}`);
    }
}
