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
var prisma_1 = require("./src/lib/prisma");
var date_fns_1 = require("date-fns");
function investigate() {
    return __awaiter(this, void 0, void 0, function () {
        var invoices, breakdown, total, _i, invoices_1, inv, month, mwh, _a, _b, m;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, prisma_1.prisma.invoice.findMany({
                        where: {
                            issueDate: {
                                gte: new Date('2025-10-01'),
                                lte: new Date('2025-10-31')
                            }
                        }
                    })];
                case 1:
                    invoices = _c.sent();
                    breakdown = {};
                    total = 0;
                    for (_i = 0, invoices_1 = invoices; _i < invoices_1.length; _i++) {
                        inv = invoices_1[_i];
                        if (!inv.billingEnd)
                            continue;
                        month = (0, date_fns_1.format)(new Date(inv.billingEnd), 'yyyy-MM');
                        if (!breakdown[month])
                            breakdown[month] = 0;
                        mwh = inv.totalMWh || 0;
                        // Para asegurarnos de la lógica del dashboard, el dashboard hace:
                        // SUM(COALESCE("totalMWh", 0) * CASE WHEN "invoiceType" = 'Abono' THEN -1 ELSE 1 END)
                        if (inv.invoiceType === 'Abono')
                            mwh = -Math.abs(mwh);
                        breakdown[month] += mwh;
                        total += mwh;
                    }
                    console.log('--- Invoices Issued in October 2025 (Dashboard 2025-10) ---');
                    console.log("Total MWh: ".concat((total / 1000).toFixed(2)));
                    for (_a = 0, _b = Object.keys(breakdown).sort(); _a < _b.length; _a++) {
                        m = _b[_a];
                        console.log("  Consumption from ".concat(m, ": ").concat((breakdown[m] / 1000).toFixed(2), " MWh"));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
investigate().finally(function () { return prisma_1.prisma.$disconnect(); });
