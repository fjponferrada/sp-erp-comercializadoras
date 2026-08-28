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
var path_1 = __importDefault(require("path"));
var r2_1 = require("../lib/r2");
var data = "PRPR246251757KA0F\t19/12/2024\tAEDEN24-50\t\u20AC57,88\t\u20AC70,04\tJUAN LUIS  CABALLERO VI\u00D1AS \t74983695S\nPRPR246251757LM0F\t19/12/2024\tAEDEN24-49\t\u20AC22,85\t\u20AC27,65\tJUAN LUIS CABALLERO  VI\u00D1AS\t74983695S\nPRPR24829138MJ0F\t3/12/2024\tAEDEN24-47\t\u20AC123,21\t\u20AC149,09\tMANUEL SEVILLANO ANAYA\t34028312L\nPRMR2441620306TB\t29/11/2024\tAEDEN24-46\t\u20AC22,59\t\u20AC27,33\tJES\u00DAS MIGUEL  DOBLAS  PINO\t30506680D\nPRPR24561945TQ0F\t21/11/2024\tAEDEN24-44\t\u20AC22,07\t\u20AC26,70\tANTONIO TARIFA VIZCAINO\t30976082G\nPRPR241014159MN0F\t29/11/2024\tAEDEN24-44\t\u20AC61,66\t\u20AC74,61\tDOMINGA GUIJARRO MORENO\t80127401R\nPRPR245311243SC0F\t7/11/2024\tAEDEN24-43\t\u20AC47,64\t\u20AC57,65\tSANDRA AVAUX SILES\t26047560Z\nPRPR2489131165YT\t24/10/2024\tAEDEN24-41\t\u20AC38,79\t\u20AC46,94\tGREGORIO PORTERO MEMBRIVE\t34000770P\nPRPR24415137B0F\t24/10/2024\tAEDEN24-40\t\u20AC28,65\t\u20AC34,66\tMANUEL JESUS JIMENEZ JIMENEZ\t80147348F\nPRPR247171625PW0F\t24/10/2024\tAEDEN24-39\t\u20AC32,15\t\u20AC38,91\tANTONIA RAMOS CASTILLA\t29969377D\nPRPR247171056RP0F\t21/10/2024\tAEDEN24-38\t\u20AC137,94\t\u20AC166,91\tMARIA ALEJANDRA OLIVA GARCIA\t75773014C\nPRPR244251910MQ0F\t9/10/2024\tAEDEN24-37\t\u20AC30,44\t\u20AC36,84\tMARIA CARMEN MARTINEZ MORENO\t48869845C\nPRPR243212045E0F\t9/10/2024\tAEDEN24-36\t\u20AC43,59\t\u20AC52,75\tJOSE RAMON RODRIGUEZ ROJANO\t30528603J\nAEDJP242151147Q0F\t9/10/2024\tAEDEN24-35\t\u20AC14,20\t\u20AC17,18\tJuan Carlos Rivas Romero\t45737505G\nPRPR248211012TP0F\t9/10/2024\tAEDEN24-34\t\u20AC28,43\t\u20AC34,40\tGREGORIO PORTERO MEMBRIVE\t34000770P\nPRPR248191444WJ0F\t26/9/2024\tAEDEN24-33\t\u20AC107,15\t\u20AC129,65\tISABEL MU\u00D1OZ  INFANTE\t80158650Q\nPRPR24621317KL0F\t26/9/2024\tAEDEN24-32\t\u20AC46,38\t\u20AC56,13\tSERGIO  LEON CARRILLO\t77321782Z\nPRPR245151346RA0F\t25/9/2024\tAEDEN24-31\t\u20AC40,23\t\u20AC48,68\tBALTASAR RIOBOO FUENTES\t30566879V\nPRPR243181522V0F\t21/9/2024\tAEDEN24-30\t\u20AC20,76\t\u20AC25,11\tMANUELA  MU\u00D1OZ  JIMENEZ\t26969248T\nPRPR244291251RR0F\t21/9/2024\tAEDEN24-29\t\u20AC12,99\t\u20AC15,72\tPINTURAS SEDA SL  \tB14874168\nTRFAAV243131341M0F\t21/9/2024\tAEDEN24-28\t\u20AC35,26\t\u20AC42,67\tJosefa Coca Mart\u00EDn\t24225906Y\nPRPR24313206F0F\t21/9/2024\tAEDEN24-27\t\u20AC21,84\t\u20AC26,42\tARMANDO FENANDEZ GOIRIA\t30567531W\nPRPR24791731DW0F\t21/9/2024\tAEDEN24-26\t\u20AC45,92\t\u20AC55,56\tRAFAEL SANCHEZ CANO\t25029679K\nPRPR244181856N0F\t21/9/2024\tAEDEN24-25\t\u20AC42,26\t\u20AC51,14\tSORAYA AZAUSTRE CANO\t77387298A\nPRPR243212046H0F\t21/9/2024\tAEDEN24-24\t\u20AC84,95\t\u20AC102,79\tJOSE RAMON RODRIGUEZ  ROJANO\t30528603J\nPRPR245291315RW0F\t21/9/2024\tAEDEN24-23\t\u20AC64,83\t\u20AC78,45\tISABEL MARIA ROMERO  ROLDAN\t80155538D\nPRPR24229183A0F\t21/9/2024\tAEDEN24-22\t\u20AC34,67\t\u20AC41,95\tFRANCISCA GUILLEN BURREZO\t33383604R\nPRPR242292355N0F\t18/9/2024\tAEDEN24-18\t\u20AC226,39\t\u20AC273,93\tANA  MARTIN MUNZON\t30527357D\nPRPR243181521D0F\t18/9/2024\tAEDEN24-15\t\u20AC52,48\t\u20AC63,51\tANTONIO BENITEZ CABRERA\t24679697F\nPRPR243181521K0F\t18/9/2024\tAEDEN24-15\t\u20AC61,43\t\u20AC74,33\tANTONIO BENITEZ CABRERA\t24679697F\nPRPR243181525Y0F\t18/9/2024\tAEDEN24-15\t\u20AC46,23\t\u20AC55,93\tANTONIO BENITEZ CABRERA\t24679697F\nPRPR24431727G0F\t18/9/2024\tAEDEN24-14\t\u20AC17,52\t\u20AC21,20\tFRANCISCO JAVIER DURAN NU\u00D1O\t31673260Y\nPRPR2443182S0F\t18/9/2024\tAEDEN24-14\t\u20AC12,36\t\u20AC14,96\tFRANCISCO JAVIER  DURAN NU\u00D1O\t31673260Y\nPRPR2443182Y0F\t18/9/2024\tAEDEN24-14\t\u20AC12,59\t\u20AC15,23\tFRANCISCO JAVIER  DURAN  NU\u00D1O\t31673260Y\nPRPR2443182R0F\t18/9/2024\tAEDEN24-14\t\u20AC6,99\t\u20AC8,46\tFRANCISCO JAVIER  DURAN NU\u00D1O\t31673260Y\nPRPR2443182W0F\t18/9/2024\tAEDEN24-14\t\u20AC6,32\t\u20AC7,65\tFRANCISCO JAVIER  DURAN NU\u00D1O\t31673260Y\nPRPR242271846Y0F\t18/9/2024\tAEDEN24-11\t\u20AC111,06\t\u20AC134,38\tMARIA TERESA BURGOS LAIRANA\t77356148H\nPRPR24372116A0F\t18/9/2024\tAEDEN24-10\t\u20AC62,08\t\u20AC75,12\tJOSE JAIME RUZ GRACIA\t50600949Y\nPRPR23519123V0F\t18/9/2024\tAEDEN24-06\t\u20AC16,57\t\u20AC20,05\tJOAQUIN GARCIA  PRIEGO\t30973225E\nPRPR235191234B0F\t18/9/2024\tAEDEN24-06\t\u20AC4,24\t\u20AC5,13\tJOAQUIN GARCIA PRIEGO\t30973225E\nAEDJP239181650DB\t18/9/2024\tAEDEN24-04\t\u20AC32,73\t\u20AC39,61\tSalvador Gal\u00E1n Gadea\t21515512R\nAEDJP239181657RP\t18/9/2024\tAEDEN24-04\t\u20AC92,16\t\u20AC111,52\tSalvador Gal\u00E1n Gadea\t21515512R\nAEDJP239181656GX\t18/9/2024\tAEDEN24-04\t\u20AC34,51\t\u20AC41,76\tSalvador Gal\u00E1n Gadea\t21515512R\nPRPR233312016D0F\t18/9/2024\tAEDEN24-03\t\u20AC43,55\t\u20AC52,70\tJUAN JESUS  VERA  SANCHEZ\t28454655K\nPRPR234201141W0F\t18/9/2024\tAEDEN24-02\t\u20AC35,42\t\u20AC42,86\tANTONIO ORDO\u00D1EZ JURADO\t30940899B\nPRPR234201150E0F\t18/9/2024\tAEDEN24-01\t\u20AC18,24\t\u20AC22,07\tANTONIO ORDO\u00D1EZ MU\u00D1OZ\t30942560Q";
function parseEuro(val) {
    return parseFloat(val.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
}
function parseDate(val) {
    var _a = val.split('/'), day = _a[0], month = _a[1], year = _a[2];
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
var dirPath = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2024\\Emitidas\\Penalizaciones';
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var files, lines, grouped, _i, lines_1, line, parts, inv, _loop_1, _a, _b, _c, baseInvoice, partsList;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    files = fs_1.default.readdirSync(dirPath);
                    lines = data.split('\n').filter(function (l) { return l.trim() !== ''; });
                    grouped = new Map();
                    for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        line = lines_1[_i];
                        parts = line.split('\t');
                        if (parts.length < 7)
                            continue;
                        inv = parts[2];
                        if (!grouped.has(inv))
                            grouped.set(inv, []);
                        grouped.get(inv).push(parts);
                    }
                    _loop_1 = function (baseInvoice, partsList) {
                        var matchFile, pdfUrl, pdfBuffer, index, _e, partsList_1, parts, contractCode, dateStr, bipenStr, totalStr, issueDate, bipen, totalAmount, contract, invoiceNumber, existing;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    console.log("Processing ".concat(baseInvoice, " (").concat(partsList.length, " contracts)..."));
                                    matchFile = files.find(function (f) { return f.startsWith(baseInvoice) && f.endsWith('.pdf'); });
                                    pdfUrl = null;
                                    if (!matchFile) return [3 /*break*/, 2];
                                    console.log("  Found PDF: ".concat(matchFile, ", uploading..."));
                                    pdfBuffer = fs_1.default.readFileSync(path_1.default.join(dirPath, matchFile));
                                    return [4 /*yield*/, (0, r2_1.uploadFileToR2)("penalizaciones/2024/".concat(matchFile), pdfBuffer, 'application/pdf')];
                                case 1:
                                    pdfUrl = _f.sent();
                                    console.log("  Uploaded to ".concat(pdfUrl));
                                    return [3 /*break*/, 3];
                                case 2:
                                    console.log("  Warning: PDF not found for ".concat(baseInvoice));
                                    _f.label = 3;
                                case 3:
                                    index = 1;
                                    _e = 0, partsList_1 = partsList;
                                    _f.label = 4;
                                case 4:
                                    if (!(_e < partsList_1.length)) return [3 /*break*/, 12];
                                    parts = partsList_1[_e];
                                    contractCode = parts[0];
                                    dateStr = parts[1];
                                    bipenStr = parts[3];
                                    totalStr = parts[4];
                                    issueDate = parseDate(dateStr);
                                    bipen = parseEuro(bipenStr);
                                    totalAmount = parseEuro(totalStr);
                                    return [4 /*yield*/, prisma_1.prisma.contract.findFirst({
                                            where: { contractCode: contractCode },
                                            orderBy: { version: 'desc' }
                                        })];
                                case 5:
                                    contract = _f.sent();
                                    if (!contract) {
                                        console.error("  Contract not found: ".concat(contractCode));
                                        return [3 /*break*/, 11];
                                    }
                                    invoiceNumber = partsList.length > 1 ? "".concat(baseInvoice, "-").concat(index) : baseInvoice;
                                    return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.findUnique({
                                            where: { invoiceNumber: invoiceNumber }
                                        })];
                                case 6:
                                    existing = _f.sent();
                                    if (!!existing) return [3 /*break*/, 8];
                                    return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.create({
                                            data: {
                                                invoiceNumber: invoiceNumber,
                                                amount: totalAmount,
                                                issueDate: issueDate,
                                                pdfUrl: pdfUrl,
                                                status: 'EMITIDA',
                                                contractId: contract.id,
                                                clientId: contract.clientId,
                                                supplyPointId: contract.supplyPointId,
                                            }
                                        })];
                                case 7:
                                    _f.sent();
                                    console.log("  -> Created PenaltyInvoice ".concat(invoiceNumber));
                                    return [3 /*break*/, 9];
                                case 8:
                                    console.log("  PenaltyInvoice ".concat(invoiceNumber, " already exists."));
                                    _f.label = 9;
                                case 9: return [4 /*yield*/, prisma_1.prisma.contract.update({
                                        where: { id: contract.id },
                                        data: {
                                            penalization: bipen,
                                            penaltyStatus: 'FACTURADA'
                                        }
                                    })];
                                case 10:
                                    _f.sent();
                                    console.log("  -> Marked contract ".concat(contractCode, " as FACTURADA (").concat(bipen, "\u20AC)"));
                                    index++;
                                    _f.label = 11;
                                case 11:
                                    _e++;
                                    return [3 /*break*/, 4];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    _a = 0, _b = Array.from(grouped.entries());
                    _d.label = 1;
                case 1:
                    if (!(_a < _b.length)) return [3 /*break*/, 4];
                    _c = _b[_a], baseInvoice = _c[0], partsList = _c[1];
                    return [5 /*yield**/, _loop_1(baseInvoice, partsList)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _a++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
run()
    .catch(console.error)
    .finally(function () { return prisma_1.prisma.$disconnect(); });
