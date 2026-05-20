import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { generateReport } from "../controllers/report.controller";

const router = Router();

router.post("/:id/pdf", requireAuth, generateReport);

export default router;
