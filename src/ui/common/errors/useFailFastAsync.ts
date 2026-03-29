import { useState } from 'react';
import { mapToPranaUiError } from './pranaErrorMapper';
import { PranaUiError, PranaErrorCategory, PranaErrorSource } from './pranaErrorTypes';
import { PranaFailFastError } from './pranaFailFast';

export const useFailFastAsync = (source: PranaErrorSource) => {
  const [fatalError, setFatalError] = useState<PranaUiError | null>(null);

  const clearFatalError = (): void => {
    setFatalError(null);
  };

  const runSafely = async <T>(
    operation: () => Promise<T>,
    options?: {
      category?: PranaErrorCategory;
      title?: string;
      userMessage?: string;
      swallow?: boolean;
    },
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const mapped =
        error instanceof PranaFailFastError
          ? error.uiError
          : mapToPranaUiError({
              error,
              source,
              category: options?.category,
              title: options?.title,
              userMessage: options?.userMessage,
            });

      setFatalError(mapped);
      if (options?.swallow) {
        return null;
      }

      throw new PranaFailFastError(mapped);
    }
  };

  return {
    fatalError,
    clearFatalError,
    runSafely,
  };
};
