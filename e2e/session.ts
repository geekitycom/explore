/**
 * The e2e server's session timeout, the same as production's. Tests move the server clock past it
 * with the clock hook rather than wait it out.
 */
export const SESSION_TIMEOUT_MS = 10 * 60_000;
