import { auditLogService, AUDIT_ACTIONS } from '../governance/auditLogService';
import { businessAlignmentService } from './businessAlignmentService';
import { businessContextStoreService } from './businessContextStoreService';
import { businessContextValidationService, type BusinessRegistryInput, type RegistryValidationResult } from './businessContextValidationService';

export const businessContextRegistryService = {
  async registerBusinessRegistry(input: BusinessRegistryInput): Promise<{
    success: boolean;
    validation: RegistryValidationResult;
    snapshotId?: string;
  }> {
    const validation = businessContextValidationService.validateRegistry(input);

    if (validation.status === 'INVALID') {
      await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_STAGE_RECORDED, {
        workOrderId: 'business-registry',
        entity: 'business-context',
        action: 'register-registry-rejected',
        detail: JSON.stringify({
          score: validation.score,
          issueCount: validation.issues.length,
        }),
      });

      return {
        success: false,
        validation,
      };
    }

    const snapshot = await businessContextStoreService.createSnapshot({
      snapshotId: validation.snapshotId!,
      source: 'business-registry',
      payloadJson: JSON.stringify(input),
      score: validation.score,
      status: 'VALID',
    });

    await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_STAGE_RECORDED, {
      workOrderId: 'business-registry',
      entity: 'business-context',
      action: 'register-registry-approved',
      detail: JSON.stringify({
        snapshotId: snapshot.snapshotId,
        score: validation.score,
      }),
    });

    return {
      success: true,
      validation,
      snapshotId: snapshot.snapshotId,
    };
  },

  async upsertCompanyContext(payload: Record<string, unknown>) {
    const validation = businessContextValidationService.validateCompanyContext(payload);
    if (!validation.valid) {
      return {
        success: false,
        validation,
      };
    }

    const record = await businessContextStoreService.upsertContext({
      contextId: 'company-core',
      contextType: 'company',
      payload,
      status: 'APPROVED',
    });

    await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_STAGE_RECORDED, {
      workOrderId: 'company-core',
      entity: 'business-context',
      action: 'upsert-company-context',
    });

    return {
      success: true,
      validation,
      record,
    };
  },

  async upsertProductContext(payload: Record<string, unknown>) {
    const validation = businessContextValidationService.validateProductContext(payload);
    if (!validation.valid) {
      return {
        success: false,
        validation,
      };
    }

    const record = await businessContextStoreService.upsertContext({
      contextId: 'product-context',
      contextType: 'product',
      payload,
      status: 'APPROVED',
    });

    await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_STAGE_RECORDED, {
      workOrderId: 'product-context',
      entity: 'business-context',
      action: 'upsert-product-context',
    });

    return {
      success: true,
      validation,
      record,
    };
  },

  async evaluateCrossReference(input: {
    agentMappings: Record<string, {
      skills: string[];
      protocols: string[];
      kpis: string[];
      workflows: string[];
    }>;
  }) {
    return businessAlignmentService.evaluateAlignment(input);
  },
};
