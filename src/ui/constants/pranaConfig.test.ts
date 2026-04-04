import { describe, expect, it, vi } from 'vitest';
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

  it('warns when required props are missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    assertRequiredBrandingFields(
      'MainLayout',
      {
        appBrandName: 'Prana',
      },
      ['appBrandName', 'appTitlebarTagline'],
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '[PRANA_BRANDING_WARN][MainLayout] Missing required branding props: appTitlebarTagline',
    );
    warnSpy.mockRestore();
  });
});
