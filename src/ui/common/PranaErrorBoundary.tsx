import React, { ErrorInfo, ReactNode } from 'react';
import { getPranaErrorRenderer } from './pranaErrorRenderer';

interface PranaErrorBoundaryProps {
  children: ReactNode;
}

interface PranaErrorBoundaryState {
  error: Error | null;
}

export class PranaErrorBoundary extends React.Component<PranaErrorBoundaryProps, PranaErrorBoundaryState> {
  state: PranaErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): PranaErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[PRANA_UI_ERROR]', error.message, errorInfo.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const ErrorRenderer = getPranaErrorRenderer();
      return (
        <ErrorRenderer
          title="Prana Runtime Error"
          errors={[this.state.error.message || 'Unknown UI error.']}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
