export class ABORT_TIMEOUT_EXCEEDED extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ABORT_TIMEOUT_EXCEEDED';
  }
}

export class HTTP_SERVER_ERROR extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HTTP_SERVER_ERROR';
  }
}

export const wrappedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 5000
): Promise<Response> => {
  const signal = AbortSignal.timeout(timeoutMs);
  
  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
    });

    if (response.status >= 500) {
      throw new HTTP_SERVER_ERROR(`Upstream server returned HTTP ${response.status}`);
    }

    return response;
  } catch (error: any) {
    // AbortSignal.timeout throws a TimeoutError in modern node, but could look like AbortError
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ABORT_TIMEOUT_EXCEEDED(`Network request exceeded ${timeoutMs}ms limit.`);
    }
    throw error;
  }
};
