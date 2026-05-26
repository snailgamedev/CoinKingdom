import { chromium } from 'playwright';
const URL = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/CoinKingdom/index.html';
const DIR = '/tmp/ck-shots';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 })).newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(300);

async function shot(name) { await page.waitForTimeout(450); await page.screenshot({ path: `${DIR}/${name}.png` }); console.log('shot', name); }

await shot('1-splash');
await page.locator('#splash').click(); await page.waitForTimeout(300);
await page.evaluate(() => closeSheet());            // close how-to
await page.evaluate(() => { save.coins = 4820; save.stars = 12; updatePurse(); });
await shot('2-hub');

await page.evaluate(() => startMode('pusher')); await page.waitForTimeout(900);
await page.evaluate(() => { game.drop(); game.drop(); game.drop(); });
await page.waitForTimeout(700); await shot('3-pusher');
await page.evaluate(() => quitToHub());

await page.evaluate(() => startMode('catcher')); await page.waitForTimeout(1100); await shot('4-catcher');
await page.evaluate(() => quitToHub());

await page.evaluate(() => startMode('toss')); await page.waitForTimeout(500);
await page.evaluate(() => { game.aiming = true; game.ax = CW / 2 - 40; game.ay = CH * 0.76 + 90; });
await page.waitForTimeout(300); await shot('5-toss');
await page.evaluate(() => quitToHub());

await page.evaluate(() => startMode('flip')); await page.waitForTimeout(400); await shot('6-flip');
await page.evaluate(() => quitToHub());

await page.evaluate(() => startMode('wheel')); await page.waitForTimeout(500); await shot('7-wheel');
await page.evaluate(() => quitToHub());

await page.evaluate(() => openShop()); await page.waitForTimeout(300); await shot('8-shop');
await page.evaluate(() => { shopTab = 'upg'; renderShop(); }); await page.waitForTimeout(200); await shot('9-shop-upg');
await page.evaluate(() => { closeSheet(); openFaith(); }); await page.waitForTimeout(300); await shot('10-faith');
await page.evaluate(() => { closeSheet(); openAch(); }); await page.waitForTimeout(300); await shot('11-goals');
await page.evaluate(() => closeSheet());

// desktop view
await page.setViewportSize({ width: 1100, height: 760 });
await page.evaluate(() => renderHub()); await page.waitForTimeout(400); await shot('12-hub-desktop');

await browser.close();
console.log('done →', DIR);
