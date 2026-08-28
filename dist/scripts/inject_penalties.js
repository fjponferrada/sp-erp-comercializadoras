"use strict";
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
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var data = "PRPR257211225KC0F\t23/4/2026\tA26PEN025\t\u20AC9,20\t\u20AC11,14\tCARMEN  PEREZ  PEREZ\t44371480H\nPRPR259181025GF0F\t23/4/2026\tA26PEN024\t\u20AC28,94\t\u20AC35,02\tJOSE ANTONIO ARJONA  BAYO\t80146634Y\nPRPR256111249AK0F\t23/4/2026\tA26PEN023\t\u20AC10,47\t\u20AC12,67\tJESSICA MARIA ROLDAN  VALLEJOS\t26974905E\nPRPR257212516XL0F\t23/4/2026\tA26PEN022\t\u20AC8,89\t\u20AC10,75\tCARMEN PEREZ PEREZ\t44371480H\nPRPR2512291140YV0F\t23/4/2026\tA26PEN021\t\u20AC34,15\t\u20AC41,32\tMARIA GERTRUDIS CANILLO IGLESIAS\t75019946H\nPRPR254151651RN0F\t23/4/2026\tA26PEN020\t\u20AC8,26\t\u20AC9,99\tFRANCISCO GALISTEO RAMIREZ\t52203156X\nPRPR25691745JJ0F\t23/4/2026\tA26PEN019\t\u20AC17,70\t\u20AC21,41\tENCARNACION GARCIA BAENA\t34001349N\nPRPR25541342RA0F\t1/4/2026\tA26PEN018\t\u20AC4,88\t\u20AC5,90\tPEDRO JESUS SANCHEZ SAIZ\t30995577H\nPRPR262252044TH0F\t1/4/2026\tA26PEN017\t\u20AC47,07\t\u20AC56,96\tDOMINGO MANUEL LASTRES PULIDO\t80140090V\nPRGF254151317YM0F\t1/4/2026\tA26PEN016\t\u20AC21,37\t\u20AC25,86\tLUISA JURADO MONJE\t30068884H\nPRPR2564912BT0F\t1/4/2026\tA26PEN015\t\u20AC20,59\t\u20AC24,91\tROCIO CUENCA VERGARA\t25344085V\nPRPR256261243SW0F\t1/4/2026\tA26PEN014\t\u20AC9,87\t\u20AC11,94\tBIPASA 1618 FAMILY OFFICE SL  \tB14949143\nPRGF254141254DG0F\t1/4/2026\tA26PEN013\t\u20AC30,13\t\u20AC36,45\tPV CASTRO S.L  \tB14314405\nPRPR25626927MF0F\t1/4/2026\tA26PEN012\t\u20AC5,02\t\u20AC6,08\tANTONIO MANUEL GARCIA JIMENEZ\t50623492D\nPRPR2512161532HX0F\t18/3/2026\tA26PEN011\t\u20AC75,25\t\u20AC91,06\tJAIRO JIMENEZ BENITEZ\t76437219P\nPRPR25813131GM0F\t18/3/2026\tA26PEN010\t\u20AC109,71\t\u20AC132,75\tRUFINO JOSE AREVALO CANTERO\t51182395N\nPRPR25625109TK0F\t13/3/2026\tA26PEN009\t\u20AC11,85\t\u20AC14,34\tPILAR COBO GAROFANO\t80116714D\nPRPR252141941XQ0F\t19/2/2026\tA26PEN008\t\u20AC489,44\t\u20AC592,23\tLA MANZANA DE ADAN EVENTOS S.L  \tB14688774\nPRJAV2512231930RD0F\t16/2/2026\tA26PEN007\t\u20AC21,90\t\u20AC26,50\tRECICLADOS EXTREME\u00D1OS S.L.  \tB06415897\nPRJAV2512231930WY0F\t16/2/2026\tA26PEN006\t\u20AC288,96\t\u20AC349,65\tRECICLADOS EXTREME\u00D1OS, SL  \tB06415897\nPRPR255301325XF0F\t27/1/2026\tA26PEN005\t\u20AC7,76\t\u20AC9,39\tALVARO JESUS ESTEVEZ GUTIERREZ\t77646144F\nPRJAV2511122034NE0F\t27/1/2026\tA26PEN004\t\u20AC34,63\t\u20AC41,90\tFERMIN  CARABALLO SANCHEZ\t08681327T\nPRPR253271129TD0F\t27/1/2026\tA26PEN002\t\u20AC55,80\t\u20AC67,52\tFRANCISCO MANUEL ARIZA MEDINA \t50601392N\nPRPR253201321VC0F\t27/1/2026\tA26PEN001\t\u20AC17,71\t\u20AC21,43\tJOSE ANTONIO  GARCIA  PULIDO\t30832113S";
function parseEuro(val) {
    return parseFloat(val.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
}
function parseDate(val) {
    var _a = val.split('/'), day = _a[0], month = _a[1], year = _a[2];
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var lines, count, _i, lines_1, line, parts, contractCode, dateStr, invoiceNumber, bipenStr, totalStr, clientName, cif, issueDate, bipen, totalAmount, contract, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lines = data.split('\n').filter(function (l) { return l.trim() !== ''; });
                    count = 0;
                    _i = 0, lines_1 = lines;
                    _a.label = 1;
                case 1:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 9];
                    line = lines_1[_i];
                    parts = line.split('\t');
                    if (parts.length < 7)
                        return [3 /*break*/, 8];
                    contractCode = parts[0], dateStr = parts[1], invoiceNumber = parts[2], bipenStr = parts[3], totalStr = parts[4], clientName = parts[5], cif = parts[6];
                    issueDate = parseDate(dateStr);
                    bipen = parseEuro(bipenStr);
                    totalAmount = parseEuro(totalStr);
                    console.log("Processing ".concat(invoiceNumber, " for contract ").concat(contractCode, "..."));
                    return [4 /*yield*/, prisma.contract.findFirst({
                            where: { contractCode: contractCode },
                            orderBy: { version: 'desc' }
                        })];
                case 2:
                    contract = _a.sent();
                    if (!contract) {
                        console.error("  Contract not found: ".concat(contractCode));
                        return [3 /*break*/, 8];
                    }
                    return [4 /*yield*/, prisma.penaltyInvoice.findUnique({
                            where: { invoiceNumber: invoiceNumber }
                        })];
                case 3:
                    existing = _a.sent();
                    if (!!existing) return [3 /*break*/, 5];
                    // Create PenaltyInvoice
                    return [4 /*yield*/, prisma.penaltyInvoice.create({
                            data: {
                                invoiceNumber: invoiceNumber,
                                amount: totalAmount,
                                issueDate: issueDate,
                                status: 'EMITIDA',
                                contractId: contract.id,
                                clientId: contract.clientId,
                                supplyPointId: contract.supplyPointId,
                            }
                        })];
                case 4:
                    // Create PenaltyInvoice
                    _a.sent();
                    console.log("  -> Created PenaltyInvoice ".concat(invoiceNumber));
                    return [3 /*break*/, 6];
                case 5:
                    console.log("  -> PenaltyInvoice ".concat(invoiceNumber, " already exists."));
                    _a.label = 6;
                case 6: 
                // Update Contract
                return [4 /*yield*/, prisma.contract.update({
                        where: { id: contract.id },
                        data: {
                            penalization: bipen,
                            penaltyStatus: 'FACTURADA'
                        }
                    })];
                case 7:
                    // Update Contract
                    _a.sent();
                    console.log("  -> Updated Contract ".concat(contractCode));
                    count++;
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 1];
                case 9:
                    console.log("Finished processing ".concat(count, " records."));
                    return [2 /*return*/];
            }
        });
    });
}
run()
    .catch(console.error)
    .finally(function () { return prisma.$disconnect(); });
