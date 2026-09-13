/**
 * Central helpers for turning an unknown thrown value (Axios error, Error, or
 * anything) into a user-facing message, so call sites can use `catch (error)`
 * (implicitly unknown) instead of `catch (error: any)`.
 */

interface ApiErrorShape {
  response?: { data?: { message?: unknown; error?: unknown }; status?: unknown };
  message?: unknown;
}

function asApiError(error: unknown): ApiErrorShape | null {
  return typeof error === 'object' && error !== null ? (error as ApiErrorShape) : null;
}

/** Best-effort human-readable message from an unknown error, with a fallback. */
export function apiErrorMessage(error: unknown, fallback = 'Terjadi kesalahan'): string {
  const e = asApiError(error);
  if (e) {
    const apiMsg = e.response?.data?.message ?? e.response?.data?.error;
    if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

/** HTTP status code from an Axios-style error, if present. */
export function apiErrorStatus(error: unknown): number | undefined {
  const status = asApiError(error)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}
