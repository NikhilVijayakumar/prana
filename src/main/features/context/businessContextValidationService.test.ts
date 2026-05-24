import { describe, expect, it } from 'vitest';
import { businessContextValidationService } from './businessContextValidationService';
import type { BusinessRegistryInput } from './businessContextValidationService';

const validInput: BusinessRegistryInput = {
  organization: { id: 'org-1', name: 'Acme Corp', vision: 'Lead the market', mission: 'Deliver value' },
  products: [{ id: 'prod-1', name: 'Cloud Platform', organizationId: 'org-1', vision: 'Best cloud', kpiIds: ['kpi-1'] }],
  features: [{ id: 'feat-1', name: 'Auto Scaling', productId: 'prod-1', kpiIds: ['kpi-1'] }],
  kpis: [{ id: 'kpi-1', name: 'Uptime', description: 'Service uptime percentage', measurableRef: 'datadog:uptime' }],
  missions: [{ id: 'mis-1', productId: 'prod-1', statement: 'Empower developers' }],
  visions: [{ id: 'vis-1', productId: 'prod-1', statement: 'Global leader in cloud' }],
};

describe('businessContextValidationService', () => {
  describe('validateCompanyContext', () => {
    it('passes with all required fields', () => {
      const result = businessContextValidationService.validateCompanyContext({
        companyVision: 'Be the best',
        companyContext: 'We are a tech company',
        coreValues: ['Innovation'],
        globalNonNegotiables: ['Security'],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('fails when companyVision is missing', () => {
      const result = businessContextValidationService.validateCompanyContext({
        companyContext: 'We are a tech company',
        coreValues: ['Innovation'],
        globalNonNegotiables: ['Security'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required company context field: companyVision');
    });

    it('fails when coreValues is empty', () => {
      const result = businessContextValidationService.validateCompanyContext({
        companyVision: 'Be the best',
        companyContext: 'We are a tech company',
        coreValues: [],
        globalNonNegotiables: ['Security'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required company context field: coreValues');
    });
  });

  describe('validateProductContext', () => {
    it('passes with all required fields', () => {
      const result = businessContextValidationService.validateProductContext({
        productName: 'Cloud Platform',
        productVision: 'Best cloud platform',
        primaryFocus: 'Infrastructure',
      });
      expect(result.valid).toBe(true);
    });

    it('fails when productName is empty', () => {
      const result = businessContextValidationService.validateProductContext({
        productName: '',
        productVision: 'Best cloud platform',
        primaryFocus: 'Infrastructure',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateRegistry — AC1: Structural validation', () => {
    it('passes a valid registry', () => {
      const result = businessContextValidationService.validateRegistry(validInput);
      expect(result.status).toBe('VALID');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('detects orphaned feature (no matching product)', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        features: [{ id: 'feat-orphan', name: 'Orphan Feature', productId: 'prod-nonexistent', kpiIds: [] }],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'STRUCTURAL' && i.entityId === 'feat-orphan')).toBe(true);
    });

    it('detects KPI not linked to any feature or product', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        kpis: [...validInput.kpis, { id: 'kpi-orphan', name: 'Orphan KPI', description: 'No link' }],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'STRUCTURAL' && i.entityId === 'kpi-orphan')).toBe(true);
    });

    it('blocks product with no mission or vision', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        missions: [],
        visions: [],
        products: [{ id: 'prod-nm', name: 'No Mission', organizationId: 'org-1', kpiIds: ['kpi-1'] }],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'STRUCTURAL' && i.entityId === 'prod-nm')).toBe(true);
    });
  });

  describe('validateRegistry — AC2: Semantic validation', () => {
    it('blocks KPI with no measurable or executable reference', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        kpis: [{ id: 'kpi-bad', name: 'Bad KPI', description: 'No ref' }],
        products: [{ id: 'prod-1', name: 'Cloud Platform', organizationId: 'org-1', kpiIds: ['kpi-bad'] }],
        features: [],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'KPI' && i.entityId === 'kpi-bad')).toBe(true);
    });

    it('warns on KPI with missing description', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        kpis: [{ id: 'kpi-nod', name: 'No Desc', measurableRef: 'some:ref' }],
        products: [{ id: 'prod-1', name: 'Cloud Platform', organizationId: 'org-1', kpiIds: ['kpi-nod'] }],
        features: [],
        missions: [{ id: 'mis-1', productId: 'prod-1', statement: 'test' }],
        visions: [{ id: 'vis-1', productId: 'prod-1', statement: 'test' }],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'KPI' && i.severity === 'WARNING' && i.entityId === 'kpi-nod')).toBe(true);
    });
  });

  describe('validateRegistry — AC2: Consistency checks', () => {
    it('warns on duplicate product names', () => {
      const input: BusinessRegistryInput = {
        ...validInput,
        products: [
          { id: 'prod-a', name: 'Cloud', organizationId: 'org-1', kpiIds: ['kpi-1'] },
          { id: 'prod-b', name: 'Cloud', organizationId: 'org-1', kpiIds: ['kpi-1'] },
        ],
        missions: [
          { id: 'mis-1', productId: 'prod-a', statement: 'test' },
          { id: 'mis-2', productId: 'prod-b', statement: 'test' },
        ],
        visions: [
          { id: 'vis-1', productId: 'prod-a', statement: 'test' },
          { id: 'vis-2', productId: 'prod-b', statement: 'test' },
        ],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.some((i) => i.type === 'CONSISTENCY' && i.entityType === 'product')).toBe(true);
    });
  });

  describe('validateRegistry — AC4: Actionable error reports', () => {
    it('returns structured issues with type, severity, entityId, and message', () => {
      const input: BusinessRegistryInput = {
        organization: { id: 'org-1', name: 'Acme' },
        products: [{ id: 'prod-1', name: 'P1', organizationId: 'org-1', kpiIds: [] }],
        features: [{ id: 'feat-1', name: 'F1', productId: 'prod-nonexistent', kpiIds: [] }],
        kpis: [{ id: 'kpi-1', name: 'K1', description: 'd' }],
        missions: [],
        visions: [],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.issues.length).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(issue).toHaveProperty('type');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('entityId');
        expect(issue).toHaveProperty('message');
      }
    });

    it('produces INVALID status with score when blocking issues exist', () => {
      const input: BusinessRegistryInput = {
        organization: { id: 'org-1', name: 'Acme' },
        products: [{ id: 'prod-1', name: 'P1', organizationId: 'org-1', kpiIds: [] }],
        features: [],
        kpis: [],
        missions: [],
        visions: [],
      };
      const result = businessContextValidationService.validateRegistry(input);
      expect(result.status).toBe('INVALID');
      expect(result.score).toBeLessThan(70);
      expect(result.snapshotId).toBeUndefined();
    });
  });

  describe('validateRegistry — Scoring', () => {
    it('scores 100 for a perfect registry', () => {
      const perfect: BusinessRegistryInput = {
        organization: { id: 'org-1', name: 'P', vision: 'v', mission: 'm' },
        products: [{ id: 'p-1', name: 'P1', organizationId: 'org-1', vision: 'v', mission: 'm', kpiIds: ['k-1'] }],
        features: [{ id: 'f-1', name: 'F1', productId: 'p-1', kpiIds: ['k-1'] }],
        kpis: [{ id: 'k-1', name: 'K1', description: 'd', measurableRef: 'ref' }],
        missions: [{ id: 'm-1', productId: 'p-1', statement: 's' }],
        visions: [{ id: 'v-1', productId: 'p-1', statement: 's' }],
      };
      const result = businessContextValidationService.validateRegistry(perfect);
      expect(result.score).toBe(100);
      expect(result.status).toBe('VALID');
    });

    it('deducts score for each issue', () => {
      const result = businessContextValidationService.validateRegistry({
        organization: { id: 'org-1', name: 'Acme' },
        products: [{ id: 'prod-1', name: 'P1', organizationId: 'org-1', kpiIds: [] }],
        features: [],
        kpis: [],
        missions: [],
        visions: [],
      });
      expect(result.score).toBeLessThan(70);
    });
  });
});
