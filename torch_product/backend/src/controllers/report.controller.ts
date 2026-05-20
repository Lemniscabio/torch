import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { generatePdf } from "../services/report.service";
import type { ProcessInputs, PartialAssessmentResult } from "@torch/core-shared";

export async function generateReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = req.user?.email as string;
    const id = req.params["id"] as string;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { id: true, inputs: true, results: true, user_email: true },
    });

    if (!assessment) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }

    if (assessment.user_email !== email.toLowerCase()) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const inputs = assessment.inputs as unknown as ProcessInputs;
    const results = assessment.results as unknown as PartialAssessmentResult;

    const pdfBuffer = await generatePdf(inputs, results);

    const species = (inputs.organism_species ?? "report").replace(/_/g, "-");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `lemnisca-torch-${species}-${date}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
