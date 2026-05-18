"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./middlewares/error.middleware");
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const assessment_route_1 = __importDefault(require("./routes/assessment.route"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({ origin: env_1.env.FRONTEND_URL, credentials: true }));
app.use(express_1.default.json());
// Routes
app.use("/api/auth", auth_route_1.default);
app.use("/api/assessments", assessment_route_1.default);
app.use("/api/user", user_route_1.default);
// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handling
app.use(error_middleware_1.errorHandler);
app.listen(env_1.env.PORT, () => {
    console.log(`Lemnisca API running on port ${env_1.env.PORT}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map