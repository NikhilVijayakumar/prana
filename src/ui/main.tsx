import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IntegrationVerificationPage } from './integration/view/IntegrationVerificationPage';
import { SplashContainer } from './splash/view/SplashContainer';
import type { PranaBrandingConfig } from './constants/pranaConfig';
import { PranaErrorBoundary } from './common/PranaErrorBoundary';

const resolveBrandingConfig = (): Partial<PranaBrandingConfig> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const injectedConfig = (window.__pranaBrandingConfig ?? window.__pranaTestBrandingConfig) as
    | Partial<PranaBrandingConfig>
    | undefined;

  return injectedConfig ?? {};
};

interface RootFlowProps {
  branding: Partial<PranaBrandingConfig>;
}

const RootFlow = ({ branding }: RootFlowProps) => {
  const [passedIntegrationGate, setPassedIntegrationGate] = React.useState(false);

  if (!passedIntegrationGate) {
    return <IntegrationVerificationPage branding={branding} onProceed={() => setPassedIntegrationGate(true)} />;
  }

  return <SplashContainer branding={branding} />;
};

const branding = resolveBrandingConfig();

// Initialize app
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <PranaErrorBoundary>
      <BrowserRouter>
        <RootFlow branding={branding} />
      </BrowserRouter>
    </PranaErrorBoundary>
  </React.StrictMode>
);
