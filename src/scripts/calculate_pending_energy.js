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
require("dotenv/config");
var prisma_1 = require("../lib/prisma");
var date_fns_1 = require("date-fns");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var today, endRange, startRange, reganecuRecords, reganecuByMonth, _i, reganecuRecords_1, record, monthKey, aggregatedCurves, dailyConsumptionBySegment, _a, aggregatedCurves_1, curve, dayKey, dayMap, segment, h, prices, pricesByDateComponent, _b, prices_1, price, dayKey, i, currentMonthStart, currentMonthEnd, monthKey, regRecord, cierreBase, reganecuMatricialRecords, dsvPriceByDayPeriod, cadEnergyByDayPeriod, _c, reganecuMatricialRecords_1, matRecord, dayKey, jData, aggDsv, aggCad, _d, jData_1, item, period, _e, _f, p, period, data, price, _g, _h, p, totalEstimatedBcMwh, totalLiquidatedMwh, totalPendingMwh, totalEstimatedPendingCostEur, d, dateObj, dayKey, consumption, os, restricciones, perd20, perd30, perd61, h, hBcMwh, _j, _k, seg, period, hLiquidatedMwh, hDsvPrice, hPendingMwh, hPrice, hPendingCostEur;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    console.log('Iniciando cálculo de energía pendiente con cálculo horario exacto...');
                    today = new Date();
                    endRange = (0, date_fns_1.endOfMonth)(today);
                    startRange = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(today, 11));
                    return [4 /*yield*/, prisma_1.prisma.reganecuData.findMany({
                            where: {
                                date: { gte: startRange, lte: endRange },
                                total: true,
                                matricial: false
                            },
                            orderBy: [
                                { date: 'desc' },
                                { cierre: 'desc' }
                            ]
                        })];
                case 1:
                    reganecuRecords = _l.sent();
                    reganecuByMonth = new Map();
                    for (_i = 0, reganecuRecords_1 = reganecuRecords; _i < reganecuRecords_1.length; _i++) {
                        record = reganecuRecords_1[_i];
                        monthKey = (0, date_fns_1.format)(record.date, 'yyyy-MM');
                        if (!reganecuByMonth.has(monthKey)) {
                            reganecuByMonth.set(monthKey, record);
                        }
                    }
                    return [4 /*yield*/, prisma_1.prisma.aggregatedLoadCurve.findMany({
                            where: {
                                date: { gte: startRange, lte: endRange }
                            }
                        })];
                case 2:
                    aggregatedCurves = _l.sent();
                    dailyConsumptionBySegment = new Map();
                    for (_a = 0, aggregatedCurves_1 = aggregatedCurves; _a < aggregatedCurves_1.length; _a++) {
                        curve = aggregatedCurves_1[_a];
                        dayKey = (0, date_fns_1.format)(curve.date, 'yyyy-MM-dd');
                        if (!dailyConsumptionBySegment.has(dayKey)) {
                            dailyConsumptionBySegment.set(dayKey, {});
                        }
                        dayMap = dailyConsumptionBySegment.get(dayKey);
                        segment = curve.segment;
                        if (!dayMap[segment]) {
                            dayMap[segment] = Array(24).fill(0);
                        }
                        for (h = 0; h < 24; h++) {
                            if (curve.totalConsumption[h]) {
                                dayMap[segment][h] += curve.totalConsumption[h];
                            }
                        }
                    }
                    return [4 /*yield*/, prisma_1.prisma.systemComponentPrice.findMany({
                            where: {
                                date: { gte: startRange, lte: endRange },
                                component: { in: ['OS', 'RESTRICCIONES', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }
                            }
                        })];
                case 3:
                    prices = _l.sent();
                    pricesByDateComponent = new Map();
                    for (_b = 0, prices_1 = prices; _b < prices_1.length; _b++) {
                        price = prices_1[_b];
                        dayKey = (0, date_fns_1.format)(price.date, 'yyyy-MM-dd');
                        pricesByDateComponent.set("".concat(dayKey, "_").concat(price.component), price.values);
                    }
                    i = 11;
                    _l.label = 4;
                case 4:
                    if (!(i >= 0)) return [3 /*break*/, 8];
                    currentMonthStart = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(today, i));
                    currentMonthEnd = (0, date_fns_1.endOfMonth)(currentMonthStart);
                    monthKey = (0, date_fns_1.format)(currentMonthStart, 'yyyy-MM');
                    regRecord = reganecuByMonth.get(monthKey);
                    cierreBase = 'N/A';
                    if (regRecord && regRecord.jsonData) {
                        cierreBase = regRecord.cierre;
                    }
                    return [4 /*yield*/, prisma_1.prisma.reganecuData.findMany({
                            where: {
                                date: { gte: currentMonthStart, lte: currentMonthEnd },
                                cierre: cierreBase,
                                matricial: true,
                                resolution: { in: ['H', 'QH'] }
                            },
                        })];
                case 5:
                    reganecuMatricialRecords = _l.sent();
                    dsvPriceByDayPeriod = new Map();
                    cadEnergyByDayPeriod = new Map();
                    for (_c = 0, reganecuMatricialRecords_1 = reganecuMatricialRecords; _c < reganecuMatricialRecords_1.length; _c++) {
                        matRecord = reganecuMatricialRecords_1[_c];
                        dayKey = (0, date_fns_1.format)(matRecord.date, 'yyyy-MM-dd');
                        jData = matRecord.jsonData;
                        if (!Array.isArray(jData))
                            continue;
                        if (matRecord.resolution === 'H' || matRecord.resolution === 'QH') {
                            aggDsv = {};
                            aggCad = {};
                            for (_d = 0, jData_1 = jData; _d < jData_1.length; _d++) {
                                item = jData_1[_d];
                                period = item.period;
                                if (item.concept === 'DSV' || item.concept === 'DVS') {
                                    if (!aggDsv[period])
                                        aggDsv[period] = { e: 0, c: 0 };
                                    aggDsv[period].e += (item.energyVentas || 0) + (item.energyCompras || 0);
                                    aggDsv[period].c += (item.costDerechos || 0) + (item.costObligaciones || 0);
                                }
                                else if (item.concept === 'CAD') {
                                    if (!aggCad[period])
                                        aggCad[period] = 0;
                                    aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
                                }
                            }
                            for (_e = 0, _f = Object.keys(aggDsv); _e < _f.length; _e++) {
                                p = _f[_e];
                                period = parseInt(p);
                                data = aggDsv[period];
                                price = 0;
                                if (data.e > 0) {
                                    price = data.c / data.e;
                                }
                                dsvPriceByDayPeriod.set("".concat(dayKey, "_").concat(period), price);
                            }
                            for (_g = 0, _h = Object.keys(aggCad); _g < _h.length; _g++) {
                                p = _h[_g];
                                cadEnergyByDayPeriod.set("".concat(dayKey, "_").concat(p), aggCad[parseInt(p)]);
                            }
                        }
                    }
                    totalEstimatedBcMwh = 0;
                    totalLiquidatedMwh = 0;
                    totalPendingMwh = 0;
                    totalEstimatedPendingCostEur = 0;
                    for (d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
                        dateObj = new Date(currentMonthStart);
                        dateObj.setDate(d);
                        dayKey = (0, date_fns_1.format)(dateObj, 'yyyy-MM-dd');
                        consumption = dailyConsumptionBySegment.get(dayKey);
                        if (!consumption)
                            continue;
                        os = pricesByDateComponent.get("".concat(dayKey, "_OS")) || Array(24).fill(0);
                        restricciones = pricesByDateComponent.get("".concat(dayKey, "_RESTRICCIONES")) || Array(24).fill(0);
                        perd20 = pricesByDateComponent.get("".concat(dayKey, "_PERD_20TD")) || Array(24).fill(0);
                        perd30 = pricesByDateComponent.get("".concat(dayKey, "_PERD_30TD")) || Array(24).fill(0);
                        perd61 = pricesByDateComponent.get("".concat(dayKey, "_PERD_61TD")) || Array(24).fill(0);
                        for (h = 0; h < 24; h++) {
                            hBcMwh = 0;
                            if (consumption['2.0TD'] && consumption['2.0TD'][h]) {
                                hBcMwh += (consumption['2.0TD'][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h] / 100 : perd20[h]));
                            }
                            if (consumption['3.0TD'] && consumption['3.0TD'][h]) {
                                hBcMwh += (consumption['3.0TD'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h] / 100 : perd30[h]));
                            }
                            if (consumption['3.0TDVE'] && consumption['3.0TDVE'][h]) {
                                hBcMwh += (consumption['3.0TDVE'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h] / 100 : perd30[h]));
                            }
                            if (consumption['6.1TD'] && consumption['6.1TD'][h]) {
                                hBcMwh += (consumption['6.1TD'][h] / 1000) * (1 + (perd61[h] > 2.0 ? perd61[h] / 100 : perd61[h]));
                            }
                            for (_j = 0, _k = Object.keys(consumption); _j < _k.length; _j++) {
                                seg = _k[_j];
                                if (!['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].includes(seg) && consumption[seg][h]) {
                                    hBcMwh += (consumption[seg][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h] / 100 : perd20[h]));
                                }
                            }
                            period = h + 1;
                            hLiquidatedMwh = cadEnergyByDayPeriod.get("".concat(dayKey, "_").concat(period)) || 0;
                            hDsvPrice = dsvPriceByDayPeriod.get("".concat(dayKey, "_").concat(period)) || dsvPriceByDayPeriod.get("".concat(dayKey, "_0")) || 0;
                            if (dayKey === '2025-11-01' && h === 0) {
                                console.log('hDsvPrice for 2025-11-01:', hDsvPrice);
                                console.log('Map has 2025-11-01_0?', dsvPriceByDayPeriod.get('2025-11-01_0'));
                                console.log('Map size:', dsvPriceByDayPeriod.size);
                            }
                            hPendingMwh = hBcMwh - hLiquidatedMwh;
                            hPrice = hDsvPrice + (os[h] || 0) + (restricciones[h] || 0);
                            hPendingCostEur = hPendingMwh * hPrice;
                            totalEstimatedBcMwh += hBcMwh;
                            totalLiquidatedMwh += hLiquidatedMwh;
                            totalPendingMwh += hPendingMwh;
                            totalEstimatedPendingCostEur += hPendingCostEur;
                        }
                    }
                    return [4 /*yield*/, prisma_1.prisma.pendingEnergySummary.upsert({
                            where: { month: monthKey },
                            update: {
                                cierre: cierreBase,
                                estimatedBcMwh: totalEstimatedBcMwh,
                                liquidatedMwh: totalLiquidatedMwh,
                                pendingMwh: totalPendingMwh,
                                estimatedPendingCostEur: totalEstimatedPendingCostEur
                            },
                            create: {
                                month: monthKey,
                                cierre: cierreBase,
                                estimatedBcMwh: totalEstimatedBcMwh,
                                liquidatedMwh: totalLiquidatedMwh,
                                pendingMwh: totalPendingMwh,
                                estimatedPendingCostEur: totalEstimatedPendingCostEur
                            }
                        })];
                case 6:
                    _l.sent();
                    console.log("\u2705 Mes ".concat(monthKey, " procesado. Cierre: ").concat(cierreBase, ". Pendiente MWh: ").concat(totalPendingMwh.toFixed(2), " | Coste: ").concat(totalEstimatedPendingCostEur.toFixed(2), "\u20AC"));
                    _l.label = 7;
                case 7:
                    i--;
                    return [3 /*break*/, 4];
                case 8:
                    console.log('Cálculo finalizado exitosamente.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('Error calculando:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma_1.prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
