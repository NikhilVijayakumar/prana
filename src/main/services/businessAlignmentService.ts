import { businessContextStoreService } from './businessContextStoreService';

export interface BusinessAlignmentReport {
  valid: boolean;
  missingDependencies: string[];
  unresolvedAgentMappings: string[];
}

export const businessAlignmentService = {
  async evaluateAlignment(input: {
    agentMappings: Record<string, {
      skills: string[];
      protocols: string[];
      kpis: string[];
      workflows: string[];
    }>;
  }): Promise<BusinessAlignmentReport> {
    const company = await businessContextStoreService.getContext('company-core');
    const product = await businessContextStoreService.getContext('product-context');

    const missingDependencies: string[] = [];
    if (!company || company.status !== 'APPROVED') {
      missingDependencies.push('company-core');
    }
    if (!product || product.status !== 'APPROVED') {
      missingDependencies.push('product-context');
    }

    const unresolvedAgentMappings = Object.entries(input.agentMappings)
      .filter(([, mapping]) =>
        mapping.skills.length === 0
        || mapping.protocols.length === 0
        || mapping.kpis.length === 0
        || mapping.workflows.length === 0)
      .map(([agentId]) => agentId);

    return {
      valid: missingDependencies.length === 0 && unresolvedAgentMappings.length === 0,
      missingDependencies,
      unresolvedAgentMappings,
    };
  },
};
