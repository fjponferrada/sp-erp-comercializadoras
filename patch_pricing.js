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
var filePath = 'src/lib/services/PricingEngine.ts';
var content = fs.readFileSync(filePath, 'utf8');
var findTarget1 = "    const restriccionesArr = await smartMergeDB(dates, 'RESTRICCIONES', riskLevel);\n    const osArr = await smartMergeDB(dates, 'OS', riskLevel);\n    let lossCol = 'PERD_30TD';\n    if (tariff.includes('2.0')) lossCol = 'PERD_20TD';\n    if (tariff.includes('6.1')) lossCol = 'PERD_61TD';\n    const perdArr = await smartMergeDB(dates, lossCol, riskLevel);";
var replaceTarget1 = "    const restriccionesArr = await smartMergeDB(dates, 'RESTRICCIONES', riskLevel);\n    const osArr = await smartMergeDB(dates, 'OS', riskLevel);\n    \n    // Fetch old PERD as fallback\n    let lossCol = 'PERD_30TD';\n    if (tariff.includes('2.0')) lossCol = 'PERD_20TD';\n    if (tariff.includes('6.1')) lossCol = 'PERD_61TD';\n    const oldPerdArr = await smartMergeDB(dates, lossCol, riskLevel);\n    \n    // Fetch K\n    const kArr = await smartMergeDB(dates, 'K', riskLevel);\n    \n    // Fetch BOE Perdidas from regulatedCosts matching tariff\n    const boeRecord = regulatedCosts.find(c => c.concept === 'PERDIDAS' && c.tariff === tariff);";
content = content.replace(findTarget1, replaceTarget1);
var findTarget2 = "      const rEur = restriccionesArr[i] || 0;\n      const osEur = osArr[i] || 0;\n      const perdPct = perdArr[i] || 0;";
var replaceTarget2 = "      const rEur = restriccionesArr[i] || 0;\n      const osEur = osArr[i] || 0;\n      const kFactor = kArr[i] || 1;\n      \n      let perdPct = oldPerdArr[i] || 0;\n      if (boeRecord) {\n        const periodStr = this.getPeriodo(d, tariff, false);\n        const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;\n        if (pVal !== null && pVal !== undefined) {\n          perdPct = pVal * kFactor;\n        }\n      }";
content = content.replace(findTarget2, replaceTarget2);
fs.writeFileSync(filePath, content);
console.log('PricingEngine.ts patched.');
