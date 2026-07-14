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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var prisma_1 = require("./src/lib/prisma");
function investigate() {
    return __awaiter(this, void 0, void 0, function () {
        var sps, cupsList, oct, nov, getMap, octMap, novMap, keys, _i, _a, k, o, n;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_1.prisma.supplyPoint.findMany({
                        where: { segment: 'VIP', province: 'Córdoba' }
                    })];
                case 1:
                    sps = _b.sent();
                    cupsList = sps.map(function (sp) { return sp.cups.substring(0, 20); });
                    return [4 /*yield*/, prisma_1.prisma.loadCurve.findMany({
                            where: { date: new Date('2025-10-10'), cups: { in: cupsList } }
                        })];
                case 2:
                    oct = _b.sent();
                    return [4 /*yield*/, prisma_1.prisma.loadCurve.findMany({
                            where: { date: new Date('2025-11-10'), cups: { in: cupsList } }
                        })];
                case 3:
                    nov = _b.sent();
                    getMap = function (data) {
                        var res = {};
                        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
                            var d = data_1[_i];
                            res[d.cups] = d.readings.reduce(function (a, b) { return a + b; }, 0);
                        }
                        return res;
                    };
                    octMap = getMap(oct);
                    novMap = getMap(nov);
                    keys = new Set(__spreadArray(__spreadArray([], Object.keys(octMap), true), Object.keys(novMap), true));
                    for (_i = 0, _a = Array.from(keys).sort(); _i < _a.length; _i++) {
                        k = _a[_i];
                        o = octMap[k] || 0;
                        n = novMap[k] || 0;
                        if (Math.abs(o - n) > 500) {
                            console.log("CUPS ".concat(k, ": Oct = ").concat(Math.round(o), " kWh, Nov = ").concat(Math.round(n), " kWh, diff = ").concat(Math.round(o - n)));
                        }
                    }
                    return [2 /*return*/];
            }
        });
    });
}
investigate().finally(function () { return prisma_1.prisma.$disconnect(); });
