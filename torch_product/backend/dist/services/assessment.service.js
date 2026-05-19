"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAssessment = computeAssessment;
exports.getAssessments = getAssessments;
exports.getAssessmentById = getAssessmentById;
exports.saveAssessment = saveAssessment;
exports.deleteAssessment = deleteAssessment;
const db_1 = require("../config/db");
const core_1 = require("@torch/core");
// Compute results server-side. Single source of truth for assessment math —
// the frontend no longer ships engine code, so the only valid place this
// computation can happen is here.
function computeAssessment(inputs) {
    return (0, core_1.runAssessment)(inputs);
}
async function getAssessments(email) {
    const assessments = await db_1.prisma.assessment.findMany({
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
async function getAssessmentById(id, email) {
    const assessment = await db_1.prisma.assessment.findUnique({
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
async function saveAssessment(email, inputs) {
    const normalisedEmail = email.toLowerCase();
    const user = await db_1.prisma.user.findUnique({
        where: { email: normalisedEmail },
    });
    if (!user) {
        throw { status: 401, message: "User not found" };
    }
    // Compute results server-side — never trust a client-supplied result blob.
    const results = computeAssessment(inputs);
    const assessment = await db_1.prisma.assessment.create({
        data: {
            user_email: normalisedEmail,
            inputs: inputs,
            results: results,
        },
    });
    return { id: assessment.id, results };
}
async function deleteAssessment(id, email) {
    const assessment = await db_1.prisma.assessment.findUnique({
        where: { id },
        select: { user_email: true },
    });
    if (!assessment) {
        throw { status: 404, message: "Not found" };
    }
    if (assessment.user_email !== email.toLowerCase()) {
        throw { status: 403, message: "Access denied" };
    }
    await db_1.prisma.assessment.delete({ where: { id } });
}
//# sourceMappingURL=assessment.service.js.map