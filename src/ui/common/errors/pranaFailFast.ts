import { mapToPranaUiError } from './pranaErrorMapper';
import { PranaErrorCategory, PranaErrorSource, PranaUiError } from './pranaErrorTypes';

export class PranaFailFastError extends Error {
  readonly uiError: PranaUiError;

  constructor(uiError: PranaUiError) {
    super(uiError.userMessage);
    this.uiError = uiError;
    this.name = 'PranaFailFastError';
  }
}

export const throwPranaUiError = (uiError: PranaUiError): never => {
  throw new PranaFailFastError(uiError);
};

export const throwMappedPranaError = (params: {
  error: unknown;
  source: PranaErrorSource;
  category?: PranaErrorCategory;
  title?: string;
  userMessage?: string;
}): never => {
  return throwPranaUiError(
    mapToPranaUiError({
      error: params.error,
      source: params.source,
      category: params.category,
      title: params.title,
      userMessage: params.userMessage,
    }),
  );
};
