const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const [backUrl, commerceUrl] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await context.addInitScript(() => { window.print = () => { window.printRequested = true; }; });
  const screenshots = path.resolve('..', '.local', 'verification-etiquettes');
  await fs.mkdir(screenshots, { recursive: true });
  try {
    const page = await context.newPage();
    await page.goto(backUrl + '/login');
    await page.getByPlaceholder("Nom d'utilisateur").fill('admin-test');
    await page.getByPlaceholder('Mot de passe', { exact: true }).fill(process.env.TRESOR_TEST_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.waitForURL('**/admin/dashboard');
    await page.goto(backUrl + '/admin/products');
    await page.getByPlaceholder('Nom article', { exact: true }).fill('Robe etiquette UI');
    await page.getByPlaceholder('Couleur', { exact: true }).fill('Rouge');
    await page.getByPlaceholder('Taille', { exact: true }).fill('L');
    await page.getByPlaceholder('Prix vente', { exact: true }).fill('59');
    await page.getByPlaceholder('Stock initial', { exact: true }).fill('4');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Enregistrer article', exact: true }).click();
    const popup = await popupPromise;
    await expect(popup.locator('.label .code')).toHaveText(/^20\d{10}$/);
    const barcode = await popup.locator('.code').innerText();
    await expect(popup.locator('.name')).toHaveText('Robe etiquette UI');
    await expect(popup.locator('.details')).toHaveText('Rouge / L');
    await expect(popup.locator('.price')).toHaveText('59.00 DT');
    expect(await popup.locator('svg rect').count()).toBeGreaterThan(20);
    const geometry = await popup.locator('svg').evaluate(svg => ({
      width: svg.getBoundingClientRect().width,
      labelWidth: svg.parentElement.getBoundingClientRect().width,
      physicalWidth: svg.style.width
    }));
    expect(geometry.physicalWidth).toMatch(/^[\d.]+mm$/);
    expect(geometry.width).toBeGreaterThan(90);
    expect(geometry.width).toBeLessThan(geometry.labelWidth - 10);
    await popup.screenshot({ path: path.join(screenshots, 'etiquette-50x30.png') });
    await popup.close();
    // A different value left in the form must never replace the saved item's label.
    await page.getByPlaceholder('Code-barres auto si vide').fill('WRONG-FORM-CODE');
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Robe etiquette UI', exact: true }) });
    const reprintPromise = page.waitForEvent('popup');
    await card.getByRole('button', { name: 'Etiquette Rouge L', exact: true }).click();
    const reprint = await reprintPromise;
    await expect(reprint.locator('.code')).toHaveText(barcode);
    await reprint.close();
    await page.screenshot({ path: path.join(screenshots, 'catalogue-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const buttonFits = await card.getByRole('button', { name: 'Etiquette Rouge L', exact: true }).evaluate(button => {
      const item = button.closest('article').getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      return button.scrollWidth <= button.clientWidth && bounds.right <= item.right && bounds.left >= item.left;
    });
    expect(buttonFits).toBe(true);
    await page.screenshot({ path: path.join(screenshots, 'catalogue-mobile.png'), fullPage: true });
    const till = await context.newPage();
    await till.goto(commerceUrl + '/login');
    await till.getByPlaceholder("Nom d'utilisateur").fill('seller-test');
    await till.getByPlaceholder('Mot de passe', { exact: true }).fill(process.env.TRESOR_TEST_PASSWORD);
    await till.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await till.waitForURL('**/employee/pos');
    // Catalogue import is asynchronous; reload the view once the API lookup resolves.
    await expect.poll(async () => {
      const token = await till.evaluate(() => localStorage.getItem('tresor_token'));
      const response = await context.request.get(commerceUrl + '/api/productvariants/lookup?barcode=' + barcode,
        { headers: { Authorization: `Bearer ${token}` } });
      return response.status();
    }, { timeout: 45000 }).toBe(200);
    const input = till.getByPlaceholder('Scanner ou saisir le code-barres');
    await input.fill(barcode);
    await input.press('Enter');
    await expect(till.getByText('Article ajoute', { exact: true })).toBeVisible();
    await expect(till.locator('small').filter({ hasText: barcode })).toBeVisible();
    await expect(input).toHaveValue('');
    await till.screenshot({ path: path.join(screenshots, 'scan-caisse.png'), fullPage: true });
    console.log('PASS browser: create -> correct Code128 label -> reprint -> catalogue sync -> scan to cart');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
