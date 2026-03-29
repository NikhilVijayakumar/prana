import { mapToPranaUiError } from './pranaErrorMapper';
import { PranaFailFastError } from './pranaFailFast';

export const safeIpcCall = async <T>(
  label: string,
  call: () => Promise<T>,
  validate?: (value: T) => boolean,
): Promise<T> => {
  try {
    const result = await call();

    if (result === null || result === undefined) {
      throw new PranaFailFastError(
        mapToPranaUiError({
          error: `${label} returned empty response`,
          category: 'ipc',
          source: 'repo',
          title: 'Prana Service Response Error',
        }),
      );
    }

    if (validate && !validate(result)) {
      throw new PranaFailFastError(
        mapToPranaUiError({
          error: `${label} returned invalid payload shape`,
          category: 'data',
          source: 'repo',
          title: 'Prana Data Validation Error',
        }),
      );
    }

    return result;
  } catch (error) {
    if (error instanceof PranaFailFastError) {
      throw error;
    }

    throw new PranaFailFastError(
      mapToPranaUiError({
        error,
        category: 'ipc',
        source: 'repo',
        title: 'Prana Service Communication Error',
      }),
    );
  }
};
