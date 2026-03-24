/**
 * IPC Response Factory
 *
 * Eliminates repeated ServerResponse construction boilerplate across all
 * repository classes. Every repo in Dhi and Vidhan wraps window.api.* calls
 * with identical success/failure response shapes — this factory centralizes that.
 */
import { HttpStatusCode, ServerResponse } from 'astra';

/**
 * Wrap a successful IPC result in a ServerResponse envelope.
 */
export const successResponse = <T>(data: T, message = 'Loaded'): ServerResponse<T> => ({
  isSuccess: true,
  isError: false,
  status: HttpStatusCode.SUCCESS,
  statusMessage: message,
  data,
});

/**
 * Wrap a conditional result — delegates to success or failure based on a boolean.
 */
export const conditionalResponse = <T>(
  ok: boolean,
  data: T,
  successMessage = 'Success',
  failureMessage = 'Failed',
): ServerResponse<T> => ({
  isSuccess: ok,
  isError: !ok,
  status: ok ? HttpStatusCode.SUCCESS : HttpStatusCode.INTERNAL_SERVER_ERROR,
  statusMessage: ok ? successMessage : failureMessage,
  data,
});
