import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IntegrationVerificationPage } from './integration/view/IntegrationVerificationPage';
import { SplashContainer } from './splash/view/SplashContainer';
import { validatePranaBranding } from './constants/pranaConfig';
import { getPranaErrorRenderer } from './common/pranaErrorRenderer';
import { PranaErrorBoundary } from './common/PranaErrorBoundary';

const RootFlow = () => {
  const brandingValidation = validatePranaBranding();
  const [passedIntegrationGate, setPassedIntegrationGate] = React.useState(false);

  if (!brandingValidation.valid) {
    const ErrorRenderer = getPranaErrorRenderer();
    return <ErrorRenderer title="Prana Configuration Error" errors={brandingValidation.errors} />;
  }

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
      <BrowserRouter>
        <RootFlow />
      </BrowserRouter>
    </PranaErrorBoundary>
  </React.StrictMode>
);
