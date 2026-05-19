"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssessments = getAssessments;
exports.getAssessmentById = getAssessmentById;
exports.deleteAssessment = deleteAssessment;
exports.saveAssessment = saveAssessment;
exports.previewAssessment = previewAssessment;
const assessmentService = __importStar(require("../services/assessment.service"));
async function getAssessments(req, res) {
    try {
        const email = req.user.email;
        const assessments = await assessmentService.getAssessments(email);
        res.json({ assessments });
    }
    catch (error) {
        console.error("Failed to fetch assessments:", error);
        res.status(500).json({ error: "Internal error" });
    }
}
async function getAssessmentById(req, res) {
    try {
        const id = req.params.id;
        const email = req.user.email;
        const assessment = await assessmentService.getAssessmentById(id, email);
        res.json(assessment);
    }
    catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error("Failed to fetch assessment:", error);
        res.status(500).json({ error: "Internal error" });
    }
}
async function deleteAssessment(req, res) {
    try {
        const id = req.params.id;
        const email = req.user.email;
        await assessmentService.deleteAssessment(id, email);
        res.json({ ok: true });
    }
    catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error("Failed to delete assessment:", error);
        res.status(500).json({ error: "Internal error" });
    }
}
async function saveAssessment(req, res) {
    try {
        const email = req.user.email;
        const { inputs } = req.body;
        if (!inputs) {
            res.status(400).json({ error: "Missing inputs" });
            return;
        }
        const result = await assessmentService.saveAssessment(email, inputs);
        res.json(result);
    }
    catch (error) {
        console.error("Failed to save assessment (non-blocking):", error);
        res.json({ id: null });
    }
}
async function previewAssessment(req, res) {
    try {
        const { inputs } = req.body;
        if (!inputs) {
            res.status(400).json({ error: "Missing inputs" });
            return;
        }
        const results = assessmentService.computeAssessment(inputs);
        res.json({ results });
    }
    catch (error) {
        console.error("Preview compute failed:", error);
        res.status(400).json({ error: error?.message || "Could not run assessment." });
    }
}
//# sourceMappingURL=assessment.controller.js.map