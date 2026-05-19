import { type ProcessInputs, type WhatIfParams } from "@torch/core";
export declare function computeAssessment(inputs: ProcessInputs): import("@torch/core").PartialAssessmentResult;
export declare function computeWhatIf(inputs: ProcessInputs, params: WhatIfParams): import("@torch/core").WhatIfResult;
export declare function getAssessments(email: string): Promise<{
    id: string;
    created_at: Date;
    inputs: import("@prisma/client/runtime/client").JsonValue;
    results: import("@prisma/client/runtime/client").JsonValue;
}[]>;
export declare function getAssessmentById(id: string, email: string): Promise<{
    id: string;
    created_at: Date;
    user_email: string;
    inputs: import("@prisma/client/runtime/client").JsonValue;
    results: import("@prisma/client/runtime/client").JsonValue;
}>;
export declare function saveAssessment(email: string, inputs: ProcessInputs): Promise<{
    id: string;
    results: import("@torch/core").PartialAssessmentResult;
}>;
export declare function deleteAssessment(id: string, email: string): Promise<void>;
//# sourceMappingURL=assessment.service.d.ts.map