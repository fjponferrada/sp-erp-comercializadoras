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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var prisma_1 = require("../lib/prisma");
var xlsx = __importStar(require("xlsx"));
var filePath = 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\docs\\otros_conceptos_2026-08-28.xlsx';
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, sheetName, sheet, rows, successCount, notFoundCount, _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = xlsx.readFile(filePath);
                    sheetName = workbook.SheetNames[0];
                    sheet = workbook.Sheets[sheetName];
                    rows = xlsx.utils.sheet_to_json(sheet);
                    successCount = 0;
                    notFoundCount = 0;
                    _loop_1 = function (i) {
                        var row, cifRaw, cupsFull, importe, fechaStr, penaltyDate, maxDate, cups20, sp, targetContract, matchingContracts;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    row = rows[i];
                                    cifRaw = row['CIF'] ? row['CIF'].toString().trim().toUpperCase() : '';
                                    cupsFull = row['CUPS'] ? row['CUPS'].toString().trim() : '';
                                    importe = parseFloat(row['Importe']);
                                    fechaStr = row['Fecha insercion'];
                                    if (!cifRaw || !cupsFull || isNaN(importe) || !fechaStr) {
                                        console.log("Row ".concat(i, " missing data, skipping."));
                                        return [2 /*return*/, "continue"];
                                    }
                                    penaltyDate = new Date(fechaStr);
                                    maxDate = new Date(penaltyDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                                    cups20 = cupsFull.substring(0, 20);
                                    return [4 /*yield*/, prisma_1.prisma.supplyPoint.findFirst({
                                            where: { cups: { startsWith: cups20 } },
                                            include: {
                                                contracts: {
                                                    include: { client: true }
                                                }
                                            }
                                        })];
                                case 1:
                                    sp = _b.sent();
                                    if (!sp) {
                                        console.log("Row ".concat(i, ": SupplyPoint not found for CUPS ").concat(cups20, " (CIF: ").concat(cifRaw, ")"));
                                        notFoundCount++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    targetContract = null;
                                    matchingContracts = sp.contracts
                                        .filter(function (c) { return c.client.vatNumber.trim().toUpperCase() === cifRaw; })
                                        .filter(function (c) {
                                        if (!c.terminationDate)
                                            return true;
                                        return c.terminationDate <= maxDate;
                                    })
                                        .sort(function (a, b) {
                                        var dateA = a.terminationDate || new Date();
                                        var dateB = b.terminationDate || new Date();
                                        return dateB.getTime() - dateA.getTime();
                                    });
                                    if (matchingContracts.length > 0) {
                                        targetContract = matchingContracts[0];
                                    }
                                    if (!targetContract) {
                                        console.log("Row ".concat(i, ": No matching contract found for CUPS ").concat(cups20, ", CIF ").concat(cifRaw, " around ").concat(fechaStr));
                                        notFoundCount++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (targetContract.penaltyStatus === 'FACTURADA') {
                                        console.log("Row ".concat(i, ": Contract ").concat(targetContract.contractCode, " already FACTURADA. Skipping."));
                                        return [2 /*return*/, "continue"];
                                    }
                                    // Update the contract
                                    return [4 /*yield*/, prisma_1.prisma.contract.update({
                                            where: { id: targetContract.id },
                                            data: {
                                                penalization: importe,
                                                penaltyStatus: 'FACTURADA'
                                            }
                                        })];
                                case 2:
                                    // Update the contract
                                    _b.sent();
                                    console.log("Row ".concat(i, ": Marked ").concat(targetContract.contractCode, " as FACTURADA (").concat(importe, "\u20AC)"));
                                    successCount++;
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < rows.length)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\nFinished processing! Updated: ".concat(successCount, ". Not found/Matched: ").concat(notFoundCount, "."));
                    return [2 /*return*/];
            }
        });
    });
}
run()
    .catch(console.error)
    .finally(function () { return prisma_1.prisma.$disconnect(); });
