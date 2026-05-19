// Types live canonically in @torch/core-shared so the frontend can use them
// without pulling in the engine. This shim keeps every `from "../types"`
// import in the engine working unchanged.
export * from "@torch/core-shared";
