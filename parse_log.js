const fs = require('fs');
const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f526eb47-95ff-4617-a744-510cff2d37aa\\.system_generated\\tasks\\task-18204.log';

const text = fs.readFileSync(logPath, 'utf-8');
const startIdx = text.indexOf('{\n  "c": {');

if (startIdx !== -1) {
    const data = JSON.parse(text.substring(startIdx));
    const { c, versions, invoices, rules } = data;
    
    let matchedRule = null;
    let bestSpecificity = -1;
    
    const p = c.product;
    const tarifa = p.tariff;
    const avgPower = ((c.p1c || 0) + (c.p2c || 0)) / 2;

    for (const rule of rules) {
        let match = true;
        let specificity = 0;

        if (rule.additionalServices.length > 0 && rule.products.length === 0 && !rule.tariff && !rule.productType) continue;

        if (rule.tariff) {
            if (rule.tariff !== tarifa) match = false;
            else specificity += 1;
        }
        if (rule.productType) {
            const rType = rule.productType;
            const pTypeStr = (p.type || '').toLowerCase();
            if (rType === 'Fijo') {
            if (!pTypeStr.includes('fijo')) match = false;
            else specificity += 1;
            } else if (rType === 'Indexado' || rType === 'Index') {
            if (!pTypeStr.includes('indexado')) match = false;
            else specificity += 1;
            } else {
            if (rType !== p.type) match = false;
            else specificity += 2;
            }
        }
        if (rule.powerMin !== null) {
            if (avgPower < rule.powerMin) match = false;
            else specificity += 1;
        }
        if (rule.powerMax !== null) {
            if (avgPower >= rule.powerMax) match = false;
            else specificity += 1;
        }
        if (rule.products && rule.products.length > 0) {
            if (!rule.products.some(rp => rp.id === p.id)) match = false;
            else specificity += 100;
        }

        if (match && specificity > bestSpecificity) {
            matchedRule = rule;
            bestSpecificity = specificity;
        }
    }

    console.log('--- DB DATA ---');
    console.log('Contract:', c.contractCode);
    console.log('Product:', p.name, 'Tariff:', p.tariff, 'Type:', p.type);
    console.log('P1C-P6C:', c.p1c, c.p2c, c.p3c, c.p4c, c.p5c, c.p6c);
    console.log('IP1-IP6:', p.ip1, p.ip2, p.ip3, p.ip4, p.ip5, p.ip6);
    console.log('MarginFC:', p.marginFC);
    
    let totalMWh = 0;
    let totalBillingDays = 0;
    for (const inv of invoices) {
        const days = (new Date(inv.billingEnd).getTime() - new Date(inv.billingStart).getTime()) / (1000*60*60*24);
        const isAbono = (inv.invoiceType || '').toLowerCase().includes('abono');
        totalBillingDays += isAbono ? -days : days;
        
        let mwh = inv.totalMWh; // before fix, no division by 1000
        mwh = isAbono ? -Math.abs(mwh) : mwh;
        totalMWh += mwh;
    }
    console.log('Total billing days:', totalBillingDays);
    console.log('Total invoice raw value (was considered MWh before bugfix):', totalMWh);
    
    let dailyMWh = totalMWh / totalBillingDays;
    console.log('Daily extrapolated MWh:', dailyMWh);

    const billableDays = 356;
    const extrapolatedConsumo = dailyMWh * billableDays;
    console.log('Extrapolated Consumo (MWh):', extrapolatedConsumo);
    const energyMargin = extrapolatedConsumo * (p.marginFC || 0);
    console.log('Energy Margin (€):', energyMargin);

    let powerMargin = 0;
    const marginV = (c.p1c||0)*p.ip1 + (c.p2c||0)*p.ip2 + (c.p3c||0)*p.ip3 + (c.p4c||0)*p.ip4 + (c.p5c||0)*p.ip5 + (c.p6c||0)*p.ip6;
    console.log('Base Power Margin per year:', marginV);
    powerMargin = marginV * (billableDays/365);
    console.log('Power Margin for billable days:', powerMargin);

    console.log('--- RULES ---');
    console.log('Matched Rule Spec:', bestSpecificity);
    if (matchedRule) {
        console.log('Rule:', matchedRule.commissionType, matchedRule.value, matchedRule.tariff, matchedRule.productType);
        
        let comisionReal = 0;
        if (matchedRule.commissionType === 'FIXED') {
            comisionReal = matchedRule.value * (billableDays / 365);
        } else if (matchedRule.commissionType === 'PERCENTAGE') {
            comisionReal = (energyMargin + powerMargin) * (matchedRule.value / 100);
        }
        console.log('Comisión Real sin Servicios:', comisionReal);
    }
}
