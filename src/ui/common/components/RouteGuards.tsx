/**
 * RouteGuards.tsx
 * Neutral route protection components for session validation and navigation.
 *
 * Lane B (Promote with refactor): These guards provide generic routing logic
 * that can be adopted by Astra with custom session stores and navigation handlers.
 * Prana-specific branding/routes are delegated to adapter containers.
 */

import { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Generic session token validation utility
 * @param token - The session token to validate
 * @param validateFn - Custom validation predicate (e.g., token prefix checks)
 * @returns true if token is valid
 */
export const validateSessionToken = (
  token: string | null,
  validateFn: (token: string | null) => boolean,
): boolean => validateFn(token);

/**
 * SessionTokenGuard: Generic session authentication guard.
 * Redirects to loginPath if validation fails.
 *
 * Usage:
 * <SessionTokenGuard session={session} loginPath="/auth/login">
 *   <ProtectedContent />
 * </SessionTokenGuard>
 */
export interface SessionTokenGuardProps {
  children: ReactNode;
  session: { sessionToken: string | null };
  loginPath: string;
  validateFn: (token: string | null) => boolean;
}

export const SessionTokenGuard: FC<SessionTokenGuardProps> = ({
  children,
  session,
  loginPath,
  validateFn,
}) => {
  const isValid = validateSessionToken(session.sessionToken, validateFn);
  if (!isValid) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
};

/**
 * OnboardingStateGuard: Protects routes that should only be accessible
 * if onboarding is/is not complete.
 *
 * Usage for onboarding-only route:
 * <OnboardingStateGuard
 *   session={session}
 *   condition={(session) => !session.onboardingComplete}
 *   redirectPath="/main"
 * >
 *   <OnboardingFlow />
 * </OnboardingStateGuard>
 */
export interface OnboardingStateGuardProps {
  children: ReactNode;
  session: { onboardingComplete?: boolean };
  condition: (session: any) => boolean;
  redirectPath: string;
}

export const OnboardingStateGuard: FC<OnboardingStateGuardProps> = ({
  children,
  session,
  condition,
  redirectPath,
}) => {
  if (condition(session)) {
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
};

/**
 * ModuleRouteGuard: Protects feature-gated routes.
 * Redirects if feature is not enabled.
 *
 * Usage:
 * <ModuleRouteGuard isEnabled={manifest.isFeatureEnabled('vault')} fallbackPath="/main">
 *   <VaultModule />
 * </ModuleRouteGuard>
 */
export interface ModuleRouteGuardProps {
  children: ReactNode;
  isEnabled: boolean;
  fallbackPath: string;
}

export const ModuleRouteGuard: FC<ModuleRouteGuardProps> = ({
  children,
  isEnabled,
  fallbackPath,
}) => {
  if (!isEnabled) {
    return <Navigate to={fallbackPath} replace />;
  }
  return <>{children}</>;
};

/**
 * PublicAccessGuard: Allows unauthenticated access but redirects
 * authenticated users to a default route.
 *
 * Usage for login/signup pages:
 * <PublicAccessGuard
 *   session={session}
 *   isAuthenticated={(session) => hasValidToken(session.sessionToken)}
 *   redirectPath="/main"
 * >
 *   <LoginPage />
 * </PublicAccessGuard>
 */
export interface PublicAccessGuardProps {
  children: ReactNode;
  session: any;
  isAuthenticated: (session: any) => boolean;
  redirectPath: string;
}

export const PublicAccessGuard: FC<PublicAccessGuardProps> = ({
  children,
  session,
  isAuthenticated,
  redirectPath,
}) => {
  if (isAuthenticated(session)) {
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
};
