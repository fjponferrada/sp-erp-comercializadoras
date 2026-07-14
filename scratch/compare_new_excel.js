const XLSX = require('xlsx');

function main() {
    const provPath = 'C:/Users/Administrator/Desktop/Liquidacio_A2_26_06_2026_ES0031405446869086QD0F.xlsx';
    const erpPath = 'C:/Users/Administrator/Desktop/Desglose_Horario_ES0031405446869086QD0F_cmrf7f (3).xlsx';

    const provWb = XLSX.readFile(provPath);
    const provSheet = provWb.Sheets[provWb.SheetNames[0]];
    const provData = XLSX.utils.sheet_to_json(provSheet, { header: 1 });

    const erpWb = XLSX.readFile(erpPath);
    const erpSheet = erpWb.Sheets[erpWb.SheetNames[0]];
    const erpData = XLSX.utils.sheet_to_json(erpSheet, { header: 1 });

    const provDict = {};
    for (let i = 1; i < provData.length; i++) {
        const row = provData[i];
        if (!row || !row[0]) continue;
        const dateStr = row[0]; // e.g., 23/6/2026
        const hour = row[1]; // e.g., 1
        const omie = row[6]; // OMIE
        const servicio = row[7]; // Servicio
        const dateKey = `${dateStr}_${hour}`;
        provDict[dateKey] = { omie, servicio };
    }

    // ERP Header mapping
    const erpHeader = erpData[4]; // Row 5 is header in our new format
    let idxMap = {};
    if (erpHeader) {
        for (let i = 0; i < erpHeader.length; i++) {
            idxMap[erpHeader[i]] = i;
        }
    }

    console.log("Comparison for 5 different hours (June 23):\\n");
    console.log("| Fecha | Hora | OMIE Prov | OMIE ERP | Dif OMIE | Servicio Prov | Ajustes ERP | Dif Servicio | ERP PC3 | Suma Ajustes+PC3 |");
    console.log("|-------|------|-----------|----------|----------|---------------|-------------|--------------|---------|------------------|");

    let count = 0;
    for (let i = 5; i < erpData.length; i++) {
        const row = erpData[i];
        if (!row || !row[0] || row[0] === 'TOTALES') continue;
        const dateStr = row[0]; // 23/06/2026
        if (!dateStr.includes('23/06')) continue;

        const period = row[2]; // Period (1 to 24)
        
        // Find in provider (they use '23/6/2026' and hour 1-24)
        const dKey = `23/6/2026_${period}`;
        const pData = provDict[dKey];
        if (!pData) continue;

        const omieERP = row[idxMap['OMIE (€/MWh)']] || 0;
        const omieProv = pData.omie || 0;

        // Sum of our 11 columns
        const comps = ['RT3 (€/MWh)', 'RT6 (€/MWh)', 'CT2 (€/MWh)', 'CT3 (€/MWh)', 'BS3 (€/MWh)', 'RAD3 (€/MWh)', 'RAD1X (€/MWh)', 'BALX (€/MWh)', 'EXD (€/MWh)', 'IN7 (€/MWh)', 'CFP (€/MWh)'];
        let ajustesERP = 0;
        for (const c of comps) {
            ajustesERP += (row[idxMap[c]] || 0);
        }

        const capERP = row[idxMap['Capacidad (€/MWh)']] || 0; // PC3
        const servProv = pData.servicio || 0;

        const difOmie = Math.abs(omieProv - omieERP);
        const difServ = Math.abs(servProv - ajustesERP);
        const sumWithCap = ajustesERP + capERP;

        console.log(`| ${dateStr} | ${period} | ${omieProv.toFixed(3)} | ${omieERP.toFixed(3)} | ${difOmie.toFixed(3)} | ${servProv.toFixed(3)} | ${ajustesERP.toFixed(3)} | ${difServ.toFixed(3)} | ${capERP.toFixed(3)} | ${sumWithCap.toFixed(3)} |`);

        count++;
        if (count >= 5) break;
    }
}

main();
