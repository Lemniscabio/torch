import { Router } from "express";
import {
  getAssessments,
  getAssessmentById,
  saveAssessment,
  deleteAssessment,
  previewAssessment,
  whatifAssessment,
} from "../controllers/assessment.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Compute results without persisting — public so anonymous users can try the
// app. Auth users hit /save instead, which computes AND persists.
router.post("/preview", previewAssessment);

// Re-run the engine with target-scale modifications applied. Public so the
// dashboard's interactive what-if buttons work for any logged-in OR anonymous
// session. Stateless — never persists.
router.post("/whatif", whatifAssessment);

router.get("/", requireAuth, getAssessments);
router.get("/:id", requireAuth, getAssessmentById);
router.post("/save", requireAuth, saveAssessment);
router.delete("/:id", requireAuth, deleteAssessment);

export default router;
