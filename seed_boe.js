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
function seed() {
    return __awaiter(this, void 0, void 0, function () {
        var boe, _i, boe_1, b;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    boe = [
                        { t: '2.0TD', p1: 16.7, p2: 16.3, p3: 18.0, p4: null, p5: null, p6: null },
                        { t: '3.0TD', p1: 16.6, p2: 17.5, p3: 16.5, p4: 16.5, p5: 13.8, p6: 18.0 },
                        { t: '6.1TD', p1: 6.7, p2: 6.8, p3: 6.5, p4: 6.5, p5: 4.3, p6: 7.7 },
                        { t: '6.2TD', p1: 5.2, p2: 5.4, p3: 4.9, p4: 5.0, p5: 3.5, p6: 5.4 },
                        { t: '6.3TD', p1: 4.2, p2: 4.3, p3: 4.0, p4: 4.0, p5: 3.0, p6: 4.4 },
                        { t: '6.4TD', p1: 1.6, p2: 1.6, p3: 1.6, p4: 1.6, p5: 1.5, p6: 1.7 },
                    ];
                    _i = 0, boe_1 = boe;
                    _a.label = 1;
                case 1:
                    if (!(_i < boe_1.length)) return [3 /*break*/, 4];
                    b = boe_1[_i];
                    return [4 /*yield*/, prisma_1.prisma.regulatedCost.create({
                            data: {
                                concept: 'PERDIDAS',
                                tariff: b.t,
                                validFrom: new Date('2020-01-01T00:00:00Z'),
                                validTo: new Date('2099-12-31T23:59:59Z'),
                                p1: b.p1, p2: b.p2, p3: b.p3, p4: b.p4, p5: b.p5, p6: b.p6
                            }
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('BOE inserted.');
                    return [2 /*return*/];
            }
        });
    });
}
seed().finally(function () { return prisma_1.prisma.$disconnect(); });
