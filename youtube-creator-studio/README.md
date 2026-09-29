# YouTube Creator Studio

A browser-only dashboard for planning, scheduling and making money from a YouTube channel. No account, no server, no build step — your data stays in your browser (`localStorage`), and you can back it up to a JSON file.

## Features

**Scheduling**
- **Content calendar**: a month view with long-form and Shorts colour-coded. Click a day to plan a video, drag a video to reschedule it. Open slots from your posting cadence show as dashed boxes.
- **Posting cadence**: choose separate days and times for long-form and Shorts. The app suggests the next open slots and fills them in with one click.
- **Production pipeline**: a Kanban board (Idea → Scripting → Filming → Editing → Ready → Scheduled → Published) with drag and drop.
- **Reminders**: an in-app or desktop notification when a video is due within 24 hours and isn't Ready yet. You can also export an `.ics` file for Google, Apple or Outlook Calendar, with an alarm 2 hours before each upload.

**Video editor**
- Title scorer (length, keyword position, numbers, curiosity words, ALL-CAPS check).
- Description template with links, affiliate and chapter sections, plus a chapter validator that checks YouTube's rules (starts at 0:00, at least 3 chapters, each at least 10 seconds).
- Tag generator that stays within YouTube's 500-character limit.
- An 11-item pre-publish checklist (thumbnail, hook, end screens, captions, paid-promotion disclosure…).
- A "Copy for YouTube Studio" button that copies the title, description and tags.

**Monetization**
- Partner Program tracker for both tiers: early access (500 subs, 3 uploads, and 3K watch hours or 3M Shorts views) and full YPP (1K subs, and 4K watch hours or 10M Shorts views).
- Ad revenue estimator with RPM defaults for each niche (you can override them), a split between long-form and Shorts, and how many views you'd need to hit your income goal.
- A list of income streams showing which ones are open to you right now: affiliate, sponsors and products work before YPP.

**Income & sponsors**
- An income log by source, with a stacked monthly chart, goal line, hover breakdown and CSV export.
- Sponsor rate calculator based on the $20–$50 per 1,000 views benchmark, adjusted for the type of deliverable.
- A deal pipeline (Prospect → Paid) that flags late deliverables. Marking a deal Paid adds it to Income automatically.
- A pitch email generator filled in with your channel stats.

**Optional YouTube connection**: add a YouTube Data API v3 key and your channel handle in Settings to pull your subscriber count automatically. Watch hours and revenue are private and can't be read with an API key, so copy those from YouTube Studio.

## Run

```bash
cd youtube-creator-studio
python -m http.server 8081   # or: npm start
```

Open http://localhost:8081. Go to **Settings → Load demo data** to explore with sample content.

## Test

```bash
npm test
```

The pure logic (YPP maths, revenue, sponsor rates, title scoring, tags, chapters, slot finding, ICS, CSV) lives in `lib.js` and has unit tests in `test/lib.test.js`.

## Notes

- Uploading and scheduling the video itself still happens in YouTube Studio: upload it as **Scheduled** at the time planned here, then move the card to *Scheduled*.
- RPM figures and sponsor benchmarks are rough starting points. Replace them with your real numbers from YouTube Studio → Analytics → Revenue once you have them.
- Partner Program thresholds are YouTube's published global defaults. Check the YouTube Help Center for your country.
