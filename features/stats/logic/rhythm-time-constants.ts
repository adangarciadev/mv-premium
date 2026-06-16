/**
 * Shared bounds for rhythm time chunks.
 *
 * Lives in a neutral module so both the content tracker
 * (`features/stats/logic/time-tracker.ts`) and the background handler
 * (`entrypoints/background/stats-handlers.ts`) agree on the same maximum
 * without the content side importing background code.
 */

/**
 * Largest single rhythm chunk the background will accept. The content tracker
 * syncs every 30s, so 10 minutes is generous for delayed retries while still
 * rejecting obviously corrupt single messages.
 */
export const MAX_RHYTHM_CHUNK_MS = 10 * 60_000
