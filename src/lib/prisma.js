"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
var client_1 = require("@prisma/client");
var pg_1 = require("pg");
var adapter_pg_1 = require("@prisma/adapter-pg");
var globalForPrisma = global;
exports.prisma = globalForPrisma.prisma ||
    (function () {
        var connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
        var pool = new pg_1.Pool({
            connectionString: connectionString,
            max: process.env.NODE_ENV === 'production' ? 5 : 1,
            idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 30000 : 2000,
        });
        var adapter = new adapter_pg_1.PrismaPg(pool);
        return new client_1.PrismaClient({ adapter: adapter });
    })();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
