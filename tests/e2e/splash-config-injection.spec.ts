import { test, expect } from './fixtures';

test('splash renders branding values injected from test_env.json', async ({ window, testConfig }) => {
  test.info().annotations.push({ type: 'screen', description: 'splash' });
  test.info().annotations.push({ type: 'severity', description: 'high' });

  const continueButton = window.getByRole('button', { name: /continue to splash/i });
  await expect(continueButton).toBeVisible({ timeout: 30_000 });
  await expect(continueButton).toBeEnabled({ timeout: 45_000 });
  await continueButton.click();

  const expectedBrandName = String(testConfig.APP_BRAND_NAME ?? '');
  const expectedSplashSubtitle = String(testConfig.APP_SPLASH_SUBTITLE ?? '');

  await expect(window.getByText(expectedBrandName, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(window.getByText(expectedSplashSubtitle, { exact: true })).toBeVisible({ timeout: 15_000 });
});
