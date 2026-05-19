import { Request, Response } from "express";
import * as assessmentService from "../services/assessment.service";

export async function getAssessments(req: Request, res: Response) {
  try {
    const email = req.user!.email;
    const assessments = await assessmentService.getAssessments(email);
    res.json({ assessments });
  } catch (error: any) {
    console.error("Failed to fetch assessments:", error);
    res.status(500).json({ error: "Internal error" });
  }
}

export async function getAssessmentById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const email = req.user!.email;
    const assessment = await assessmentService.getAssessmentById(id, email);
    res.json(assessment);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Failed to fetch assessment:", error);
    res.status(500).json({ error: "Internal error" });
  }
}

export async function deleteAssessment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const email = req.user!.email;
    await assessmentService.deleteAssessment(id, email);
    res.json({ ok: true });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Failed to delete assessment:", error);
    res.status(500).json({ error: "Internal error" });
  }
}

export async function saveAssessment(req: Request, res: Response) {
  try {
    const email = req.user!.email;
    const { inputs } = req.body;

    if (!inputs) {
      res.status(400).json({ error: "Missing inputs" });
      return;
    }

    const result = await assessmentService.saveAssessment(email, inputs);
    res.json(result);
  } catch (error: any) {
    console.error("Failed to save assessment (non-blocking):", error);
    res.json({ id: null });
  }
}

export async function previewAssessment(req: Request, res: Response) {
  try {
    const { inputs } = req.body;
    if (!inputs) {
      res.status(400).json({ error: "Missing inputs" });
      return;
    }
    const results = assessmentService.computeAssessment(inputs);
    res.json({ results });
  } catch (error: any) {
    console.error("Preview compute failed:", error);
    res.status(400).json({ error: error?.message || "Could not run assessment." });
  }
}
