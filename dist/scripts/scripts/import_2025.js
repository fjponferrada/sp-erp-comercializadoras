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
var data = "AEDAVP251027203PE0F\t23/12/2025\tAEDEN25-83\t\u20AC15,21\t\u20AC18,41\tPABLO GUTIERREZ  GRACIA\t46268322G\nPRGF25712024FW0F\t23/12/2025\tAEDEN25-82\t\u20AC41,63\t\u20AC50,38\tRAFAELA ARROYO ESPINO\t30515145X\nPRPR259151439RD0F\t4/12/2025\tAEDEN25-81\t\u20AC128,29\t\u20AC155,23\tESTRELLA REINA  LEON\t17681622G\nPRPR256161913KK0F\t28/11/2025\tAEDEN25-80\t\u20AC73,69\t\u20AC89,17\tALBERTO ALCOBA GARCIA\t77466887N\nPRPR25627235DM0F\t26/11/2025\tAEDEN25-79\t\u20AC36,58\t\u20AC44,26\tMARIA ALMUDENA RUIZ  RAMIREZ\t26041947J\nPRPR2591189ZP0F\t18/11/2025\tAEDEN25-78\t\u20AC214,00\t\u20AC258,93\tZORNITSA ZHECHKOVA GANEVA\tY0276057W\nPRPR25324152LG0F\t13/11/2025\tAEDEN25-77\t\u20AC168,39\t\u20AC203,76\tANTONIO ARIZA JIMENEZ\t30941781L\nPRGF251171116QD0F\t13/11/2025\tAEDEN25-76\t\u20AC20,30\t\u20AC24,56\tMARIA DE LOS ANGELES CABALLERO ZURITA\t30947169W\nPRPR258291234DQ0F\t13/11/2025\tAEDEN25-75\t\u20AC40,67\t\u20AC49,22\tRAFAEL PABLO DEL CAMPO PRIETO\t31025628P\nPRPR25313150YR0F\t13/11/2025\tAEDEN25-74\t\u20AC11,91\t\u20AC14,41\tJOSEFA GUTIERREZ ESPEJO\t34012875S\nPRPR253281617YS0F\t30/10/2025\tAEDEN25-73\t\u20AC9,03\t\u20AC10,93\tKHALIFA ET TAYAA ABOULKHIR\t26828053W\nPRPR25530101EF0F\t29/9/2025\tAEDEN25-72\t\u20AC73,37\t\u20AC88,78\tANA CARMEN BUSTOS  CASTA\u00D1EDA\t80152347S\nPRPR255151038TJ0F\t29/9/2025\tAEDEN25-71\t\u20AC11,56\t\u20AC13,99\tANNA ALSINA LA ROSA\t47871507C\nPRPR251211618KT0F\t24/9/2025\tAEDEN25-70\t\u20AC18,98\t\u20AC22,97\tJOSE ANTONIO RAMIREZ VERGARA\t80152340P\nPRPR25351226HC0F\t24/9/2025\tAEDEN25-69\t\u20AC21,35\t\u20AC25,83\tDOLORES ATIENZA JIMENEZ\t25925140T\nPRPR25331224WH0F\t24/9/2025\tAEDEN25-68\t\u20AC16,22\t\u20AC19,63\tNAIARA RUBIO LOZANO\t39383541C\nPRPR256232228JN0F\t11/9/2025\tAEDEN25-67\t\u20AC37,05\t\u20AC44,84\tJAVIER DIAZ DIAZ\t47603015F\nPRPR25410186MK0F\t5/9/2025\tAEDEN25-65\t\u20AC17,09\t\u20AC20,68\tHTALOW COST SOCIEDAD LIMITADA  \tB23722820\nPRPR254111217EY0F\t19/8/2025\tAEDEN25-64\t\u20AC34,27\t\u20AC41,46\tGUADALUPE MARIA PARRAGA URBANO\t80149115A\nAEDT253281219VS0F\t19/8/2025\tAEDEN25-63\t\u20AC52,73\t\u20AC63,80\tANTONIO MANUEL ALBA BAENA\t30542052F\nPRPR253281214ZF0F\t11/8/2025\tAEDEN25-62\t\u20AC62,43\t\u20AC75,54\tANTONIO  DIAZ CARABALLO\t34001657K\nPRPR25261452ZG0F\t18/7/2025\tAEDEN25-61\t\u20AC4,82\t\u20AC5,83\tARQUITECTURA BUSINESS AGUILAR SLP.  \tB90218207\nPRPR249171139SG0F\t3/7/2025\tAEDEN25-60\t\u20AC9,83\t\u20AC11,89\tPILAR GARCIA CUENCA\t30800320P\nPRPR247161152AH0F\t3/7/2025\tAEDEN25-59\t\u20AC8,09\t\u20AC9,79\tLUIS RAFAEL LIZANA  AMO\t15450744B\nPRPR253171447DD0F\t3/7/2025\tAEDEN25-58\t\u20AC41,49\t\u20AC50,20\tMANUEL RAMIREZ BENITEZ\t44364827N\nPRPR24820149AJ0F\t3/7/2025\tAEDEN25-57\t\u20AC18,41\t\u20AC22,28\tPILAR  GARCIA CUENCA\t30800320P\nPRPR25241748NJ0F\t3/7/2025\tAEDEN25-56\t\u20AC17,51\t\u20AC21,19\tENRIQUE ALBA GARRIDO\t25981142C\nPRPR2457163QT0F\t24/4/2025\tAEDEN25-54\t\u20AC5,25\t\u20AC6,35\tJUAN MANUEL LUQUE  PINILLA\t30794609R\nPRPR24679444KK\t24/4/2025\tAEDEN25-53\t\u20AC7,59\t\u20AC9,18\tSALVADOR MERCHAN SANCHEZ\t74875110J\nPRJA251301856JV0F\t24/4/2025\tAEDEN25-51\t\u20AC21,40\t\u20AC25,89\tDAVID LEON MU\u00D1OZ\t30815028L\nPRPR253122145LS0F\t22/4/2025\tAEDEN25-50\t\u20AC63,27\t\u20AC76,55\tGERARDO COMINO SANTANO\t30970552V\nPRPR25219148SR0F\t22/4/2025\tAEDEN25-49\t\u20AC20,11\t\u20AC24,33\tFRANCISCO LEONARDO CHAVEZ MORAN\t46271113N\nPRGF251221349NK0F\t22/4/2025\tAEDEN25-48\t\u20AC16,80\t\u20AC20,33\tSUMINISTROS LA VAGUADA S.L  \tB42783159\nPRGF252271326VX0F\t22/4/2025\tAEDEN25-47\t\u20AC41,17\t\u20AC49,82\tPROMOCIONES BLANSECOR SL  \tB14841035\nPRPR251141824FT0F\t22/4/2025\tAEDEN25-46\t\u20AC58,44\t\u20AC70,71\tANTONIO PRIETO LOPEZ\t52353709M\nPRPR2410221949LF0F\t22/4/2025\tAEDEN25-45\t\u20AC30,31\t\u20AC36,68\tPAULINO CAMPOS  GUIMERANS\t36016121F\nPRGF249242145MV0F\t1/4/2025\tAEDEN25-44\t\u20AC26,03\t\u20AC31,49\tDOLORES RODRIGUEZ GRUESO\t30944287H\nPRPR24912166MS0F\t1/4/2025\tAEDEN25-43\t\u20AC21,23\t\u20AC25,68\tMARIA DEL ROCIO PAVON LARA\t78978182T\nPRPR2492247ZK0F\t1/4/2025\tAEDEN25-42\t\u20AC16,08\t\u20AC19,45\tFRANCISCO  AGUILERA  SERRANO\t30832183Q\nPRPR24812232NN0F\t26/3/2025\tAEDEN25-41\t\u20AC15,07\t\u20AC18,23\tROMICA - CIPRIAN MASCAN \tX8929467Q\nPRPR24992246CZ0F\t26/3/2025\tAEDEN25-39\t\u20AC26,42\t\u20AC31,97\tMANUELA GARCIA CA\u00D1ETE\t30992243L\nPRPR244291251QM0F\t26/3/2025\tAEDEN25-38\t\u20AC10,29\t\u20AC12,45\tJOSE ANTONIO CASTILLA  ORTIZ\t26976420L\nPRPR2410121658EB0F\t26/3/2025\tAEDEN25-37\t\u20AC40,02\t\u20AC48,43\tPILAR  GARCIA CUENCA\t30800320P\nPRPR244152056W0F\t26/3/2025\tAEDEN25-36\t\u20AC9,16\t\u20AC11,09\tJUAN FRANCISCO ALVAREZ JIMENEZ\t75018690G\nPRPR244171325J0F\t26/3/2025\tAEDEN25-35\t\u20AC1,82\t\u20AC2,21\tMONTILLA ASEGURADOR SL  \tB14994685\nPRPR24529194GQ0F\t26/3/2025\tAEDEN25-34\t\u20AC4,11\t\u20AC4,97\tJOSE ANTONIO CASTELLANO DE LA ROSA\t30424078T\nPRPR244181213A0F\t10/3/2025\tAEDEN25-33\t\u20AC10,15\t\u20AC12,28\tCARMEN VILLATORO DELGADO\t15453624Q\nPRPR24513939SD0F\t10/3/2025\tAEDEN25-32\t\u20AC5,97\t\u20AC7,22\tMARIA DOLORES  AGUILAR VERA\t74883642N\nPRPR241241518VF0F\t10/3/2025\tAEDEN25-31\t\u20AC51,08\t\u20AC61,81\tHEREDEROS ORTIZ AVILES CB  \tE19929090\nPRPR243111339N0F\t5/3/2025\tAEDEN25-30\t\u20AC4,31\t\u20AC5,21\tVICENTE GARCIA VALVERDE\t25401008S\nPRPR24724151QR0F\t5/3/2025\tAEDEN25-29\t\u20AC19,73\t\u20AC23,88\tMIGUEL ANGEL CUADRADO ROJAS\t30416425Y\nPRMR243201812T0F\t5/3/2025\tAEDEN25-28\t\u20AC7,44\t\u20AC9,00\tFERNANDO  MIRANDA  CASAS \t30829189N\nPRPR24451236M0F\t5/3/2025\tAEDEN25-27\t\u20AC8,08\t\u20AC9,77\tJOSE MANUEL COLODRERO GARCIA\t80136298C\nPRPR246191150LE0F\t5/3/2025\tAEDEN25-26\t\u20AC28,19\t\u20AC34,11\tCARLOS  RUIZ  MORA\t29866284W\nPRPR251221514DH0F\t5/3/2025\tAEDEN25-25\t\u20AC44,40\t\u20AC53,72\tCONCEPCION CAMACHO SALAZAR\t25301494E\nPRPR243191220E0F\t5/3/2025\tAEDEN25-24\t\u20AC6,34\t\u20AC7,67\tANTONIO DAVID GARCIA  CANO\t80149071M\nTRFAAV242221318K0F\t5/3/2025\tAEDEN25-23\t\u20AC19,88\t\u20AC24,06\tCasandra Madrigal Arellano\tY3271045E\nPRPR24313196A0F\t5/3/2025\tAEDEN25-22\t\u20AC5,12\t\u20AC6,19\tJOSE CENTELLA MILLAN\t30512464C\nPRPR243121748Q0F\t4/2/2025\tAEDEN25-21\t\u20AC6,33\t\u20AC7,66\tJUAN JOSE GALAN  LIJARCIO\t53590607D\nPRPR243121748E0F\t4/2/2025\tAEDEN25-20\t\u20AC2,68\t\u20AC3,24\tJUAN JOSE GALAN LIJARCIO\t53590607D\nPRPR251171849YP0F\t3/2/2025\tAEDEN25-19\t\u20AC18,83\t\u20AC22,78\tGESTION Y SERVICIOS BAENESES SL  \tB14646814\nPRPR251222051YV0F\t3/2/2025\tAEDEN25-18\t\u20AC27,02\t\u20AC32,70\tGESTION Y SERVICIOS BAENESES SL  \tB14646814\nPRPR24921844YX0F\t3/2/2025\tAEDEN25-17\t\u20AC35,36\t\u20AC42,79\tFRANCISCA MESA  MANTAS\t25752591C\nPRPR245221316HF0F\t3/2/2025\tAEDEN25-16\t\u20AC9,01\t\u20AC10,90\tMARIA ARACELI GARCIA VALENZUELA\t30975899M\nPRPR245221316TA0F\t3/2/2025\tAEDEN25-15\t\u20AC31,46\t\u20AC38,07\tMARIA ARACELI GARCIA VALENZUELA\t30975899M\nPRPR24362237E0F\t3/2/2025\tAEDEN25-14\t\u20AC4,17\t\u20AC5,05\tPAULA VALVERDE RECIO\t26824899E\nPRPR244121731H0F\t3/2/2025\tAEDEN25-13\t\u20AC10,06\t\u20AC12,17\tJUAN LORENZO PRADOS GONZALEZ\t30490713G\nPRPR245131356EG0F\t3/2/2025\tAEDEN25-12\t\u20AC15,75\t\u20AC19,06\tDOLORES BOLOS VILLANUEVA\t18880528N\nTRFAAV245301614MW0F\t23/1/2025\tAEDEN25-11\t\u20AC11,06\t\u20AC13,38\tANTONIO  JIM\u00C9NEZ  MORALES\t74613924S\nPRPR24410138W0F\t23/1/2025\tAEDEN25-10\t\u20AC19,30\t\u20AC23,35\tSANTIAGO CANO AGUILERA\t34001600X\nPRPR244102018N0F\t23/1/2025\tAEDEN25-09\t\u20AC6,94\t\u20AC8,39\tMETALURGICAS LOZANO SL  \tB14995153\nPRPR24522251TR0F\t23/1/2025\tAEDEN25-08\t\u20AC14,69\t\u20AC17,78\tMARIA CASTILLA ORTIZ\t30976970H\nPRPR24631419CF0F\t23/1/2025\tAEDEN25-07\t\u20AC11,61\t\u20AC14,05\tSHELENE TORRECILLAS FERNANDEZ\t46275759N\nPRJA24362237E0F\t23/1/2025\tAEDEN25-06\t\u20AC15,31\t\u20AC18,53\tANTONIO COMINO LUQUE\t50601264E\nPRJA24362237K0F\t23/1/2025\tAEDEN25-05\t\u20AC50,28\t\u20AC60,84\tANTONIO COMINO  LUQUE\t50601264E\nPRPR244161334G0F\t23/1/2025\tAEDEN25-04\t\u20AC16,04\t\u20AC19,41\tALDA RODRIGUES DE OLIVEIR\t43161981C\nPRPR248301348LR0F\t23/1/2025\tAEDEN25-03\t\u20AC48,55\t\u20AC58,74\tFRANCISCA ALCARAZ DIAZ\t80149451V\nPRPR24561945CE0F\t23/1/2025\tAEDEN25-02\t\u20AC25,43\t\u20AC30,76\tROSARIO ORTEGA DEL VISO\t75008596F\nPRPR245231948RM0F\t23/1/2025\tAEDEN25-01\t\u20AC21,74\t\u20AC26,30\tFRANCISCO MANUEL BALTANAS ORTEGA\t26045664G";
function parseEuro(val) {
    return parseFloat(val.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
}
function parseDate(val) {
    var _a = val.split('/'), day = _a[0], month = _a[1], year = _a[2];
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
var dirPath = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2025\\Emitidas\\Penalizaciones';
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var files, lines, _loop_1, _i, lines_1, line;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    files = fs_1.default.readdirSync(dirPath);
                    lines = data.split('\n').filter(function (l) { return l.trim() !== ''; });
                    _loop_1 = function (line) {
                        var parts, contractCode, dateStr, invoiceNumber, bipenStr, totalStr, issueDate, bipen, totalAmount, contract, existing, matchFile, pdfUrl, pdfBuffer;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    parts = line.split('\t');
                                    if (parts.length < 7)
                                        return [2 /*return*/, "continue"];
                                    contractCode = parts[0];
                                    dateStr = parts[1];
                                    invoiceNumber = parts[2];
                                    bipenStr = parts[3];
                                    totalStr = parts[4];
                                    issueDate = parseDate(dateStr);
                                    bipen = parseEuro(bipenStr);
                                    totalAmount = parseEuro(totalStr);
                                    console.log("Processing ".concat(invoiceNumber, " for contract ").concat(contractCode, "..."));
                                    return [4 /*yield*/, prisma_1.prisma.contract.findFirst({
                                            where: { contractCode: contractCode },
                                            orderBy: { version: 'desc' }
                                        })];
                                case 1:
                                    contract = _b.sent();
                                    if (!contract) {
                                        console.error("  Contract not found: ".concat(contractCode));
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.findUnique({
                                            where: { invoiceNumber: invoiceNumber }
                                        })];
                                case 2:
                                    existing = _b.sent();
                                    if (!!existing) return [3 /*break*/, 7];
                                    matchFile = files.find(function (f) { return f.startsWith(invoiceNumber) && f.endsWith('.pdf'); });
                                    pdfUrl = null;
                                    if (!matchFile) return [3 /*break*/, 4];
                                    console.log("  Found PDF: ".concat(matchFile, ", uploading..."));
                                    pdfBuffer = fs_1.default.readFileSync(path_1.default.join(dirPath, matchFile));
                                    return [4 /*yield*/, (0, r2_1.uploadFileToR2)("penalizaciones/2025/".concat(matchFile), pdfBuffer, 'application/pdf')];
                                case 3:
                                    pdfUrl = _b.sent();
                                    console.log("  Uploaded to ".concat(pdfUrl));
                                    return [3 /*break*/, 5];
                                case 4:
                                    console.log("  Warning: PDF not found for ".concat(invoiceNumber));
                                    _b.label = 5;
                                case 5: return [4 /*yield*/, prisma_1.prisma.penaltyInvoice.create({
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
                                case 6:
                                    _b.sent();
                                    console.log("  -> Created PenaltyInvoice ".concat(invoiceNumber));
                                    return [3 /*break*/, 8];
                                case 7:
                                    console.log("  PenaltyInvoice ".concat(invoiceNumber, " already exists."));
                                    _b.label = 8;
                                case 8: 
                                // Mark contract as facturada
                                return [4 /*yield*/, prisma_1.prisma.contract.update({
                                        where: { id: contract.id },
                                        data: {
                                            penalization: bipen,
                                            penaltyStatus: 'FACTURADA'
                                        }
                                    })];
                                case 9:
                                    // Mark contract as facturada
                                    _b.sent();
                                    console.log("  -> Marked contract ".concat(contractCode, " as FACTURADA (").concat(bipen, "\u20AC)"));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, lines_1 = lines;
                    _a.label = 1;
                case 1:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 4];
                    line = lines_1[_i];
                    return [5 /*yield**/, _loop_1(line)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
run()
    .catch(console.error)
    .finally(function () { return prisma_1.prisma.$disconnect(); });
