import { chromium } from 'playwright';

// Coin Kingdom — core smoke: boot, all 5 modes init, shop/faith/blessing/economy, persistence.
const URL = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/CoinKingdom/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 880 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
page.on('dialog', d => d.accept());

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  // boot + splash
  check('splash screen visible on load', await page.locator('#splash.on').count() === 1);
  check('version + build stamped on splash', /v\d+\.\d+ · build 2026-/.test(await page.locator('#splashFoot').textContent()));
  await page.locator('#splash').click(); await page.waitForTimeout(300);
  // a how-to sheet pops on first run — close it
  if (await page.locator('#modal.on').count()) { await page.evaluate(() => closeSheet()); await page.waitForTimeout(150); }
  check('reaches hub after tapping splash', await page.locator('#hub.on').count() === 1);
  check('hub shows 8 mode cards', await page.locator('#modeGrid .mode-card').count() === 8);
  check('hub shows the Kingdom rank banner', await page.locator('#rankBanner .rk-name').count() === 1);

  const startCoins = await page.evaluate(() => save.coins);
  check('starts with 100 coins', startCoins === 100, 'coins ' + startCoins);

  // --- PUSHER ---
  await page.evaluate(() => startMode('pusher')); await page.waitForTimeout(250);
  let ok = await page.evaluate(() => cur === 'pusher' && !!game && game.coins.length > 0);
  check('Pusher inits with a coin pile', ok);
  // drop + force a coin off the edge to confirm payout path
  const pusherPay = await page.evaluate(() => {
    const before = save.coins;
    game.drop();
    // shove one coin past the front edge and tick once
    game.coins[0].y = CH + 30;
    game.update(0.016);
    return save.coins - before;
  });
  check('Pusher pays out when a coin falls off the edge', pusherPay > 0, '+' + pusherPay);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(150);

  // --- CATCHER ---
  await page.evaluate(() => startMode('catcher')); await page.waitForTimeout(200);
  const catchScore = await page.evaluate(() => {
    // drop a coin right onto the basket and tick
    game.items = [{ x: game.bx, y: CH - 60, vy: 200, r: 15, type: 'gold' }];
    game.update(0.05);
    return game.score;
  });
  check('Catcher scores on a caught coin', catchScore > 0, 'score ' + catchScore);
  const bombLife = await page.evaluate(() => {
    const before = game.lives;
    game.items = [{ x: game.bx, y: CH - 60, vy: 200, r: 17, type: 'bomb' }];
    game.update(0.05);
    return before - game.lives;
  });
  check('Catcher loses a life on a bomb', bombLife === 1);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(150);

  // --- TOSS ---
  await page.evaluate(() => startMode('toss')); await page.waitForTimeout(200);
  const tossOk = await page.evaluate(() => cur === 'toss' && !!game && game.left >= 3 && game.targets.length === 5 && game.targets.some(t => t.bonus));
  check('Toss inits with tosses + 5 targets (incl. moving bonus cup)', tossOk);
  const tossScore = await page.evaluate(() => {
    // drop a flying coin straight into the mid cup
    const cup = game.targets[3];
    game.flying = { x: cup.x, y: cup.y - 2, vx: 0, vy: 50, spin: 0 };
    game.update(0.05);
    return game.score;
  });
  check('Toss scores when coin lands in a cup', tossScore > 0, 'score ' + tossScore);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(150);

  // --- FLIP --- (force the coin result deterministically)
  await page.evaluate(() => { Math.random = () => 0.1; startMode('flip'); }); await page.waitForTimeout(150);
  await page.evaluate(() => flipCall('H'));   // 0.1 < 0.5 → 'H', correct call
  await page.waitForTimeout(1000);
  const streak = await page.evaluate(() => flip.streak);
  check('Flip: a correct call advances the streak', streak === 1, 'streak ' + streak);
  await page.evaluate(() => { Math.random = () => 0.99; });   // restore-ish; next call would be 'T'
  await page.evaluate(() => flipCashOut()); await page.waitForTimeout(200);
  check('Flip cash-out returns to a run-over sheet', await page.locator('#modal.on').count() === 1);
  await page.evaluate(() => { closeSheet(); quitToHub(); }); await page.waitForTimeout(150);

  // --- WHEEL ---
  await page.evaluate(() => { save.coins = 500; startMode('wheel'); }); await page.waitForTimeout(150);
  const spend = await page.evaluate(() => { const b = save.coins; spinWheel(); return b - save.coins; });
  check('Wheel spin deducts the bet', spend === 50, 'spent ' + spend);
  await page.waitForTimeout(4200);   // let it settle (~2.7s spin + margin)
  check('Wheel finishes spinning', await page.evaluate(() => wheel.spinning === false));
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(150);

  // --- STACK (6th game) ---
  await page.evaluate(() => startMode('stack')); await page.waitForTimeout(250);
  const stackInit = await page.evaluate(() => cur === 'stack' && !!game && game.tower.length === 1 && !!game.cur);
  check('Stack inits with a base + moving piece', stackInit);
  const stackPlace = await page.evaluate(() => {
    const before = game.tower.length;
    // align the moving piece perfectly over the base, then drop
    game.cur.x = game.tower[0].x;
    game.place();
    return { grew: game.tower.length - before, height: game.height };
  });
  check('Stack: a drop grows the tower', stackPlace.grew === 1 && stackPlace.height === 1, 'height ' + stackPlace.height);
  const stackMiss = await page.evaluate(() => {
    // move the piece fully off the tower and drop → game over
    game.cur.x = CW; game.cur.w = 20;
    game.place();
    return game.over;
  });
  check('Stack: a total miss ends the run', stackMiss === true);
  await page.waitForTimeout(700);
  await page.evaluate(() => { closeSheet(); quitToHub(); }); await page.waitForTimeout(150);

  // --- KINGDOM RANK ---
  const rank = await page.evaluate(() => {
    save.lifetime = 0; save.rankIdx = 0;
    const before = save.rankIdx;
    addCoins(1200, false);          // crosses the Peddler threshold (1000)
    return { idx: save.rankIdx, before, lvlupShown: document.getElementById('levelup').classList.contains('on') };
  });
  check('earning coins raises Kingdom rank', rank.idx === 1 && rank.lvlupShown, 'rankIdx ' + rank.idx);
  await page.waitForTimeout(150);

  // --- v2.0 feature coverage ---
  const perk = await page.evaluate(() => { save.rankIdx = 4; return luckMult(); });
  check('rank gives a coin perk (luckMult > 1)', perk > 1.15, 'luckMult ' + perk.toFixed(2));

  const mega = await page.evaluate(() => {
    save.coins = 1000; save.freeSpins = 0; save.megaJackpot = 2000; startMode('wheel');
    const before = save.megaJackpot; spinWheel(); return save.megaJackpot - before;
  });
  check('paid spin grows the MEGA jackpot', mega > 0, '+' + mega);
  await page.waitForTimeout(4200);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(120);

  const freeSpin = await page.evaluate(() => { save.lastBless = null; save.freeSpins = 0; claimBlessing(); closeSheet(); return save.freeSpins; });
  check('daily blessing grants a free spin', freeSpin >= 1, 'freeSpins ' + freeSpin);

  const skins = await page.evaluate(() => ['molten', 'cosmic', 'crown'].every(k => !!SKINS[k]));
  check('new coin skins exist (molten/cosmic/crown)', skins);

  const flipAnte = await page.evaluate(() => { save.coins = 5000; startMode('flip'); setAnte(500); const b = flip.bet; quitToHub(); return b; });
  check('flip ante selector sets the bet', flipAnte === 500, 'bet ' + flipAnte);

  const pu = await page.evaluate(() => {
    startMode('catcher');
    game.items = [{ x: game.bx, y: CH - 60, vy: 200, r: 15, type: 'pu', pk: 'magnet' }];
    game.update(0.05);
    return game.magnet;
  });
  check('catcher power-up (magnet) activates on catch', pu > 0, 'magnet ' + pu.toFixed(1));
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(120);

  const meter = await page.evaluate(() => {
    startMode('pusher'); const b = game.meter;
    game.coins[0].y = CH + 30; game.update(0.016);
    return game.meter - b;
  });
  check('pusher jackpot meter fills on collect', meter > 0, '+' + meter);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(120);

  check('hub has Peak Arcade + The Word cross-links', await page.locator('#arcadeLink').count() === 1 && await page.locator('#wordLink').count() === 1);

  // --- DICE ROYALE (7th game) ---
  await page.evaluate(() => startMode('dice')); await page.waitForTimeout(250);
  const diceInit = await page.evaluate(() => cur === 'dice' && !!game && game.pot === 0 && game.d1 >= 1 && game.d2 >= 1);
  check('Dice Royale inits', diceInit);
  const diceWin = await page.evaluate(() => {
    // force a safe (non-7) roll and resolve
    game.rolling = 0.01; game.d1 = 3; game.d2 = 3;   // doubles, sum 6 (safe)
    game.update(0.05);
    return { pot: game.pot, streak: game.streak };
  });
  check('Dice: a safe roll grows the pot', diceWin.pot > 0 && diceWin.streak === 1, 'pot ' + diceWin.pot);
  const diceBust = await page.evaluate(() => {
    game.over = false; game.rolling = 0.01; game.d1 = 3; game.d2 = 4;   // sum 7 = bust
    game.update(0.05);
    return game.over;
  });
  check('Dice: rolling a 7 busts the run', diceBust === true);
  await page.waitForTimeout(700);
  await page.evaluate(() => { closeSheet(); quitToHub(); }); await page.waitForTimeout(120);

  // --- 📍 COIN DROP (Plinko · 8th game) ---
  await page.evaluate(() => startMode('plinko')); await page.waitForTimeout(200);
  check('Coin Drop inits with a peg field', await page.evaluate(() => cur === 'plinko' && !!game && game.pegs.length > 0));
  const plinko = await page.evaluate(() => {
    save.coins = 50000; save.blessing = 0; game.bet = 200;
    const before = save.coins;
    game.drop();                                  // drop a coin from center
    const betTaken = before - save.coins;          // 200
    let guard = 0;
    while (game.coins.length && guard < 800) { game.update(1/60); guard++; }
    return { betTaken, score: game.score, settled: game.coins.length === 0 };
  });
  check('Coin Drop deducts the bet on drop', plinko.betTaken === 200, 'took ' + plinko.betTaken);
  check('Coin Drop coin bounces down + pays a multiplier', plinko.settled && plinko.score > 0, 'won ' + plinko.score);
  await page.evaluate(() => quitToHub()); await page.waitForTimeout(120);

  // --- SHOP ---
  await page.evaluate(() => { save.coins = 5000; openShop(); }); await page.waitForTimeout(150);
  const bought = await page.evaluate(() => { buySkin('silver'); return { owned: !!save.skins.silver, equipped: save.skin === 'silver' }; });
  check('Shop: buy + equip a coin skin', bought.owned && bought.equipped);
  const upg = await page.evaluate(() => { shopTab = 'upg'; renderShop(); buyUpg('luck'); return save.upg.luck; });
  check('Shop: buy an upgrade level', upg === 1, 'luck lvl ' + upg);
  await page.evaluate(() => closeSheet());

  // --- FAITH GIVE ---
  const give = await page.evaluate(() => { save.coins = 2000; const s = save.stars; openFaith(); give(500); return { stars: save.stars - s, bless: save.blessing }; });
  check('Faith: giving grants stars + a blessing', give.stars >= 1 && give.bless >= 1, '+' + give.stars + '⭐');
  await page.evaluate(() => closeSheet());

  // --- BLESSING ---
  const bless = await page.evaluate(() => { save.lastBless = null; const c = save.coins; claimBlessing(); return { gained: save.coins - c, streak: save.blessStreak }; });
  check('Daily blessing pays out + sets streak', bless.gained > 0 && bless.streak >= 1, '+' + bless.gained);
  await page.evaluate(() => closeSheet());

  // --- ACHIEVEMENTS render ---
  await page.evaluate(() => openAch()); await page.waitForTimeout(120);
  check('Goals sheet lists achievements', await page.locator('#sheet .ach').count() >= 10);
  await page.evaluate(() => closeSheet());

  // --- 🏅 HALL OF FAME ---
  const hof = await page.evaluate(() => {
    save.best = { pusher: 6500, flip: 9, stack: 20 };  // gold pusher, silver flip
    openHallOfFame();
    const html = document.getElementById('sheet').innerHTML;
    return { open: !!document.querySelector('#modal.on'),
      hasTitle: html.includes('Hall of Fame'),
      hasRank: html.includes(rankInfo().cur.name),
      hasGold: html.includes('🥇'),  // pusher 6500 >= 6000 gold
      hasModes: (html.match(/best per game/i) ? true : false) };
  });
  check('Hall of Fame opens', hof.open && hof.hasTitle);
  check('Hall of Fame shows Kingdom rank', hof.hasRank);
  check('Hall of Fame awards medal tiers (🥇 for a gold best)', hof.hasGold);
  await page.evaluate(() => closeSheet());

  // --- 🏦 ROYAL BANK + real-life economy ---
  const bank = await page.evaluate(() => {
    save.coins = 10000; save.bank = 0; save.bankTs = Date.now(); save._interestEarned = 0;
    bankDeposit(5000);                                  // purse 5000, bank 5000
    const afterDep = { coins: save.coins, bank: save.bank };
    save.bankTs = Date.now() - 2 * 86400000;             // pretend 2 days passed
    const gained = accrueInterest();                     // ~3%/day compounding on 5000
    bankWithdraw('all');
    return { afterDep, gained, finalBank: save.bank, finalCoins: save.coins };
  });
  check('Bank: deposit moves coins purse→bank', bank.afterDep.coins === 5000 && bank.afterDep.bank === 5000);
  check('Bank: earns daily interest', bank.gained > 0, '+' + bank.gained + ' over 2 days');
  check('Bank: withdraw-all empties the bank', bank.finalBank === 0);
  const tax = await page.evaluate(() => {
    save.coins = 0; save.rankIdx = 0; save.blessing = 0; save.upg = {}; save._taxPaid = 0;
    const got = addCoins(10000);                         // big win → taxed 10%
    return { got, taxPaid: save._taxPaid };
  });
  check('Kingdom tax skims 10% of a big win', tax.got === 9000 && tax.taxPaid === 1000, 'net ' + tax.got + ', tax ' + tax.taxPaid);
  await page.evaluate(() => { closeSheet(); save.bank = 0; save.coins = 100; persist(); });

  // --- 👑 ADMIN THRONE ---
  const adm = await page.evaluate(() => {
    window.prompt = () => 'OME';                 // answer the access prompt
    save._admin = null;                          // start signed out
    openSettings();                              // version line is the secret trigger
    for (let i = 0; i < 5; i++) adminTap();       // 5 taps → prompt → OME
    const signedIn = save._admin;
    const beforeCoins = save.coins;
    admUnlockAll();
    return { signedIn, gained: save.coins - beforeCoins,
      skins: Object.keys(save.skins).length, totalSkins: Object.keys(SKINS).length,
      rank: save.rankIdx, topRank: RANKS.length - 1,
      goals: Object.values(save.ach).filter(Boolean).length, totalGoals: ACH.length };
  });
  check('Admin: OME unlocks the throne (5-tap + name)', adm.signedIn === 'OME', 'as ' + adm.signedIn);
  check('Admin: UNLOCK ALL owns every coin skin', adm.skins === adm.totalSkins, adm.skins + '/' + adm.totalSkins);
  check('Admin: UNLOCK ALL hits KING OF COINS rank', adm.rank === adm.topRank, 'rank ' + adm.rank);
  check('Admin: UNLOCK ALL clears every goal', adm.goals === adm.totalGoals, adm.goals + '/' + adm.totalGoals);
  const coda = await page.evaluate(() => { save._admin = null; window.prompt = () => 'coda'; openSettings(); for (let i = 0; i < 5; i++) adminTap(); return save._admin; });
  check('Admin: Coda is also a valid royal', coda === 'Coda', 'as ' + coda);
  const rej = await page.evaluate(() => { save._admin = null; window.prompt = () => 'randomdude'; openSettings(); for (let i = 0; i < 5; i++) adminTap(); return save._admin; });
  check('Admin: a stranger is rejected', rej === null, 'got ' + rej);
  await page.evaluate(() => { save._admin = null; persist(); closeSheet(); });

  // --- PERSISTENCE ---
  await page.evaluate(() => { save.coins = 1234; persist(); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
  const persisted = await page.evaluate(() => save.coins);
  check('coins persist across reload', persisted === 1234, 'coins ' + persisted);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 4).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message + '\n' + (e.stack || '')); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nCOIN KINGDOM SMOKE: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
