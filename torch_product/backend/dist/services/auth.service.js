"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.login = login;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const email_validation_1 = require("../helpers/email-validation");
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
function validatePassword(password) {
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        throw { status: 400, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }
}
async function signup(email, password) {
    const check = (0, email_validation_1.validateWorkEmail)(email);
    if (!check.valid) {
        throw { status: 400, message: check.error ?? "Invalid email." };
    }
    validatePassword(password);
    const normalisedEmail = email.toLowerCase().trim();
    const domain = (0, email_validation_1.extractDomain)(normalisedEmail);
    const existing = await db_1.prisma.user.findUnique({
        where: { email: normalisedEmail },
    });
    if (existing) {
        throw { status: 409, message: "An account with this email already exists. Please sign in." };
    }
    const passwordHash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
    const user = await db_1.prisma.user.create({
        data: {
            email: normalisedEmail,
            password_hash: passwordHash,
            company_domain: domain,
        },
    });
    const token = (0, auth_middleware_1.signToken)({ userId: user.id, email: user.email });
    return { id: user.id, email: user.email, company_domain: user.company_domain, token };
}
async function login(email, password) {
    if (typeof email !== "string" || typeof password !== "string") {
        throw { status: 400, message: "Email and password are required." };
    }
    const normalisedEmail = email.toLowerCase().trim();
    const user = await db_1.prisma.user.findUnique({
        where: { email: normalisedEmail },
    });
    if (!user) {
        throw { status: 404, message: "No account found with this email. Please sign up." };
    }
    const valid = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!valid) {
        throw { status: 401, message: "Incorrect password." };
    }
    const token = (0, auth_middleware_1.signToken)({ userId: user.id, email: user.email });
    return { id: user.id, email: user.email, company_domain: user.company_domain, token };
}
//# sourceMappingURL=auth.service.js.map