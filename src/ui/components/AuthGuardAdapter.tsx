/**
 * AuthGuardAdapter.tsx
 * Prana-specific adapter for neutral route guards.
 *
 * This container connects the neutral RouteGuards components to Prana's
 * volatileSessionStore and manifest system, providing convenient
 * wrapped versions that require no configuration.
 *
 * Lane B (Adopt after refactor): The neutral guard components can be adopted
 * by Astra; this adapter layer stays in Prana and handles app-specific logic.
 */

import { FC, ReactNode } from 'react';
import { useVolatileSessionStore } from 'prana/ui/state/volatileSessionStore';
import {
  SessionTokenGuard,
  OnboardingStateGuard,
  ModuleRouteGuard,
  PublicAccessGuard,
} from 'prana/ui/common/components/RouteGuards';
import {
  SESSION_TOKEN_PREFIX,
  LEGACY_SESSION_TOKEN_PREFIX,
} from 'prana/ui/constants/storageKeys';
import { getFirstEnabledMainRoute, isRouteEnabledByManifest } from '../constants/moduleRegistry';

/**
 * Prana session token validation predicate
 */
const validatePranaSessionToken = (token: string | null): boolean => {
  return Boolean(
    token
      && (token.startsWith(SESSION_TOKEN_PREFIX) || token.startsWith(LEGACY_SESSION_TOKEN_PREFIX)),
  );
};

/**
 * AuthGuard (Prana): Checks session token validity.
 * Redirects to /login if no valid session.
 */
export const AuthGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useVolatileSessionStore();
  return (
    <SessionTokenGuard
      session={session}
      loginPath="/login"
      validateFn={validatePranaSessionToken}
    >
      {children}
    </SessionTokenGuard>
  );
};

/**
 * MainAppGuard (Prana): Alias for AuthGuard.
 * Ensures user is authenticated before accessing main app.
 */
export const MainAppGuard: FC<{ children: ReactNode }> = ({ children }) => {
  return <AuthGuard>{children}</AuthGuard>;
};

/**
 * OnboardingGuard (Prana): Combines session validation + onboarding state check.
 * - Redirects to /login if no valid session
 * - Redirects to main app if onboarding is complete
 */
export const OnboardingGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useVolatileSessionStore();
  return (
    <SessionTokenGuard
      session={session}
      loginPath="/login"
      validateFn={validatePranaSessionToken}
    >
      <OnboardingStateGuard
        session={session}
        condition={(s) => s.onboardingComplete ?? false}
        redirectPath={getFirstEnabledMainRoute()}
      >
        {children}
      </OnboardingStateGuard>
    </SessionTokenGuard>
  );
};

/**
 * PublicOnlyGuard (Prana): Allows unauthenticated access.
 * Redirects authenticated users to main app (used for login/signup pages).
 */
export const PublicOnlyGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useVolatileSessionStore();
  return (
    <PublicAccessGuard
      session={session}
      isAuthenticated={validatePranaSessionToken.bind(null, session.sessionToken as string)}
      redirectPath={getFirstEnabledMainRoute()}
    >
      {children}
    </PublicAccessGuard>
  );
};

/**
 * ModuleRouteGuard (Prana): Checks if a route is enabled by manifest.
 * Redirects to first enabled main route if feature is disabled.
 */
export const PranaModuleRouteGuard: FC<{ routePath: string; children: ReactNode }> = ({
  routePath,
  children,
}) => {
  const isEnabled = isRouteEnabledByManifest(routePath);
  return (
    <ModuleRouteGuard isEnabled={isEnabled} fallbackPath={getFirstEnabledMainRoute()}>
      {children}
    </ModuleRouteGuard>
  );
};
