"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var filePath = 'src/scripts/calculate_pending_energy.ts';
var content = fs.readFileSync(filePath, 'utf8');
if (!content.includes('import { getPeriodoREE }')) {
    content = content.replace("import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';", "import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';\nimport { getPeriodoREE } from '../lib/services/InternalBillingEngine';");
}
var findTarget1 = "component: { in: ['OS', 'RESTRICCIONES', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }";
var replaceTarget1 = "component: { in: ['OS', 'RESTRICCIONES', 'K', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }";
content = content.replace(findTarget1, replaceTarget1);
var findTarget2 = "  const pricesByDateComponent = new Map<string, number[]>();\n  for (const price of prices) {\n    const dayKey = format(price.date, 'yyyy-MM-dd');\n    pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);\n  }";
var replaceTarget2 = "  const pricesByDateComponent = new Map<string, number[]>();\n  for (const price of prices) {\n    const dayKey = format(price.date, 'yyyy-MM-dd');\n    pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);\n  }\n\n  // Fetch BOE Perdidas from RegulatedCost\n  const perdidasBOE = await prisma.regulatedCost.findMany({\n    where: { concept: 'PERDIDAS' }\n  });\n  const boeByTariff = new Map<string, any>();\n  for (const b of perdidasBOE) {\n    boeByTariff.set(b.tariff, b);\n  }";
content = content.replace(findTarget2, replaceTarget2);
var findTarget3 = "      const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`) || Array(24).fill(0);\n      const perd30 = pricesByDateComponent.get(`${dayKey}_PERD_30TD`) || Array(24).fill(0);\n      const perd61 = pricesByDateComponent.get(`${dayKey}_PERD_61TD`) || Array(24).fill(0);";
var replaceTarget3 = "      const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`);\n      const perd30 = pricesByDateComponent.get(`${dayKey}_PERD_30TD`);\n      const perd61 = pricesByDateComponent.get(`${dayKey}_PERD_61TD`);\n      const kFactor = pricesByDateComponent.get(`${dayKey}_K`) || Array(24).fill(1);\n      \n      // Helper function to get exact loss percentage for an hour\n      const getLossForHour = (tariff: string, h: number, oldPerdArray: number[] | undefined) => {\n        // Fallback to exactly calculated old PERD if BOE or K is missing\n        const boe = boeByTariff.get(tariff);\n        if (!boe) return oldPerdArray ? oldPerdArray[h] : 0;\n        \n        const dateObjH = new Date(dateObj);\n        dateObjH.setUTCHours(h);\n        const periodStr = getPeriodoREE(dateObjH, tariff); // P1, P2...\n        const pVal = boe[periodStr.toLowerCase() as keyof typeof boe] as number | null;\n        if (pVal === null || pVal === undefined) return oldPerdArray ? oldPerdArray[h] : 0;\n        \n        return pVal * kFactor[h];\n      };";
content = content.replace(findTarget3, replaceTarget3);
var findTarget4 = "        if (consumption['2.0TD'] && consumption['2.0TD'][h]) {\n          hBcMwh += (consumption['2.0TD'][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h]/100 : perd20[h]));\n        }\n        if (consumption['3.0TD'] && consumption['3.0TD'][h]) {\n          hBcMwh += (consumption['3.0TD'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h]/100 : perd30[h]));\n        }\n        if (consumption['3.0TDVE'] && consumption['3.0TDVE'][h]) {\n          hBcMwh += (consumption['3.0TDVE'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h]/100 : perd30[h]));\n        }\n        if (consumption['6.1TD'] && consumption['6.1TD'][h]) {\n          hBcMwh += (consumption['6.1TD'][h] / 1000) * (1 + (perd61[h] > 2.0 ? perd61[h]/100 : perd61[h]));\n        }\n\n        for (const seg of Object.keys(consumption)) {\n          if (!['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].includes(seg) && consumption[seg][h]) {\n            hBcMwh += (consumption[seg][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h]/100 : perd20[h]));\n          }\n        }";
var replaceTarget4 = "        const p20 = getLossForHour('2.0TD', h, perd20);\n        const p30 = getLossForHour('3.0TD', h, perd30);\n        const p61 = getLossForHour('6.1TD', h, perd61);\n\n        if (consumption['2.0TD'] && consumption['2.0TD'][h]) {\n          hBcMwh += (consumption['2.0TD'][h] / 1000) * (1 + (p20 > 2.0 ? p20/100 : p20));\n        }\n        if (consumption['3.0TD'] && consumption['3.0TD'][h]) {\n          hBcMwh += (consumption['3.0TD'][h] / 1000) * (1 + (p30 > 2.0 ? p30/100 : p30));\n        }\n        if (consumption['3.0TDVE'] && consumption['3.0TDVE'][h]) {\n          hBcMwh += (consumption['3.0TDVE'][h] / 1000) * (1 + (p30 > 2.0 ? p30/100 : p30));\n        }\n        if (consumption['6.1TD'] && consumption['6.1TD'][h]) {\n          hBcMwh += (consumption['6.1TD'][h] / 1000) * (1 + (p61 > 2.0 ? p61/100 : p61));\n        }\n\n        for (const seg of Object.keys(consumption)) {\n          if (!['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].includes(seg) && consumption[seg][h]) {\n            hBcMwh += (consumption[seg][h] / 1000) * (1 + (p20 > 2.0 ? p20/100 : p20));\n          }\n        }";
content = content.replace(findTarget4, replaceTarget4);
fs.writeFileSync(filePath, content);
console.log('calculate_pending_energy.ts patched.');
