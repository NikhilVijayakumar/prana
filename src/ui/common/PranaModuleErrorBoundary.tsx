import React, { ErrorInfo, ReactNode } from 'react';
import { PranaModuleErrorView } from './PranaModuleErrorView';
import { PranaUiError } from './errors/pranaErrorTypes';
import { PranaFailFastError } from './errors/pranaFailFast';
import { mapToPranaUiError } from './errors/pranaErrorMapper';

interface PranaModuleErrorBoundaryProps {
  children: ReactNode;
}

interface PranaModuleErrorBoundaryState {
  error: PranaUiError | null;
}

export class PranaModuleErrorBoundary extends React.Component<PranaModuleErrorBoundaryProps, PranaModuleErrorBoundaryState> {
  state: PranaModuleErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): PranaModuleErrorBoundaryState {
    if (error instanceof PranaFailFastError) {
      return { error: error.uiError };
    }

    return {
      error: mapToPranaUiError({
        error,
        category: 'runtime',
        source: 'container',
        title: 'Prana Module Error',
      }),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[PRANA_MODULE_ERROR]', error.message, errorInfo.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <PranaModuleErrorView error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
