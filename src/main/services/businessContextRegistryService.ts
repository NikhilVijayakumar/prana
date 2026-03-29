import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { businessAlignmentService } from './businessAlignmentService';
import { businessContextStoreService } from './businessContextStoreService';
import { businessContextValidationService } from './businessContextValidationService';

export const businessContextRegistryService = {
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
