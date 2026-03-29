export interface EmployeeDirectoryEntry {
  id: string;
  name: string;
  role: string;
  triggerName: string;
  triggerDesignation: string;
  avatarFileName: string;
}

export const EMPLOYEE_DIRECTORY: Record<string, EmployeeDirectoryEntry> = {
  mira: {
    id: 'mira',
    name: 'Mira',
    role: 'Secretary & Command Router',
    triggerName: '@mira',
    triggerDesignation: '@secretary',
    avatarFileName: 'mira-secretary.png',
  },
  arya: {
    id: 'arya',
    name: 'Arya',
    role: 'Chief Executive Officer',
    triggerName: '@arya',
    triggerDesignation: '@ceo',
    avatarFileName: 'arya-ceo.png',
  },
  nora: {
    id: 'nora',
    name: 'Nora',
    role: 'Chief Financial Officer',
    triggerName: '@nora',
    triggerDesignation: '@cfo',
    avatarFileName: 'nora-cfo.png',
  },
  julia: {
    id: 'julia',
    name: 'Julia',
    role: 'Chief Technology Officer',
    triggerName: '@julia',
    triggerDesignation: '@cto',
    avatarFileName: 'julia-cto.png',
  },
  elina: {
    id: 'elina',
    name: 'Elina',
    role: 'Chief Operating Officer',
    triggerName: '@elina',
    triggerDesignation: '@coo',
    avatarFileName: 'elina-coo.png',
  },
  eva: {
    id: 'eva',
    name: 'Eva',
    role: 'Compliance Officer',
    triggerName: '@eva',
    triggerDesignation: '@compliance',
    avatarFileName: 'eva-compliance.png',
  },
  dani: {
    id: 'dani',
    name: 'Dani',
    role: 'Chief Marketing Officer',
    triggerName: '@dani',
    triggerDesignation: '@cmo',
    avatarFileName: 'dani-cmo.png',
  },
  sofia: {
    id: 'sofia',
    name: 'Sofia',
    role: 'Head of Design',
    triggerName: '@sofia',
    triggerDesignation: '@designer',
    avatarFileName: 'sofia-design.png',
  },
  lina: {
    id: 'lina',
    name: 'Lina',
    role: 'Head of Human Resources',
    triggerName: '@lina',
    triggerDesignation: '@hr',
    avatarFileName: 'lina-hr.png',
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    role: 'Funding & Resource Procurement',
    triggerName: '@maya',
    triggerDesignation: '@funding',
    avatarFileName: 'maya-funding.png',
  },
};

export const EMPLOYEE_LIST = Object.values(EMPLOYEE_DIRECTORY);

const ensureTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

export const getEmployeeAvatarPath = (employeeId: string, avatarBaseUrl?: string): string => {
  const employee = EMPLOYEE_DIRECTORY[employeeId];
  if (!employee) return '';
  const resolvedAvatarBaseUrl = avatarBaseUrl ?? '/resources/';
  return `${ensureTrailingSlash(resolvedAvatarBaseUrl)}${employee.avatarFileName}`;
};

interface ModuleOwnership {
  routePrefix: string;
  moduleNameKey: string;
  ownerId: string;
}

const MODULE_OWNERSHIP: ModuleOwnership[] = [
  { routePrefix: '/triage', moduleNameKey: 'interaction.module.triage', ownerId: 'mira' },
  { routePrefix: '/vault', moduleNameKey: 'interaction.module.vault', ownerId: 'nora' },
  { routePrefix: '/suites', moduleNameKey: 'interaction.module.suites', ownerId: 'arya' },
  { routePrefix: '/governance', moduleNameKey: 'interaction.module.governance', ownerId: 'eva' },
  { routePrefix: '/compliance', moduleNameKey: 'interaction.module.compliance', ownerId: 'eva' },
  { routePrefix: '/daily-brief', moduleNameKey: 'interaction.module.dailyBrief', ownerId: 'mira' },
  { routePrefix: '/design-audit', moduleNameKey: 'interaction.module.designAudit', ownerId: 'sofia' },
  { routePrefix: '/funding-digest', moduleNameKey: 'interaction.module.fundingDigest', ownerId: 'maya' },
  { routePrefix: '/hiring-sim', moduleNameKey: 'interaction.module.hiringSim', ownerId: 'lina' },
  { routePrefix: '/infrastructure', moduleNameKey: 'interaction.module.infrastructure', ownerId: 'julia' },
  { routePrefix: '/notifications', moduleNameKey: 'interaction.module.notifications', ownerId: 'mira' },
  { routePrefix: '/queue-monitor', moduleNameKey: 'interaction.module.queueMonitor', ownerId: 'elina' },
  { routePrefix: '/vault-knowledge', moduleNameKey: 'interaction.module.vaultKnowledge', ownerId: 'nora' },
  { routePrefix: '/weekly-review', moduleNameKey: 'interaction.module.weeklyReview', ownerId: 'mira' },
  { routePrefix: '/settings', moduleNameKey: 'interaction.module.settings', ownerId: 'mira' },
  { routePrefix: '/onboarding', moduleNameKey: 'interaction.module.onboarding', ownerId: 'mira' },
  { routePrefix: '/profile', moduleNameKey: 'interaction.module.profile', ownerId: 'mira' },
];

export interface InteractionContext {
  moduleNameKey: string;
  ownerId: string;
  secretaryId: 'mira';
}

export const getInteractionContextForPath = (pathName: string): InteractionContext => {
  const matched = MODULE_OWNERSHIP.find((item) => pathName.startsWith(item.routePrefix));
  if (matched) {
    return {
      moduleNameKey: matched.moduleNameKey,
      ownerId: matched.ownerId,
      secretaryId: 'mira',
    };
  }

  return {
    moduleNameKey: 'interaction.module.workspace',
    ownerId: 'mira',
    secretaryId: 'mira',
  };
};
