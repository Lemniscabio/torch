import { prisma } from "../config/db";
import {
  runAssessment,
  runWhatIf,
  type ProcessInputs,
  type WhatIfParams,
} from "@torch/core";

// Compute results server-side. Single source of truth for assessment math —
// the frontend no longer ships engine code, so the only valid place this
// computation can happen is here.
export function computeAssessment(inputs: ProcessInputs) {
  return runAssessment(inputs);
}

// Apply target-scale "what-if" modifications and recompute the five risk
// domains for the modified inputs. The frontend uses this to power the
// interactive what-if buttons on each domain panel.
export function computeWhatIf(inputs: ProcessInputs, params: WhatIfParams) {
  return runWhatIf(inputs, params);
}

export async function getAssessments(email: string) {
  const assessments = await prisma.assessment.findMany({
    where: { user_email: email.toLowerCase() },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      inputs: true,
      results: true,
      created_at: true,
    },
  });

  return assessments;
}

export async function getAssessmentById(id: string, email: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: {
      id: true,
      inputs: true,
      results: true,
      created_at: true,
      user_email: true,
    },
  });

  if (!assessment) {
    throw { status: 404, message: "Not found" };
  }

  if (assessment.user_email !== email.toLowerCase()) {
    throw { status: 403, message: "Access denied" };
  }

  return assessment;
}

export async function saveAssessment(email: string, inputs: ProcessInputs) {
  const normalisedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });

  if (!user) {
    throw { status: 401, message: "User not found" };
  }

  // Compute results server-side — never trust a client-supplied result blob.
  const results = computeAssessment(inputs);

  const assessment = await prisma.assessment.create({
    data: {
      user_email: normalisedEmail,
      inputs: inputs as any,
      results: results as any,
    },
  });

  return { id: assessment.id, results };
}

export async function deleteAssessment(id: string, email: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: { user_email: true },
  });

  if (!assessment) {
    throw { status: 404, message: "Not found" };
  }

  if (assessment.user_email !== email.toLowerCase()) {
    throw { status: 403, message: "Access denied" };
  }

  await prisma.assessment.delete({ where: { id } });
}
