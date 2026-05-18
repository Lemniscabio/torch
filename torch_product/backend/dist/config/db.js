"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("./env");
function createPrismaClient() {
    const adapter = new adapter_pg_1.PrismaPg({ connectionString: env_1.env.DATABASE_URL });
    return new client_1.PrismaClient({ adapter });
}
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (env_1.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
//# sourceMappingURL=db.js.map