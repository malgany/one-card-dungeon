import { expect, test } from '@playwright/test';

test('loads and renders the canvas game without console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto('/');
  const webglCanvas = page.locator('.board-webgl');
  const canvas = page.locator('#game');
  await expect(webglCanvas).toBeVisible();
  await expect(canvas).toBeVisible();

  await expect(page.locator('canvas')).toHaveCount(2);

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);

  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('#game');
    const ctx = canvasElement?.getContext('2d');
    if (!canvasElement || !ctx) return false;

    const sample = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
    for (let index = 3; index < sample.length; index += 4) {
      if (sample[index] !== 0) return true;
    }
    return false;
  });

  expect(consoleErrors).toEqual([]);
});
