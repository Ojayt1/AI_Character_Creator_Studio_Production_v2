/*
 * Cadence creator planner — pure logic (no DOM).
 * Loaded by index.html as a classic script (exposes window.YTLib) and by
 * Node tests via require().
 */
(function (root) {
  'use strict';

  const DAY = 86400000;

  // Rough, editable RPM starting points (USD revenue per 1,000 views the creator
  // actually keeps). Real RPM varies widely by audience country, season and
  // format — the app always lets the user override these.
  const NICHES = {
    'Personal finance / investing': { long: 12, short: 0.08 },
    'Tech / software': { long: 8, short: 0.07 },
    'Business / marketing': { long: 9, short: 0.07 },
    'Education / how-to': { long: 5, short: 0.06 },
    'Health / fitness': { long: 4.5, short: 0.05 },
    'Cooking / food': { long: 3.5, short: 0.05 },
    'Travel / lifestyle': { long: 3.5, short: 0.05 },
    'Beauty / fashion': { long: 3, short: 0.05 },
    'Gaming': { long: 2.5, short: 0.04 },
    'Entertainment / comedy': { long: 2, short: 0.04 },
    'Music': { long: 1.5, short: 0.03 },
    'Animation / storytelling': { long: 3, short: 0.05 },
    'Other': { long: 3, short: 0.05 },
  };

  const STATUSES = ['Idea', 'Scripting', 'Filming', 'Editing', 'Ready', 'Scheduled', 'Published'];

  const CHECKLIST = [
    ['thumbnail', 'Custom thumbnail (1280×720, readable at small size)'],
    ['hook', 'Hook in the first 15 seconds'],
    ['seo', 'Title, description & tags optimised'],
    ['chapters', 'Chapters in description (long-form)'],
    ['captions', 'Captions / subtitles uploaded'],
    ['endscreen', 'End screen + cards pointing to another video'],
    ['playlist', 'Added to a playlist'],
    ['links', 'Affiliate / merch / membership links in description'],
    ['disclosure', '“Includes paid promotion” ticked (if sponsored)'],
    ['comment', 'Pinned comment with a question / CTA'],
    ['promo', 'Shared to socials / community post'],
  ];

  const INCOME_SOURCES = ['AdSense', 'Sponsorship', 'Memberships', 'Super Thanks / Chat', 'Affiliate', 'Merch / Shopping', 'Digital products', 'Other'];

  const DEAL_STAGES = ['Prospect', 'Pitched', 'Negotiating', 'Contracted', 'Delivered', 'Paid'];

  // YouTube Partner Program thresholds (check YouTube's help centre for your
  // country — these are the published global defaults).
  const YPP_TIERS = [
    {
      id: 'fan',
      name: 'Early access (fan funding)',
      unlocks: 'Channel memberships, Super Chat, Super Thanks, Super Stickers, YouTube Shopping',
      base: [
        { key: 'subs', label: 'Subscribers', target: 500 },
        { key: 'uploads90', label: 'Public uploads (last 90 days)', target: 3 },
      ],
      either: [
        { key: 'watchHours', label: 'Public watch hours (last 12 months)', target: 3000 },
        { key: 'shortsViews90', label: 'Shorts views (last 90 days)', target: 3000000 },
      ],
    },
    {
      id: 'full',
      name: 'Full YPP (ad revenue)',
      unlocks: 'Everything above + ad revenue on long-form and Shorts, YouTube Premium revenue',
      base: [{ key: 'subs', label: 'Subscribers', target: 1000 }],
      either: [
        { key: 'watchHours', label: 'Public watch hours (last 12 months)', target: 4000 },
        { key: 'shortsViews90', label: 'Shorts views (last 90 days)', target: 10000000 },
      ],
    },
  ];

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function criterion(c, stats) {
    const value = num(stats[c.key]);
    return { ...c, value, pct: Math.min(100, (value / c.target) * 100), met: value >= c.target, remaining: Math.max(0, c.target - value) };
  }

  function yppProgress(stats) {
    return YPP_TIERS.map((t) => {
      const base = t.base.map((c) => criterion(c, stats));
      const either = t.either.map((c) => criterion(c, stats));
      const best = either.reduce((a, b) => (b.pct > a.pct ? b : a));
      const eligible = base.every((c) => c.met) && either.some((c) => c.met);
      const pct = Math.min(...base.map((c) => c.pct), best.pct);
      return { id: t.id, name: t.name, unlocks: t.unlocks, base, either, eligible, pct };
    });
  }

  function estimateRevenue({ longViews = 0, shortViews = 0, rpmLong = 0, rpmShort = 0 }) {
    const long = (num(longViews) / 1000) * num(rpmLong);
    const short = (num(shortViews) / 1000) * num(rpmShort);
    const monthly = long + short;
    return { long, short, monthly, yearly: monthly * 12 };
  }

  // Monthly long-form views required to hit an AdSense goal at a given RPM.
  function viewsForGoal(goal, rpm) {
    return num(rpm) ? Math.ceil((num(goal) / num(rpm)) * 1000) : Infinity;
  }

  // Common creator rule of thumb: $20–$50 per 1,000 average views for a
  // 60–90s integration; a dedicated video costs more, a mention less.
  const DELIVERABLES = {
    'Mention (15–30s)': 0.5,
    'Integration (60–90s)': 1,
    'Dedicated video': 2.5,
    'Short': 0.4,
    'Community post': 0.15,
  };

  function sponsorRate(avgViews, deliverable = 'Integration (60–90s)', cpmLow = 20, cpmHigh = 50) {
    const mult = DELIVERABLES[deliverable] ?? 1;
    const k = num(avgViews) / 1000;
    return { low: Math.round(k * cpmLow * mult), high: Math.round(k * cpmHigh * mult) };
  }

  function titleScore(title = '', keyword = '') {
    const t = title.trim();
    const tips = [];
    let score = 0;
    const len = t.length;
    if (!len) return { score: 0, len, tips: ['Add a title.'] };
    if (len > 100) tips.push('YouTube cuts titles at 100 characters — shorten it.');
    else if (len > 70) { score += 15; tips.push('Over ~70 characters gets truncated in search and on mobile.'); }
    else if (len >= 30) score += 30;
    else { score += 15; tips.push('Very short titles leave search value on the table (aim for 30–70).'); }

    const kw = keyword.trim().toLowerCase();
    if (kw) {
      const idx = t.toLowerCase().indexOf(kw);
      if (idx === -1) tips.push(`Include your target keyword “${keyword.trim()}”.`);
      else { score += 20; if (idx < 30) score += 10; else tips.push('Move the keyword closer to the start.'); }
    } else tips.push('Set a target keyword to check search fit.');

    if (/\d/.test(t)) score += 10; else tips.push('Numbers (e.g. “7 ways”, “in 2026”) often lift CTR.');
    if (/[?!]|\b(how|why|what|best|stop|never|secret|mistake|vs)\b/i.test(t)) score += 15;
    else tips.push('Add curiosity or a clear benefit (how / why / best / mistakes…).');
    const caps = t.replace(/[^A-Z]/g, '').length / Math.max(1, t.replace(/[^A-Za-z]/g, '').length);
    if (caps > 0.6 && len > 10) tips.push('Mostly UPPERCASE reads as spam — capitalise one or two words at most.');
    else score += 15;
    return { score: Math.min(100, score), len, tips };
  }

  const STOP = new Set('a an and are as at be but by for from how i in into is it its of on or so that the this to was what when why with you your my me we our vs'.split(' '));

  // Build a tag list from title + comma-separated keywords within YouTube's
  // 500-character tag budget.
  function generateTags(title = '', keywords = '', niche = '') {
    const out = [];
    const add = (s) => {
      const v = s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
      if (v && v.length > 1 && !out.includes(v)) out.push(v);
    };
    keywords.split(',').forEach(add);
    const words = title.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
    for (let i = 0; i < words.length - 1; i++) if (!/^\d+$/.test(words[i]) || !/^\d+$/.test(words[i + 1])) add(words[i] + ' ' + words[i + 1]);
    words.filter((w) => w.length > 3).forEach(add);
    if (niche && niche !== 'Other') niche.split('/').forEach(add);
    const tags = [];
    let total = 0;
    for (const t of out) {
      const cost = t.length + (t.includes(' ') ? 2 : 0) + (tags.length ? 1 : 0);
      if (total + cost > 500) break;
      tags.push(t);
      total += cost;
    }
    return tags;
  }

  function parseTime(s) {
    const p = s.split(':').map(Number);
    if (p.some((n) => !Number.isFinite(n))) return NaN;
    return p.reduce((a, n) => a * 60 + n, 0);
  }

  // Validate description chapters against YouTube's rules.
  function checkChapters(description = '') {
    const stamps = [];
    for (const line of description.split('\n')) {
      const m = line.match(/^\s*\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s+\S/);
      if (m) stamps.push({ t: parseTime(m[1]), raw: m[1] });
    }
    const problems = [];
    if (!stamps.length) return { count: 0, ok: false, problems: ['No timestamps found (format: “0:00 Intro”).'] };
    if (stamps[0].t !== 0) problems.push('The first chapter must start at 0:00.');
    if (stamps.length < 3) problems.push('You need at least 3 chapters.');
    for (let i = 1; i < stamps.length; i++) {
      if (stamps[i].t <= stamps[i - 1].t) problems.push(`${stamps[i].raw} is not after ${stamps[i - 1].raw}.`);
      else if (stamps[i].t - stamps[i - 1].t < 10) problems.push(`Chapter at ${stamps[i - 1].raw} is shorter than 10 seconds.`);
    }
    return { count: stamps.length, ok: !problems.length, problems };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Next free publishing slots from the user's cadence (weekday list + time),
  // skipping days that already have a video of the same format planned.
  function nextSlots(videos, { days = [2, 4, 6], time = '17:00', format = 'long' } = {}, from = new Date(), count = 5) {
    const taken = new Set(
      videos.filter((v) => v.publishAt && (v.format || 'long') === format).map((v) => dateKey(new Date(v.publishAt)))
    );
    const [hh, mm] = time.split(':').map(Number);
    const out = [];
    if (!days.length) return out;
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hh || 0, mm || 0);
    for (let i = 0; i < 400 && out.length < count; i++, d.setDate(d.getDate() + 1)) {
      if (d <= from || !days.includes(d.getDay()) || taken.has(dateKey(d))) continue;
      out.push(new Date(d));
    }
    return out;
  }

  // Uploads in the last N days vs. the cadence target — consistency score.
  function consistency(videos, daysPerWeek, now = new Date(), windowDays = 28) {
    const since = now.getTime() - windowDays * DAY;
    const done = videos.filter((v) => v.status === 'Published' && v.publishAt && +new Date(v.publishAt) >= since && +new Date(v.publishAt) <= +now).length;
    const target = Math.round((daysPerWeek * windowDays) / 7);
    return { done, target, pct: target ? Math.min(100, Math.round((done / target) * 100)) : 0 };
  }

  const icsEscape = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function toICS(videos, now = new Date()) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cadence Creator Planner//EN', 'CALSCALE:GREGORIAN'];
    for (const v of videos) {
      if (!v.publishAt) continue;
      const start = new Date(v.publishAt);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${v.id}@yt-creator-studio`,
        `DTSTAMP:${icsDate(now)}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(new Date(+start + 30 * 60000))}`,
        `SUMMARY:${icsEscape(`${v.format === 'short' ? '[Short] ' : ''}${v.title || 'Untitled video'}`)}`,
        `DESCRIPTION:${icsEscape(`Status: ${v.status}`)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('Upload reminder: ' + (v.title || 'video'))}`, 'END:VALARM',
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function incomeByMonth(income, months = 12, now = new Date()) {
    const keys = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    const rows = keys.map((k) => ({ month: k, total: 0, bySource: {} }));
    const idx = Object.fromEntries(keys.map((k, i) => [k, i]));
    for (const e of income) {
      const i = idx[(e.date || '').slice(0, 7)];
      if (i === undefined) continue;
      const amt = Number(e.amount) || 0;
      rows[i].total += amt;
      rows[i].bySource[e.source] = (rows[i].bySource[e.source] || 0) + amt;
    }
    return rows;
  }

  const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCSV = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');

  const api = {
    NICHES, STATUSES, CHECKLIST, INCOME_SOURCES, DEAL_STAGES, DELIVERABLES, YPP_TIERS,
    yppProgress, estimateRevenue, viewsForGoal, sponsorRate, titleScore, generateTags,
    checkChapters, nextSlots, consistency, toICS, incomeByMonth, toCSV, dateKey,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YTLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
