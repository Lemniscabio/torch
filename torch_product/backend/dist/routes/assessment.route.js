"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assessment_controller_1 = require("../controllers/assessment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/", auth_middleware_1.requireAuth, assessment_controller_1.getAssessments);
router.get("/:id", auth_middleware_1.requireAuth, assessment_controller_1.getAssessmentById);
router.post("/save", auth_middleware_1.requireAuth, assessment_controller_1.saveAssessment);
router.delete("/:id", auth_middleware_1.requireAuth, assessment_controller_1.deleteAssessment);
exports.default = router;
//# sourceMappingURL=assessment.route.js.map