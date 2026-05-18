// @torch/core — pure calculation engine + constants + types.
// Used by both the Express backend (for tests + server-side re-verification)
// and the Next.js frontend (for the live preview during the assessment form).
// No I/O, no React, no Node-only APIs — must run unchanged in both environments.

export * from './types';
export * from './constants';
export * from './engine';
