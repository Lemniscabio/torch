"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssessments = getAssessments;
exports.getAssessmentById = getAssessmentById;
exports.saveAssessment = saveAssessment;
exports.deleteAssessment = deleteAssessment;
const db_1 = require("../config/db");
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
async function saveAssessment(email, inputs, results) {
    const normalisedEmail = email.toLowerCase();
    const user = await db_1.prisma.user.findUnique({
        where: { email: normalisedEmail },
    });
    if (!user) {
        throw { status: 401, message: "User not found" };
    }
    const assessment = await db_1.prisma.assessment.create({
        data: {
            user_email: normalisedEmail,
            inputs: inputs,
            results: results,
        },
    });
    return { id: assessment.id };
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