import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { signToken } from "../middlewares/auth.middleware";
import { validateWorkEmail, extractDomain } from "../helpers/email-validation";
import { sendPasswordResetEmail } from "./email.service";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = 30;

function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw { status: 400, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token: string) {
  const url = new URL("/login", env.FRONTEND_URL);
  url.searchParams.set("mode", "reset");
  url.searchParams.set("token", token);
  return url.toString();
}

export async function signup(email: string, password: string) {
  const check = validateWorkEmail(email);
  if (!check.valid) {
    throw { status: 400, message: check.error ?? "Invalid email." };
  }
  validatePassword(password);

  const normalisedEmail = email.toLowerCase().trim();
  const domain = extractDomain(normalisedEmail);

  const existing = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });

  if (existing) {
    throw { status: 409, message: "An account with this email already exists. Please sign in." };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: normalisedEmail,
      password_hash: passwordHash,
      company_domain: domain,
    },
  });

  const token = signToken({ userId: user.id, email: user.email });

  return { id: user.id, email: user.email, company_domain: user.company_domain, token };
}

export async function login(email: string, password: string) {
  if (typeof email !== "string" || typeof password !== "string") {
    throw { status: 400, message: "Email and password are required." };
  }
  const normalisedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });

  if (!user) {
    throw { status: 404, message: "No account found with this email. Please sign up." };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw { status: 401, message: "Incorrect password." };
  }

  const token = signToken({ userId: user.id, email: user.email });

  return { id: user.id, email: user.email, company_domain: user.company_domain, token };
}

export async function requestPasswordReset(email: string) {
  if (typeof email !== "string") return;

  const normalisedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });

  if (!user) return;

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({
    where: {
      user_email: user.email,
      used_at: null,
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      user_email: user.email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  });

  await sendPasswordResetEmail(user.email, buildResetUrl(token));
}

export async function resetPassword(token: string, password: string) {
  if (typeof token !== "string" || token.length < 32) {
    throw { status: 400, message: "Reset link is invalid or expired." };
  }
  validatePassword(password);

  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date()) {
    throw { status: 400, message: "Reset link is invalid or expired." };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: resetToken.user_email },
      data: { password_hash: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used_at: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        user_email: resetToken.user_email,
        used_at: null,
        id: { not: resetToken.id },
      },
    }),
  ]);
}
