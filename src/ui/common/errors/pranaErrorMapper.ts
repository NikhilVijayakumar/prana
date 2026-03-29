import { PranaUiError, PranaErrorCategory, PranaErrorSource } from './pranaErrorTypes';

const nextErrorId = (): string => `prana-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const toSafeMessage = (category: PranaErrorCategory): string => {
  switch (category) {
    case 'configuration':
      return 'Prana configuration is invalid or incomplete.';
    case 'ipc':
      return 'Prana could not communicate with runtime services.';
    case 'network':
      return 'Prana failed to reach a required dependency.';
    case 'data':
      return 'Prana received invalid data and stopped this screen.';
    case 'runtime':
      return 'Prana encountered an unexpected runtime error.';
    default:
      return 'Prana encountered an unexpected error.';
  }
};

const toTechnicalDetails = (error: unknown): string[] => {
  if (error instanceof Error) {
    const details = [error.message];
    if (error.stack) {
      details.push(error.stack);
    }
    return details;
  }

  if (typeof error === 'string') {
    return [error];
  }

  try {
    return [JSON.stringify(error)];
  } catch {
    return ['Unserializable error payload'];
  }
};

export const mapToPranaUiError = (params: {
  error: unknown;
  category?: PranaErrorCategory;
  source: PranaErrorSource;
  title?: string;
  userMessage?: string;
}): PranaUiError => {
  const category = params.category ?? 'unknown';
  return {
    id: nextErrorId(),
    title: params.title ?? 'Prana Error',
    userMessage: params.userMessage ?? toSafeMessage(category),
    technicalDetails: toTechnicalDetails(params.error),
    category,
    source: params.source,
  };
};
