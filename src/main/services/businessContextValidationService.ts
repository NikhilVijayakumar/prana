export interface BusinessContextValidationResult {
  valid: boolean;
  errors: string[];
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

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
};
