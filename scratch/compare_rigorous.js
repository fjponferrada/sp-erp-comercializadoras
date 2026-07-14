const fs = require('fs');
const xlsx = require('xlsx');

const providerCsvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";
const ourExcelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf31.xlsx";

try {
  const providerContent = fs.readFileSync(providerCsvPath, 'utf8');
  const providerLines = providerContent.split('\n');

  const ourWb = xlsx.readFile(ourExcelPath);
  const ourWs = ourWb.Sheets[ourWb.SheetNames[0]];
  const ourData = xlsx.utils.sheet_to_json(ourWs, { header: 1, raw: false });

  console.log("=== RIGOROUS COMPARISON FOR JUNE 1st 2026 ===");

  const targetHours = [2, 10, 15, 20]; // 02:00, 10:00, 15:00, 20:00

  targetHours.forEach(hour => {
    console.log(`\n================ HOUR ${hour}:00 ================`);
    
    // Find provider row (1st quarter of that hour)
    let pOmie, pOs, pRestr, pPc, pDsv, pFnee, pFee, pKest, pLoss, pFinal;
    let foundProv = false;
    for (let i = 16; i < providerLines.length; i++) {
      let line = providerLines[i].trim();
      if (!line) continue;
      let cols = line.split(';');
      // cols[8] is Date, cols[9] is Hour (0-23)
      if (cols[8] === '01/06/2026' && parseInt(cols[9], 10) === hour) {
        // Only taking the first quarter (cols[10] === '1')
        if (cols[10] === '1') {
          pOmie = parseFloat(cols[13].replace(',', '.'));
          // In provider: OS is 16,5? No, 16.5 is in Col 16 (Coef BOE?). Let's recall:
          // 13: OMIE
          // 14: 0
          // 15: 26,919207 (Restricciones? OS?)
          // 16: 16,5 (Coef. BOE)
          // 17: 2,658 (FNEE)
          // 18: 0,20332
          // 19: 0,0407
          // 20: 2,5 (DSV)
          // 21: 0
          // 22: 7 (FEE)
          // 23: 0
          // 24: 0,91792 (Kest)
          // 25: 1,151457 (Loss Factor)
          // 26: 149,040224 (Mercado Base)
          // 27: 161,114948 (P.Final)
          console.log(`[PROVIDER RAW COLS]`);
          console.log(`OMIE: ${cols[13]} | Col15(OS?): ${cols[15]} | Col16(BOE): ${cols[16]} | FNEE: ${cols[17]} | Col18: ${cols[18]} | Col19: ${cols[19]} | DSV: ${cols[20]} | FEE: ${cols[22]} | Kest: ${cols[24]} | LossF: ${cols[25]} | BaseMerc: ${cols[26]} | PFinal: ${cols[27]}`);
          foundProv = true;
          break;
        }
      }
    }
    if (!foundProv) console.log("Provider row not found");

    // Find our row
    let foundOurs = false;
    ourData.forEach(row => {
      // Date: row[0], Time: row[1]
      if ((String(row[0]) === '1/6/2026' || String(row[0]) === '01/06/2026')) {
        let rowHour = parseInt(String(row[1]).split(':')[0], 10);
        let rowMin = String(row[1]).split(':')[1];
        if (rowHour === hour && rowMin === '00') {
          console.log(`\n[OUR ENGINE RAW COLS]`);
          // 4: OMIE, 5: OS, 6: OM, 7: Restricciones, 8: Capacidad, 9: DSV
          // 10: K, 11: Coef. BOE, 12: Pérdidas (%), 13: Factor Pérdidas
          // 14: Mercado Base, 15: FNEE, 16: FEE, 17: ATR
          // 18: Precio Final Ph
          console.log(`OMIE: ${row[4]} | OS: ${row[5]} | OM: ${row[6]} | RESTR: ${row[7]} | CAP: ${row[8]} | DSV: ${row[9]}`);
          console.log(`K: ${row[10]} | BOE: ${row[11]} | PERD%: ${row[12]} | LossF: ${row[13]}`);
          console.log(`BaseMerc: ${row[14]} | FNEE: ${row[15]} | FEE: ${row[16]} | ATR: ${row[17]} | PFinal: ${row[18]}`);
          foundOurs = true;
        }
      }
    });
    if (!foundOurs) console.log("Our row not found");
  });

} catch (e) {
  console.error(e);
}
