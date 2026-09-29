const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib.js');

test('YPP: fan tier needs subs, uploads and one of watch hours / shorts views', () => {
  const [fan, full] = L.yppProgress({ subs: 600, uploads90: 3, watchHours: 3100, shortsViews90: 0 });
  assert.equal(fan.eligible, true);
  assert.equal(full.eligible, false);
  assert.equal(full.base[0].remaining, 400);
});

test('YPP: shorts path qualifies full tier', () => {
  const full = L.yppProgress({ subs: 1000, shortsViews90: 10_000_000 })[1];
  assert.equal(full.eligible, true);
  assert.equal(full.pct, 100);
});

test('YPP: progress is limited by the weakest required criterion', () => {
  const full = L.yppProgress({ subs: 1000, watchHours: 1000 })[1];
  assert.equal(full.pct, 25);
});

test('revenue estimate and views for goal', () => {
  const r = L.estimateRevenue({ longViews: 100000, shortViews: 1000000, rpmLong: 4, rpmShort: 0.05 });
  assert.equal(r.long, 400);
  assert.equal(r.short, 50);
  assert.equal(r.yearly, 5400);
  assert.equal(L.viewsForGoal(1000, 5), 200000);
  assert.equal(L.viewsForGoal(1000, 0), Infinity);
});

test('sponsor rate scales with views and deliverable', () => {
  assert.deepEqual(L.sponsorRate(10000), { low: 200, high: 500 });
  assert.deepEqual(L.sponsorRate(10000, 'Dedicated video'), { low: 500, high: 1250 });
  assert.deepEqual(L.sponsorRate(0), { low: 0, high: 0 });
});

test('title score rewards keyword near the start and flags long titles', () => {
  const good = L.titleScore('Budgeting Mistakes: 7 Ways You Lose Money', 'budgeting mistakes');
  assert.ok(good.score >= 80, `score ${good.score}`);
  const bad = L.titleScore('x'.repeat(101), 'budget');
  assert.ok(bad.tips.some((t) => t.includes('100 characters')));
  assert.equal(L.titleScore('').score, 0);
});

test('generated tags stay within the 500-char budget and dedupe', () => {
  const tags = L.generateTags('How to budget money fast', 'budget, Budget, money tips', 'Personal finance / investing');
  assert.equal(new Set(tags).size, tags.length);
  assert.equal(tags[0], 'budget');
  const many = L.generateTags('a', Array.from({ length: 200 }, (_, i) => 'keyword number ' + i).join(','));
  const cost = many.reduce((a, t, i) => a + t.length + (t.includes(' ') ? 2 : 0) + (i ? 1 : 0), 0);
  assert.ok(cost <= 500);
});

test('chapter validation', () => {
  assert.equal(L.checkChapters('0:00 Intro\n0:30 Part one\n2:00 Part two').ok, true);
  const r = L.checkChapters('0:05 Intro\n0:10 A');
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 3);
  assert.equal(L.checkChapters('1:00:00 Late\n').problems[0], 'The first chapter must start at 0:00.');
});

test('nextSlots follows cadence and skips taken days', () => {
  const from = new Date(2026, 8, 28, 9, 0); // Mon 28 Sep 2026
  const taken = [{ format: 'long', publishAt: new Date(2026, 8, 29, 17).toISOString() }];
  const slots = L.nextSlots(taken, { days: [2, 4], time: '17:00', format: 'long' }, from, 3);
  assert.deepEqual(slots.map((d) => [d.getDate(), d.getDay(), d.getHours()]), [[1, 4, 17], [6, 2, 17], [8, 4, 17]]);
  // a short on the same day doesn't block a long slot
  const s2 = L.nextSlots([{ format: 'short', publishAt: new Date(2026, 8, 29, 12).toISOString() }], { days: [2], time: '17:00', format: 'long' }, from, 1);
  assert.equal(s2[0].getDate(), 29);
  assert.deepEqual(L.nextSlots([], { days: [], time: '17:00' }, from), []);
});

test('consistency counts published videos in window', () => {
  const now = new Date(2026, 8, 28);
  const vids = [
    { status: 'Published', publishAt: new Date(2026, 8, 20).toISOString() },
    { status: 'Published', publishAt: new Date(2026, 6, 1).toISOString() },
    { status: 'Editing', publishAt: new Date(2026, 8, 21).toISOString() },
  ];
  assert.deepEqual(L.consistency(vids, 2, now), { done: 1, target: 8, pct: 13 });
});

test('ICS export escapes text and adds reminders', () => {
  const ics = L.toICS([{ id: 'a1', title: 'Hi, there; you', status: 'Idea', format: 'short', publishAt: '2026-10-01T17:00:00.000Z' }, { id: 'b', title: 'no date' }], new Date('2026-09-01T00:00:00Z'));
  assert.match(ics, /SUMMARY:\[Short\] Hi\\, there\\; you/);
  assert.match(ics, /DTSTART:20261001T170000Z/);
  assert.match(ics, /TRIGGER:-PT2H/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('income by month groups and ignores out-of-range', () => {
  const rows = L.incomeByMonth([
    { date: '2026-09-02', source: 'AdSense', amount: 10 },
    { date: '2026-09-20', source: 'Affiliate', amount: '5.5' },
    { date: '2020-01-01', source: 'AdSense', amount: 999 },
  ], 3, new Date(2026, 8, 28));
  assert.deepEqual(rows.map((r) => r.month), ['2026-07', '2026-08', '2026-09']);
  assert.equal(rows[2].total, 15.5);
  assert.equal(rows[2].bySource.Affiliate, 5.5);
});

test('CSV quotes cells with commas and quotes', () => {
  assert.equal(L.toCSV([{ a: 'x,y', b: 'say "hi"' }], ['a', 'b']), 'a,b\n"x,y","say ""hi"""');
});

test('tags skip number-only pairs', () => {
  assert.ok(!L.generateTags('Start investing with 100 2026').includes('100 2026'));
});
