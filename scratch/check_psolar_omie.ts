import { prisma } from '../src/lib/prisma';

async function main() {
    const start = new Date('2026-05-31T22:00:00Z');
    const end = new Date('2026-06-30T22:00:00Z');
    
    // get pSolar
    const profiles = await prisma.reeProfile.findMany({
        where: { year: 2026, month: 6 }
    });
    
    // get OMIE
    const omie = await prisma.systemComponentPrice.findMany({
        where: { component: 'OMIE', date: { gte: start, lte: end } }
    });
    
    const omieMap = new Map();
    for (const p of omie) {
        for (let h=0; h<p.values.length; h++) {
            const dateStr = p.date.toISOString().substring(0, 10);
            const hourStr = String(h).padStart(2, '0');
            omieMap.set(`${dateStr}_${hourStr}`, p.values[h]);
        }
    }
    
    let sumWeight = 0;
    let sumOmieWeight = 0;
    
    for (let d = new Date(start); d < end; d.setHours(d.getHours() + 1)) {
        const localD = new Date(d.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }));
        const m = localD.getMonth() + 1;
        const dom = localD.getDate();
        let h = localD.getHours();
        if (h === 0) h = 24;
        
        const prof = profiles.find(r => r.month === m && r.day === dom && r.hour === h);
        const coef = prof?.pSolar || 0;
        
        const key = `${localD.toISOString().substring(0, 10)}_${String(localD.getHours()).padStart(2, '0')}`;
        const omieVal = omieMap.get(key) || 0;
        
        if (coef > 0) {
            sumWeight += coef;
            sumOmieWeight += (coef * omieVal);
            if (omieVal > 80) console.log(`High OMIE at ${key}: ${omieVal} with coef ${coef}`);
        }
    }
    
    console.log(`Avg OMIE with pSolar: ${sumOmieWeight / sumWeight}`);
}

main().finally(() => prisma.$disconnect());
