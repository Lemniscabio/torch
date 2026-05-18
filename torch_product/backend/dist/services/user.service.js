"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = getUser;
const db_1 = require("../config/db");
async function getUser(email) {
    const user = await db_1.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
            id: true,
            email: true,
            company_domain: true,
            created_at: true,
            _count: { select: { assessments: true } },
        },
    });
    if (!user) {
        throw { status: 404, message: "User not found" };
    }
    return {
        id: user.id,
        email: user.email,
        company_domain: user.company_domain,
        created_at: user.created_at,
        assessment_count: user._count.assessments,
    };
}
//# sourceMappingURL=user.service.js.map