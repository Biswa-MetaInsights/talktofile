const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'responsive-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

const BASE = 'http://localhost:5174';

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    // Landing / auth gate
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${vp.name}-01-landing.png`, fullPage: true });
    console.log(`  01-landing captured`);

    // Check for horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`  horizontal overflow: ${overflow}`);

    // Check navbar visibility
    const navVisible = await page.locator('nav, header').first().isVisible().catch(() => false);
    console.log(`  navbar visible: ${navVisible}`);

    // Scroll down to see full landing
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${vp.name}-02-landing-mid.png`, fullPage: false });
    console.log(`  02-landing-mid captured`);

    await ctx.close();
  }

  await browser.close();
  console.log('\nDone. Screenshots in: responsive-screenshots/');
})();
