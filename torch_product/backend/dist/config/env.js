"use strict";
// Loads .env from the backend root in dev. In production (Cloud Run),
// environment variables are injected directly — dotenv is a no-op when
// no file is present.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") });
exports.env = {
    PORT: parseInt(process.env.PORT || "4000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL || "",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    JWT_SECRET: process.env.JWT_SECRET || "torch-dev-secret-change-in-production",
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
    COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
};
//# sourceMappingURL=env.js.map