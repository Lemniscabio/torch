import { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function handleAuth(req: Request, res: Response) {
  try {
    const { email, password, action } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    if (action === "signup") {
      const user = await authService.signup(email, password);
      res.json({ ok: true, user });
      return;
    }

    if (action === "login") {
      const user = await authService.login(email, password);
      res.json({ ok: true, user });
      return;
    }

    res.status(400).json({ error: "Invalid action." });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Auth error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    res.json({
      ok: true,
      message: "If an account exists for that email, we sent a reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.json({
      ok: true,
      message: "If an account exists for that email, we sent a reset link.",
    });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    res.json({ ok: true });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
