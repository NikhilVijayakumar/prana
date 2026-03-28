/**
 * AuthGuard.tsx
 * Prana route protection components.
 * 
 * Re-exports from AuthGuardAdapter which connects neutral RouteGuards (in common package)
 * to Prana's session store and manifest system.
 * 
 * Lane B (Decomposed for Astra adoption): Neutral guard logic is in
 * prana/ui/common/components/RouteGuards.tsx for reuse. App-specific
 * configuration is in AuthGuardAdapter.tsx.
 */

export {
  AuthGuard,
  MainAppGuard,
  OnboardingGuard,
  PublicOnlyGuard,
  PranaModuleRouteGuard as ModuleRouteGuard,
} from './AuthGuardAdapter';
