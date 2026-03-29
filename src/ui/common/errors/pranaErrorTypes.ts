export type PranaErrorCategory = 'configuration' | 'ipc' | 'network' | 'data' | 'runtime' | 'unknown';

export type PranaErrorSource = 'repo' | 'viewmodel' | 'view' | 'guard' | 'container';

export interface PranaRetryAction {
  label: string;
  action: () => void;
}

export interface PranaUiError {
  id: string;
  title: string;
  userMessage: string;
  technicalDetails: string[];
  category: PranaErrorCategory;
  source: PranaErrorSource;
  retryAction?: PranaRetryAction;
}
