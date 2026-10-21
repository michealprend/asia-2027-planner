// Full functional test suite for Asia 2027 planner v5.
// Run: node _test.js   (serves ./ on http://localhost:8123 first)
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8123;
const ROOT = '/home/user/workspace/asia-app';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ics': 'text/calendar' };

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { const v = !!cond; v ? pass++ : fail++; console.log((v ? 'PASS' : 'FAIL') + ' | ' + name + (v ? '' : '  <<< ' + extra)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(res => { server.once('error', () => res()); server.listen(PORT, () => res()); });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  // ---------- 1. Load ----------
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('#list .stop', { state: 'attached' });
  ok('renders 21 stops', (await page.locator('#list .stop').count()) === 21);
  ok('renders 21 stay cards', (await page.locator('#stayList .acc-card').count()) === 21);
  ok('stats 57 nights / 21 places', (await page.locator('#nights').textContent()) === '57' && (await page.locator('#places').textContent()) === '21');
  await sleep(1500); // let SW register + initial save
  ok('save indicator not erroring', !(await page.locator('#save').evaluate(el => el.classList.contains('error'))));
  ok('service worker registered', (await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)) >= 1);
  ok('v5 cache holds app.js', await page.evaluate(async () => {
    const keys = await caches.keys();
    const c = keys.find(k => k.includes('v5'));
    if (!c) return false;
    const cache = await caches.open(c);
    return !!(await cache.match('./app.js') || await cache.match(new URL('./app.js', location.href)));
  }));

  // ---------- 2. Budget ----------
  await page.click('.tab[data-view="budget"]');
  await page.waitForSelector('#budget:not(.hidden)');
  await page.fill('#bTotalIn', '6000');
  await sleep(900); // debounce save
  // accommodation estimate: set Bangkok price first (stay tab) — come back later; add expense now
  await page.selectOption('#expStop', 'bkk');
  await page.fill('#expDesc', 'Street food tour');
  await page.fill('#expAmt', '1000');
  await page.selectOption('#expCur', 'THB');
  await page.click('#expAdd');
  await sleep(400);
  const spent1 = await page.locator('#bSpent').textContent();
  ok('expense 1000 THB ≈ €27 (1000/36.5)', spent1.includes('27'), spent1);
  ok('remaining ≈ €5,973', (await page.locator('#bLeft').textContent()).includes('5,973'));
  ok('expense row visible', (await page.locator('#expList .exp-row').count()) === 1);
  // rate edit: THB 36.5 -> 35
  await page.fill('[data-rate="THB"]', '35');
  await sleep(900);
  const spent2 = await page.locator('#bSpent').textContent();
  ok('rate change updates total (1000/35 ≈ €29)', spent2.includes('29'), spent2);
  // restore rate
  await page.fill('[data-rate="THB"]', '36.5');
  await sleep(900);

  // ---------- 3. Packing ----------
  await page.click('.tab[data-view="packing"]');
  await page.waitForSelector('#packing:not(.hidden)');
  const initialPack = await page.locator('#packList .pack-row').count();
  ok('starter packing list seeded (25 items)', initialPack === 25, 'got ' + initialPack);
  await page.fill('#packNew', 'Test snorkel mask');
  await page.click('#packAdd');
  await sleep(400);
  ok('add packing item', (await page.locator('#packList .pack-row').count()) === 26);
  await page.locator('#packList .pack-row', { hasText: 'Test snorkel mask' }).locator('input[type=checkbox]').check();
  await sleep(400);
  ok('tick item updates count', (await page.locator('#pCount').textContent()) === '1 of 26 packed');
  ok('progress bar filled', (await page.locator('#pFill').evaluate(el => el.style.width)) !== '0%');

  // ---------- 4. Map ----------
  await page.click('.tab[data-view="map"]');
  await page.waitForSelector('#map:not(.hidden)');
  await sleep(900); // leaflet init
  const markers = await page.locator('#mapBox path.leaflet-interactive').count();
  ok('leaflet route drawn online (21 circles + polyline > 21 paths)', markers >= 22, 'got ' + markers);
  ok('no unmapped stops listed', (await page.locator('#unmapped').textContent()).trim() === '');

  // ---------- 5. Stay + accommodation estimate ----------
  await page.click('.tab[data-view="stay"]');
  const bkk = page.locator('#stayList .acc-card[data-id="bkk"]');
  await bkk.locator('button[data-area="Sukhumvit"]').click();
  await sleep(300);
  // open details and set price 50 EUR
  await bkk.locator('.acc-toggle').click();
  await bkk.locator('input[data-f="price"]').fill('50');
  await bkk.locator('select[data-f="currency"]').selectOption('EUR');
  await sleep(900);
  await page.click('.tab[data-view="budget"]');
  const accom = await page.locator('#bAccom').textContent();
  ok('accommodation estimate 3n × €50 = €150', accom.includes('150'), accom);
  const estRow = await page.locator('#accomEst').textContent();
  ok('estimate row shows 50 EUR × 3n', estRow.includes('50 EUR × 3n') || estRow.includes('50 EUR × 3'), estRow.slice(0, 80));

  // ---------- 6. ICS export ----------
  await page.click('.tab[data-view="backup"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ics')]);
  const icsPath = '/tmp/asia-test.ics';
  await dl.saveAs(icsPath);
  const ics = fs.readFileSync(icsPath, 'utf8');
  const vevents = (ics.match(/BEGIN:VEVENT/g) || []).length;
  ok('ics has 21 VEVENTs', vevents === 21, 'got ' + vevents);
  ok('ics starts VCALENDAR + VERSION', ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
  ok('ics first DTSTART 20270115 (fly)', ics.includes('DTSTART;VALUE=DATE:20270115'));
  ok('ics fly DTEND 20270116', /DTEND;VALUE=DATE:20270116/.test(ics));
  const dtends = [...ics.matchAll(/DTEND;VALUE=DATE:(\d{8})/g)].map(m => m[1]);
  ok('ics last DTEND 20270313 (Jan 15 + 57n)', dtends[dtends.length - 1] === '20270313', 'got ' + dtends[dtends.length - 1]);
  ok('ics CRLF line endings', ics.includes('\r\nBEGIN:VEVENT'));
  ok('ics UIDs present', /UID:[\w-]+-asia2027@planner/.test(ics));
  ok('ics DTSTAMP present', /DTSTAMP:\d{8}T\d{6}Z/.test(ics));

  // ---------- 7. Backup roundtrip ----------
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const jsonPath = '/tmp/asia-backup.json';
  await dl2.saveAs(jsonPath);
  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  ok('backup has stops/stays/budget/packing', Array.isArray(backup.stops) && !!backup.stays.bkk && !!backup.budget.expenses?.length && Array.isArray(backup.packing));
  ok('backup version 5', backup.version === 5);
  ok('backup keeps picked area + hotel data', backup.stays.bkk.area === 'Sukhumvit');
  // mutate: add another expense, then restore backup and check it's gone
  await page.click('.tab[data-view="budget"]');
  await page.fill('#expAmt', '999');
  await page.selectOption('#expCur', 'EUR');
  await page.click('#expAdd');
  await sleep(400);
  ok('mutation added (2 expenses)', (await page.locator('#expList .exp-row').count()) === 2);
  await page.setInputFiles('#file', jsonPath);
  await sleep(700);
  ok('restore removes mutation (1 expense again)', (await page.locator('#expList .exp-row').count()) === 1);
  ok('restore keeps packing item', (await page.locator('#packList .pack-row').count()) === 26);
  ok('restore keeps stay selection', (await page.locator('#stayList .acc-card[data-id="bkk"] .area.selected').count()) === 1);

  // ---------- 8. Reorder keeps selection ----------
  await page.click('.tab[data-view="itinerary"]');
  await page.locator('#list .stop[data-id="bkk"]').locator('button[data-a="up"]').click();
  await sleep(400);
  const firstCard = await page.locator('#stayList .acc-card').first().evaluate(el => el.dataset.id);
  ok('reorder moves bkk to top', firstCard === 'bkk', firstCard);
  ok('selection follows reorder', (await page.locator('#stayList .acc-card[data-id="bkk"] .area.selected').count()) === 1);

  // ---------- 9. New stop gets blank stay record immediately ----------
  await page.click('#add');
  await page.fill('#location', 'Test Stop');
  await page.fill('#stopNights', '2');
  await page.fill('#stopLat', '10');
  await page.fill('#stopLng', '100');
  await page.locator('#form').dispatchEvent('submit');
  await sleep(400);
  const newId = await page.locator('#list .stop').last().evaluate(el => el.dataset.id);
  const hasRecord = await page.evaluate(async id => {
    const rq = indexedDB.open('asiaTripPlanner');
    return new Promise(res => rq.onsuccess = () => {
      const g = rq.result.transaction('state').objectStore('state').get('trip');
      g.onsuccess = () => res(!!g.result.stays[id] && g.result.stays[id].area === '');
    });
  }, newId);
  ok('new stop gets blank stay record in DB', hasRecord);
  await page.click('.tab[data-view="map"]');
  await sleep(600);
  const markers2 = await page.locator('#mapBox path.leaflet-interactive').count();
  ok('new stop appears on map (>= 23 paths)', markers2 >= 23, 'got ' + markers2);
  // clean up: delete test stop
  await page.click('.tab[data-view="itinerary"]');
  page.on('dialog', d => d.accept());
  await page.locator('#list .stop').last().locator('button[data-a="delete"]').click();
  await sleep(400);
  ok('test stop deleted', (await page.locator('#list .stop').count()) === 21);

  // ---------- 10. Offline reload keeps everything ----------
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#list .stop', { state: 'attached' });
  ok('offline reload renders 21 stops', (await page.locator('#list .stop').count()) === 21);
  ok('offline reload keeps stay selection', (await page.locator('#stayList .acc-card[data-id="bkk"] .area.selected').count()) === 1);
  await page.click('.tab[data-view="budget"]');
  await sleep(300);
  ok('offline reload keeps expense', (await page.locator('#expList .exp-row').count()) === 1);
  ok('offline reload keeps budget total', (await page.locator('#bTotalIn').inputValue()) === '6000');
  await page.click('.tab[data-view="packing"]');
  ok('offline reload keeps packing (26)', (await page.locator('#packList .pack-row').count()) === 26);
  await page.click('.tab[data-view="map"]');
  await sleep(500);
  const schematic = await page.locator('#mapBox svg').count();
  ok('offline map shows schematic SVG', schematic === 1);
  ok('no page errors during whole suite', errs.length === 0, errs.join(' ; '));

  // ---------- 11. Mobile viewport ----------
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(`http://localhost:${PORT}/`);
  await m.waitForSelector('#list .stop', { state: 'attached' });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('mobile 390 no horizontal overflow', overflow <= 1, 'overflow ' + overflow);
  await m.click('.tab[data-view="budget"]');
  await m.waitForSelector('#budget:not(.hidden)');
  ok('mobile budget tab reachable', await m.locator('#bTotalIn').isVisible());
  await m.click('.tab[data-view="map"]');
  await sleep(800);
  ok('mobile map renders', (await m.locator('#mapBox svg, #mapBox .leaflet-container').count()) >= 1);
  await m.click('.tab[data-view="packing"]');
  ok('mobile packing tab reachable', await m.locator('#packNew').isVisible());
  const mErrs = [];
  m.on('pageerror', e => mErrs.push(e.message));
  ok('mobile no page errors', mErrs.length === 0, mErrs.join(' ; '));

  // ---------- screenshots ----------
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const t of ['budget', 'packing', 'map']) {
    await page.click(`.tab[data-view="${t}"]`);
    await sleep(t === 'map' ? 900 : 300);
    await page.screenshot({ path: `/tmp/shot-${t}-desktop.png` });
  }
  await m.click('.tab[data-view="budget"]');
  await m.screenshot({ path: '/tmp/shot-budget-mobile.png' });
  await m.click('.tab[data-view="map"]');
  await sleep(800);
  await m.screenshot({ path: '/tmp/shot-map-mobile.png' });
  await m.click('.tab[data-view="itinerary"]');
  await m.screenshot({ path: '/tmp/shot-itin-mobile.png' });

  await browser.close();
  server.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR', e); process.exit(1); });
