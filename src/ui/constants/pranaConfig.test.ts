import { describe, expect, it } from 'vitest';
import { assertRequiredBrandingFields, findMissingBrandingFields } from './pranaConfig';

describe('pranaConfig branding prop validation', () => {
  it('detects missing required branding fields', () => {
    const missing = findMissingBrandingFields(
      {
        appBrandName: 'Prana',
        appTitlebarTagline: '',
      },
      ['appBrandName', 'appTitlebarTagline', 'directorSenderEmail'],
    );

    expect(missing).toEqual(['appTitlebarTagline', 'directorSenderEmail']);
  });

  it('throws fail-fast error when required props are missing', () => {
    expect(() =>
      assertRequiredBrandingFields(
        'MainLayout',
        {
          appBrandName: 'Prana',
        },
        ['appBrandName', 'appTitlebarTagline'],
      ),
    ).toThrow('[PRANA_BRANDING_ERROR][MainLayout]');
  });
});
