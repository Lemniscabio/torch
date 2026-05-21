import { Router } from "express";
import { forgotPassword, handleAuth, resetPassword } from "../controllers/auth.controller";
import { getUser } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", handleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
// "Me" endpoint for the BFF to bootstrap the session.
router.get("/me", requireAuth, getUser);

export default router;
