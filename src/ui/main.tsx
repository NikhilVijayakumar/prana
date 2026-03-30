import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IntegrationVerificationPage } from './integration/view/IntegrationVerificationPage';
import { SplashContainer } from './splash/view/SplashContainer';
import { PranaErrorBoundary } from './common/PranaErrorBoundary';
import { BrandingProvider } from './constants/pranaConfig';

const RootFlow = () => {
  const [passedIntegrationGate, setPassedIntegrationGate] = React.useState(false);

  if (!passedIntegrationGate) {
    return <IntegrationVerificationPage onProceed={() => setPassedIntegrationGate(true)} />;
  }

  return <SplashContainer />;
};

// Initialize app
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <PranaErrorBoundary>
      <BrandingProvider>
        <BrowserRouter>
          <RootFlow />
        </BrowserRouter>
      </BrandingProvider>
    </PranaErrorBoundary>
  </React.StrictMode>
);
