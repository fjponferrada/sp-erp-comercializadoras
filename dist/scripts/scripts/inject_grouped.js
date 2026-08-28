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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prisma_1 = require("../lib/prisma");
var fs_1 = __importDefault(require("fs"));
var r2_1 = require("../lib/r2");
function processGroupedPenalty(pdfPath, baseInvoiceNumber, cifRaw, dateStr, lines) {
    return __awaiter(this, void 0, void 0, function () {
        var fileBuffer, r2Url, issueDate, index, _i, lines_1, line, cups20, sp, matchingContracts, targetContract, invoiceNumber, amount, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fileBuffer = fs_1.default.readFileSync(pdfPath);
                    console.log("Uploading ".concat(baseInvoiceNumber, ".pdf..."));
                    return [4 /*yield*/, (0, r2_1.uploadFileToR2)("penalizaciones/2026/".concat(baseInvoiceNumber, ".pdf"), fileBuffer, 'application/pdf')];
                case 1:
                    r2Url = _a.sent();
                    console.log("Uploaded! URL: ".concat(r2Url));
                    issueDate = new Date(dateStr);
                    index = 1;
                    _i = 0, lines_1 = lines;
                    _a.label = 2;
                case 2:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 10];
                    line = lines_1[_i];
                    cups20 = line.cups.substring(0, 20);
                    return [4 /*yield*/, prisma_1.prisma.supplyPoint.findFirst({
                            where: { cups: { startsWith: cups20 } },
                            include: {
                                contracts: {
                                    include: { client: true }
                                }
                            }
                        })];
                case 3:
                    sp = _a.sent();
                    if (!sp) {
                        console.log("Supply point not found for CUPS ".concat(cups20));
                        return [3 /*break*/, 9];
                    }
                    matchingContracts = sp.contracts
                        .filter(function (c) { return c.client.vatNumber.trim().toUpperCase() === cifRaw.toUpperCase(); })
                        .sort(function (a, b) {
                        var dateA = a.terminationDate || new Date();
                        var dateB = b.terminationDate || new Date();
                        return dateB.getTime() - dateA.getTime();
                    });
                    if (matchingContracts.length === 0) {
                        console.log("No contract found for CUPS ".concat(cups20, " and CIF ").concat(cifRaw));
                        return [3 /*break*/, 9];
                    }
                    targetContract = matchingContracts[0];
                    // Update contract
                    return [4 /*yield*/, prisma_1.prisma.contract.update({
                            where: { id: targetContract.id },
                            data: {
                                penalization: line.base,
                                penaltyStatus: 'FACTURADA'
                            }
                        })];
                case 4:
                    // Update contract
                    _a.sent();
                    invoiceNumber = "".concat(baseInvoiceNumber, "-").concat(index);
                    amount = line.base * 1.21;
                    return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.findUnique({
                            where: { invoiceNumber: invoiceNumber }
                        })];
                case 5:
                    existing = _a.sent();
                    if (!!existing) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.create({
                            data: {
                                invoiceNumber: invoiceNumber,
                                amount: amount,
                                issueDate: issueDate,
                                pdfUrl: r2Url,
                                status: 'EMITIDA',
                                contractId: targetContract.id,
                                clientId: targetContract.clientId,
                                supplyPointId: targetContract.supplyPointId,
                            }
                        })];
                case 6:
                    _a.sent();
                    console.log("Created PenaltyInvoice ".concat(invoiceNumber, " for Contract ").concat(targetContract.contractCode));
                    return [3 /*break*/, 8];
                case 7:
                    console.log("PenaltyInvoice ".concat(invoiceNumber, " already exists"));
                    _a.label = 8;
                case 8:
                    index++;
                    _a.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 2];
                case 10: return [2 /*return*/];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, processGroupedPenalty('A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Emitidas\\Penalizaciones\\A26PEN026.pdf', 'A26PEN026', 'B14688774', '2026-08-19', [
                        { cups: 'ES0031101396048002XQ0F', base: 2969.17 },
                        { cups: 'ES0031101480907002XX0F', base: 4090.97 },
                        { cups: 'ES0031104753196001EG0F', base: 7434.14 },
                    ])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, processGroupedPenalty('A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Emitidas\\Penalizaciones\\A26PEN027.pdf', 'A26PEN027', 'B91677534', '2026-08-19', [
                            { cups: 'ES0031105088239001JA0F', base: 1297.50 },
                            { cups: 'ES0031105123125001ZV0F', base: 447.24 },
                        ])];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
run()
    .catch(console.error)
    .finally(function () { return prisma_1.prisma.$disconnect(); });
