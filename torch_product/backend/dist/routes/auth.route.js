"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/", auth_controller_1.handleAuth);
// "Me" endpoint for the BFF to bootstrap the session.
router.get("/me", auth_middleware_1.requireAuth, user_controller_1.getUser);
exports.default = router;
//# sourceMappingURL=auth.route.js.map