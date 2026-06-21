const fs = require('fs');
const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f526eb47-95ff-4617-a744-510cff2d37aa\\.system_generated\\tasks\\task-18204.log';

const text = fs.readFileSync(logPath, 'utf-8');
const startIdx = text.indexOf('{\n  "c": {');

if (startIdx !== -1) {
    const data = JSON.parse(text.substring(startIdx));
    const { c, invoices } = data;
    const p = c.product;
    
    let totalMWh = 0;
    let totalBillingDays = 0;
    for (const inv of invoices) {
        const days = Math.round((new Date(inv.billingEnd).getTime() - new Date(inv.billingStart).getTime()) / (1000*60*60*24)) + 1;
        const isAbono = (inv.invoiceType || '').toLowerCase().includes('abono');
        totalBillingDays += isAbono ? -days : days;
        
        let mwh = inv.totalMWh; 
        mwh = isAbono ? -Math.abs(mwh) : mwh;
        totalMWh += (mwh/1000); // FIX: Divide by 1000
    }
    
    let dailyMWh = totalMWh / totalBillingDays;
    const billableDays = 356;
    const extrapolatedConsumo = dailyMWh * billableDays;
    const energyMargin = extrapolatedConsumo * 20;
    const comisionReal = energyMargin * 0.7;

    console.log('--- NEW LOGIC TEST ---');
    console.log('Total billing days (fixed):', totalBillingDays);
    console.log('Total invoice real MWh (fixed):', totalMWh);
    console.log('Daily extrapolated MWh:', dailyMWh);
    console.log('Extrapolated Consumo (MWh):', extrapolatedConsumo);
    console.log('Energy Margin (€):', energyMargin);
    console.log('Comisión Real sin Servicios (70%):', comisionReal);
}
