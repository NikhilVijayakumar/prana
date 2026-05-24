import { randomUUID } from 'node:crypto';

// ── Core Entity Types ────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  vision?: string;
  mission?: string;
}

export interface Product {
  id: string;
  name: string;
  organizationId: string;
  vision?: string;
  mission?: string;
  kpiIds: string[];
}

export interface Feature {
  id: string;
  name: string;
  productId: string;
  kpiIds: string[];
}

export interface KpiDefinition {
  id: string;
  name: string;
  description: string;
  unit?: string;
  target?: string;
  measurableRef?: string;
  executableRef?: string;
}

export interface Mission {
  id: string;
  productId: string;
  statement: string;
}

export interface Vision {
  id: string;
  productId: string;
  statement: string;
}

// ── Registry Input ───────────────────────────────────────────────────────────

export interface BusinessRegistryInput {
  organization: Organization;
  products: Product[];
  features: Feature[];
  kpis: KpiDefinition[];
  missions: Mission[];
  visions: Vision[];
}

// ── Validation Types ─────────────────────────────────────────────────────────

export type ValidationIssueType = 'STRUCTURAL' | 'KPI' | 'CONSISTENCY' | 'FIELD';
export type ValidationSeverity = 'BLOCKING' | 'WARNING';

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: ValidationSeverity;
  entityId: string;
  entityType?: string;
  message: string;
}

export interface BusinessContextValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RegistryValidationResult {
  status: 'VALID' | 'INVALID';
  score: number;
  issues: ValidationIssue[];
  snapshotId?: string;
}

// ── Pipeline Stage Result ────────────────────────────────────────────────────

interface StageResult {
  issues: ValidationIssue[];
}

// ── Scoring Config ───────────────────────────────────────────────────────────

const SCORE_INITIAL = 100;
const SCORE_DEDUCTIONS: Record<ValidationIssueType, number> = {
  FIELD: 20,
  KPI: 25,
  STRUCTURAL: 30,
  CONSISTENCY: 10,
};
const SCORE_STRONG = 90;
const SCORE_ACCEPTABLE = 70;

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

// ── Stage Validators ─────────────────────────────────────────────────────────

const validateStructuralStage = (input: BusinessRegistryInput): StageResult => {
  const issues: ValidationIssue[] = [];
  const productIds = new Set(input.products.map((p) => p.id));
  const featureIds = new Set(input.features.map((f) => f.id));
  const kpiIds = new Set(input.kpis.map((k) => k.id));
  const allProductIds = new Set(input.products.map((p) => p.id));

  for (const feature of input.features) {
    if (!allProductIds.has(feature.productId)) {
      issues.push({
        type: 'STRUCTURAL',
        severity: 'BLOCKING',
        entityId: feature.id,
        entityType: 'feature',
        message: `Feature "${feature.name}" references non-existent product "${feature.productId}"`,
      });
    }
  }

  for (const kpi of input.kpis) {
    const linkedToFeature = input.features.some((f) => f.kpiIds.includes(kpi.id));
    const linkedToProduct = input.products.some((p) => p.kpiIds.includes(kpi.id));
    if (!linkedToFeature && !linkedToProduct) {
      issues.push({
        type: 'STRUCTURAL',
        severity: 'BLOCKING',
        entityId: kpi.id,
        entityType: 'kpi',
        message: `KPI "${kpi.name}" is not linked to any feature or product`,
      });
    }
  }

  for (const product of input.products) {
    const hasKpi = product.kpiIds.length > 0 || input.features.some((f) => f.productId === product.id && f.kpiIds.length > 0);
    if (!hasKpi) {
      issues.push({
        type: 'STRUCTURAL',
        severity: 'WARNING',
        entityId: product.id,
        entityType: 'product',
        message: `Product "${product.name}" has no KPIs`,
      });
    }
    const hasMission = input.missions.some((m) => m.productId === product.id);
    const hasVision = input.visions.some((v) => v.productId === product.id);
    if (!hasMission && !hasVision) {
      issues.push({
        type: 'STRUCTURAL',
        severity: 'BLOCKING',
        entityId: product.id,
        entityType: 'product',
        message: `Product "${product.name}" must have at least one mission or vision`,
      });
    }
  }

  return { issues };
};

const validateKpiStage = (input: BusinessRegistryInput): StageResult => {
  const issues: ValidationIssue[] = [];

  for (const kpi of input.kpis) {
    if (!hasText(kpi.measurableRef) && !hasText(kpi.executableRef)) {
      issues.push({
        type: 'KPI',
        severity: 'BLOCKING',
        entityId: kpi.id,
        entityType: 'kpi',
        message: `KPI "${kpi.name}" must map to at least one measurable reference or executable workflow`,
      });
    }
    if (!hasText(kpi.description)) {
      issues.push({
        type: 'KPI',
        severity: 'WARNING',
        entityId: kpi.id,
        entityType: 'kpi',
        message: `KPI "${kpi.name}" is missing a description`,
      });
    }
  }

  return { issues };
};

const validateConsistencyStage = (input: BusinessRegistryInput): StageResult => {
  const issues: ValidationIssue[] = [];

  const productNames = new Map<string, string[]>();
  for (const product of input.products) {
    const existing = productNames.get(product.name.toLowerCase()) ?? [];
    existing.push(product.id);
    productNames.set(product.name.toLowerCase(), existing);
  }
  for (const [nameLower, ids] of productNames) {
    if (ids.length > 1) {
      for (const id of ids) {
        issues.push({
          type: 'CONSISTENCY',
          severity: 'WARNING',
          entityId: id,
          entityType: 'product',
          message: `Duplicate product name "${nameLower}" conflicts with product(s): ${ids.filter((other) => other !== id).join(', ')}`,
        });
      }
    }
  }

  const missionMap = new Map<string, string[]>();
  for (const mission of input.missions) {
    const key = `${mission.productId}:${mission.statement.toLowerCase().trim()}`;
    const existing = missionMap.get(key) ?? [];
    existing.push(mission.id);
    missionMap.set(key, existing);
  }
  for (const [key, ids] of missionMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        issues.push({
          type: 'CONSISTENCY',
          severity: 'WARNING',
          entityId: id,
          entityType: 'mission',
          message: `Duplicate mission statement detected across product missions`,
        });
      }
    }
  }

  const featureNames = new Map<string, string[]>();
  for (const feature of input.features) {
    const existing = featureNames.get(feature.name.toLowerCase()) ?? [];
    existing.push(feature.id);
    featureNames.set(feature.name.toLowerCase(), existing);
  }
  for (const [nameLower, ids] of featureNames) {
    if (ids.length > 1) {
      for (const id of ids) {
        issues.push({
          type: 'CONSISTENCY',
          severity: 'WARNING',
          entityId: id,
          entityType: 'feature',
          message: `Ambiguous feature name "${nameLower}" — collision between features: ${ids.join(', ')}`,
        });
      }
    }
  }

  return { issues };
};

const calculateScore = (issues: ValidationIssue[]): number => {
  let score = SCORE_INITIAL;
  for (const issue of issues) {
    const deduction = SCORE_DEDUCTIONS[issue.type] ?? 10;
    score -= deduction;
  }
  return Math.max(0, score);
};

// ── Exported Service ─────────────────────────────────────────────────────────

export const businessContextValidationService = {
  validateCompanyContext(payload: Record<string, unknown>): BusinessContextValidationResult {
    const errors: string[] = [];
    if (!hasText(payload.companyVision)) {
      errors.push('Missing required company context field: companyVision');
    }
    if (!hasText(payload.companyContext)) {
      errors.push('Missing required company context field: companyContext');
    }
    if (!Array.isArray(payload.coreValues) || payload.coreValues.length === 0) {
      errors.push('Missing required company context field: coreValues');
    }
    if (!Array.isArray(payload.globalNonNegotiables) || payload.globalNonNegotiables.length === 0) {
      errors.push('Missing required company context field: globalNonNegotiables');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  validateProductContext(payload: Record<string, unknown>): BusinessContextValidationResult {
    const errors: string[] = [];
    if (!hasText(payload.productName)) {
      errors.push('Missing required product context field: productName');
    }
    if (!hasText(payload.productVision)) {
      errors.push('Missing required product context field: productVision');
    }
    if (!hasText(payload.primaryFocus)) {
      errors.push('Missing required product context field: primaryFocus');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  validateRegistry(input: BusinessRegistryInput): RegistryValidationResult {
    const structural = validateStructuralStage(input);
    const kpi = validateKpiStage(input);
    const consistency = validateConsistencyStage(input);

    const allIssues = [...structural.issues, ...kpi.issues, ...consistency.issues];
    const score = calculateScore(allIssues);
    const hasBlocking = allIssues.some((issue) => issue.severity === 'BLOCKING');
    const status = hasBlocking || score < SCORE_ACCEPTABLE ? 'INVALID' : 'VALID';

    return {
      status,
      score,
      issues: allIssues,
      snapshotId: status === 'VALID' ? `snap_${randomUUID()}` : undefined,
    };
  },
};
