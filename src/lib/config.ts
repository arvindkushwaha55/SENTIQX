/**
 * Flips to true only when the Claude Code connector exists and has been verified
 * against a real session. Until then the Start button stays disabled (except in
 * the dev-only demo mode, which is always labelled as demo data).
 */
export const CONNECTOR_READY = false;
