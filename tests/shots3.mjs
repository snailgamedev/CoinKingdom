import { chromium } from 'playwright';
const URL = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/CoinKingdom/index.html';
const DIR = '/tmp/ck-shots'; import { mkdirSync } from 'fs'; mkdirSync(DIR, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 })).newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(300);
async function shot(n){ await p.waitForTimeout(450); await p.screenshot({ path:`${DIR}/${n}.png` }); console.log('shot', n); }
await p.locator('#splash').click(); await p.waitForTimeout(300); await p.evaluate(()=>closeSheet());
await p.evaluate(()=>{ save.coins=8200; save.stars=14; save.rankIdx=4; save.lifetime=120000; save.megaJackpot=8750; renderHub(); });
await shot('v2-1-hub');
// toss with aim arc + moving bonus cup
await p.evaluate(()=>startMode('toss')); await p.waitForTimeout(400);
await p.evaluate(()=>{ game.aiming=true; game.ax=CW/2-50; game.ay=CH*0.76+95; });
await p.waitForTimeout(300); await shot('v2-2-toss-arc');
await p.evaluate(()=>quitToHub()); await p.waitForTimeout(150);
// wheel mega
await p.evaluate(()=>{ save.coins=5000; startMode('wheel'); }); await p.waitForTimeout(400); await shot('v2-3-wheel-mega');
await p.evaluate(()=>quitToHub()); await p.waitForTimeout(150);
// catcher with powerup falling
await p.evaluate(()=>{ startMode('catcher'); game.magnet=5; game.items=[{x:CW*0.5,y:CH*0.4,vy:80,r:15,type:'pu',pk:'magnet'},{x:CW*0.3,y:CH*0.2,vy:80,r:15,type:'gold'}]; }); await p.waitForTimeout(300); await shot('v2-4-catcher-pu');
await p.evaluate(()=>quitToHub()); await p.waitForTimeout(150);
// pusher with chest + meter
await p.evaluate(()=>{ startMode('pusher'); game.meter=72; game.coins[0].type='chest'; }); await p.waitForTimeout(500); await shot('v2-5-pusher');
await p.evaluate(()=>quitToHub()); await p.waitForTimeout(150);
// flip with ante
await p.evaluate(()=>{ save.coins=5000; startMode('flip'); }); await p.waitForTimeout(300); await shot('v2-6-flip-ante');
await b.close(); console.log('done');
