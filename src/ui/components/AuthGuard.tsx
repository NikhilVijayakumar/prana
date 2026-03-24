import { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useVolatileSessionStore } from '@prana/ui/state/volatileSessionStore';
import { getFirstEnabledMainRoute, isRouteEnabledByManifest } from '../constants/moduleRegistry';

interface AuthGuardProps {
  children: ReactNode;
}

const hasValidSessionToken = (sessionToken: string | null): boolean => {
  return Boolean(sessionToken && sessionToken.startsWith('dhi_session_'));
};

export const AuthGuard: FC<AuthGuardProps> = ({ children }) => {
  const session = useVolatileSessionStore();
  const hasSession = hasValidSessionToken(session.sessionToken);
  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

interface MainAppGuardProps {
  children: ReactNode;
}

export const MainAppGuard: FC<MainAppGuardProps> = ({ children }) => {
  const session = useVolatileSessionStore();
  const hasSession = hasValidSessionToken(session.sessionToken);
  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard: FC<OnboardingGuardProps> = ({ children }) => {
  const session = useVolatileSessionStore();
  const hasSession = hasValidSessionToken(session.sessionToken);
  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  const onboardingComplete = session.onboardingComplete;
  if (onboardingComplete) {
    return <Navigate to={getFirstEnabledMainRoute()} replace />;
  }

  return <>{children}</>;
};

interface PublicOnlyGuardProps {
  children: ReactNode;
}

export const PublicOnlyGuard: FC<PublicOnlyGuardProps> = ({ children }) => {
  const session = useVolatileSessionStore();
  const hasSession = hasValidSessionToken(session.sessionToken);

  if (!hasSession) {
    return <>{children}</>;
  }

  return <Navigate to={getFirstEnabledMainRoute()} replace />;
};

interface ModuleRouteGuardProps {
  routePath: string;
  children: ReactNode;
}

export const ModuleRouteGuard: FC<ModuleRouteGuardProps> = ({ routePath, children }) => {
  const isEnabled = isRouteEnabledByManifest(routePath);
  if (!isEnabled) {
    return <Navigate to={getFirstEnabledMainRoute()} replace />;
  }

  return <>{children}</>;
};
