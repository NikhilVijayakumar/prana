import { listModuleManifests } from '@prana/ui/constants/manifestBridge';

type NavLabelKey =
  | 'nav.triage'
  | 'nav.vault'
  | 'nav.suites'
  | 'nav.governance'
  | 'nav.compliance'
  | 'nav.dailyBrief'
  | 'nav.designAudit'
  | 'nav.fundingDigest'
  | 'nav.hiringSim'
  | 'nav.infrastructure'
  | 'nav.notifications'
  | 'nav.queueMonitor'
  | 'nav.vaultKnowledge'
  | 'nav.weeklyReview'
  | 'nav.settings';

export interface PrimaryNavItem {
  id: string;
  path: string;
  labelKey: NavLabelKey;
}

interface PrimaryNavDefinition {
  id: string;
  fallbackPath: string;
  labelKey: NavLabelKey;
}

const PRIMARY_NAV_DEFINITIONS: PrimaryNavDefinition[] = [
  { id: 'triage', fallbackPath: '/triage', labelKey: 'nav.triage' },
  { id: 'vault', fallbackPath: '/vault', labelKey: 'nav.vault' },
  { id: 'suites', fallbackPath: '/suites', labelKey: 'nav.suites' },
  { id: 'governance', fallbackPath: '/governance', labelKey: 'nav.governance' },
  { id: 'compliance', fallbackPath: '/compliance', labelKey: 'nav.compliance' },
  { id: 'daily-brief', fallbackPath: '/daily-brief', labelKey: 'nav.dailyBrief' },
  { id: 'design-audit', fallbackPath: '/design-audit', labelKey: 'nav.designAudit' },
  { id: 'funding-digest', fallbackPath: '/funding-digest', labelKey: 'nav.fundingDigest' },
  { id: 'hiring-sim', fallbackPath: '/hiring-sim', labelKey: 'nav.hiringSim' },
  { id: 'infrastructure', fallbackPath: '/infrastructure', labelKey: 'nav.infrastructure' },
  { id: 'notification-centre', fallbackPath: '/notifications', labelKey: 'nav.notifications' },
  { id: 'queue-monitor', fallbackPath: '/queue-monitor', labelKey: 'nav.queueMonitor' },
  { id: 'vault-knowledge', fallbackPath: '/vault-knowledge', labelKey: 'nav.vaultKnowledge' },
  { id: 'weekly-review', fallbackPath: '/weekly-review', labelKey: 'nav.weeklyReview' },
  { id: 'settings', fallbackPath: '/settings', labelKey: 'nav.settings' },
];

const findManifestRoute = (moduleId: string): string | null => {
  const manifest = listModuleManifests().find((entry) => entry.id === moduleId && entry.enabled);
  if (!manifest || !manifest.route || manifest.route.length === 0) {
    return null;
  }

  return manifest.route;
};

const normalizeConcreteRoute = (route: string): string | null => {
  if (!route.startsWith('/')) {
    return null;
  }

  if (route.includes(':')) {
    return null;
  }

  return route;
};

export const getEnabledPrimaryNavItems = (): PrimaryNavItem[] => {
  return PRIMARY_NAV_DEFINITIONS.map((definition) => {
    const manifestRoute = findManifestRoute(definition.id);
    const concreteManifestRoute = manifestRoute ? normalizeConcreteRoute(manifestRoute) : null;
    return {
      id: definition.id,
      path: concreteManifestRoute ?? definition.fallbackPath,
      labelKey: definition.labelKey,
    };
  }).filter((item) => {
    const manifestRoute = findManifestRoute(item.id);
    return manifestRoute !== null;
  });
};

export const getEnabledModuleRouteSet = (): Set<string> => {
  const enabledRoutes = listModuleManifests()
    .filter((manifest) => manifest.enabled && typeof manifest.route === 'string')
    .map((manifest) => manifest.route as string)
    .map((route) => normalizeConcreteRoute(route))
    .filter((route): route is string => route !== null);

  return new Set(enabledRoutes);
};

export const getFirstEnabledMainRoute = (): string => {
  const primary = getEnabledPrimaryNavItems();
  if (primary.length > 0) {
    return primary[0].path;
  }

  return '/triage';
};

export const isRouteEnabledByManifest = (routePath: string): boolean => {
  const enabled = getEnabledModuleRouteSet();
  return enabled.has(routePath);
};
