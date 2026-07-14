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
var filePath = 'src/lib/services/InternalBillingEngine.ts';
var content = fs.readFileSync(filePath, 'utf8');
var findTarget1 = "component: { in: ['OMIE', 'OS', 'RESTRICCIONES', tariff.includes('2.0') ? 'PERD_20TD' : (tariff.includes('6.1') ? 'PERD_61TD' : 'PERD_30TD')] }";
var replaceTarget1 = "component: { in: ['OMIE', 'OS', 'RESTRICCIONES', 'K', tariff.includes('2.0') ? 'PERD_20TD' : (tariff.includes('6.1') ? 'PERD_61TD' : 'PERD_30TD')] }";
content = content.replace(findTarget1, replaceTarget1);
var findTarget2 = "    const omieMap = new Map<string, number>();\n    const osMap = new Map<string, number>();\n    const restMap = new Map<string, number>();\n    const perdMap = new Map<string, number>();";
var replaceTarget2 = "    const perdidasBOE = await prisma.regulatedCost.findMany({ where: { concept: 'PERDIDAS', tariff: tariff } });\n    const boeRecord = perdidasBOE[0];\n\n    const omieMap = new Map<string, number>();\n    const osMap = new Map<string, number>();\n    const restMap = new Map<string, number>();\n    const kMap = new Map<string, number>();\n    const perdMap = new Map<string, number>();";
content = content.replace(findTarget2, replaceTarget2);
var findTarget3 = "        if (pd.component === 'OMIE') omieMap.set(key, pd.values[h] || 0);\n        else if (pd.component === 'OS') osMap.set(key, pd.values[h] || 0);\n        else if (pd.component === 'RESTRICCIONES') restMap.set(key, pd.values[h] || 0);\n        else perdMap.set(key, pd.values[h] || 0);";
var replaceTarget3 = "        if (pd.component === 'OMIE') omieMap.set(key, pd.values[h] || 0);\n        else if (pd.component === 'OS') osMap.set(key, pd.values[h] || 0);\n        else if (pd.component === 'RESTRICCIONES') restMap.set(key, pd.values[h] || 0);\n        else if (pd.component === 'K') kMap.set(key, pd.values[h] || 1);\n        else perdMap.set(key, pd.values[h] || 0);";
content = content.replace(findTarget3, replaceTarget3);
var findTarget4 = "        const hourLoss = perdMap.get(key) || 0;";
var replaceTarget4 = "        const dateObjH = new Date(cch.date);\n        dateObjH.setUTCHours(cch.hour - 1);\n        const periodStr = getPeriodoREE(dateObjH, tariff);\n        \n        let hourLoss = perdMap.get(key) || 0;\n        if (boeRecord) {\n          const kFactor = kMap.get(key) || 1;\n          const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;\n          if (pVal !== null && pVal !== undefined) {\n            hourLoss = pVal * kFactor;\n          }\n        }";
content = content.replace(findTarget4, replaceTarget4);
fs.writeFileSync(filePath, content);
console.log('InternalBillingEngine.ts patched.');
