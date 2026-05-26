import { chromium } from 'playwright';
const URL = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/CoinKingdom/index.html';
const DIR = '/tmp/ck-shots';
import { mkdirSync } from 'fs';
mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 })).newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
async function shot(n){ await page.waitForTimeout(400); await page.screenshot({ path:`${DIR}/${n}.png` }); console.log('shot', n); }

await page.locator('#splash').click(); await page.waitForTimeout(300); await page.evaluate(()=>closeSheet());
// give a rank/coins for a richer hub
await page.evaluate(()=>{ save.lifetime=22000; save.rankIdx=3; save.coins=4820; save.stars=9; renderHub(); });
await shot('v11-1-hub-rank');

// stack mode — build a few levels
await page.evaluate(()=>startMode('stack')); await page.waitForTimeout(500);
await page.evaluate(()=>{ for(let k=0;k<6;k++){ game.cur.x = game.tower[game.tower.length-1].x + (k%2?6:-4); game.place(); } });
await page.waitForTimeout(500); await shot('v11-2-stack');

await page.evaluate(()=>quitToHub()); await page.waitForTimeout(200);
// level-up overlay
await page.evaluate(()=>{ save.lifetime=39000; save.rankIdx=3; addCoins(2000,false); });  // crosses 40k → Banker
await page.waitForTimeout(300); await shot('v11-3-levelup');
await page.waitForTimeout(2600);

// goals with new achievements
await page.evaluate(()=>openAch()); await page.waitForTimeout(300); await shot('v11-4-goals');
await page.evaluate(()=>closeSheet());

await browser.close(); console.log('done');
