# NITR CampusCare — What changed & setup notes

## Design
- Unified the two different reds that were in use (`#b91c1c` vs `#8b1e2d`) into one brand system, and standardized typography (Playfair Display + Inter + JetBrains Mono for IDs/codes) across every page — some pages were still falling back to Arial.
- New shared files: `theme.css` (design tokens + components) and `effects.js` (3D tilt, scroll reveal, toasts, confirm dialogs, mobile nav, the hero visual). Every page loads both before its own stylesheet/script.
- Hero on the homepage renders a real WebGL "network" visual (Three.js, loaded from CDN) representing complaints being routed to departments; it automatically falls back to a lightweight 2D canvas version (used on the login page) if WebGL/Three.js isn't available, and to a static gradient if the person has "reduce motion" turned on.
- Real photography (NIT Rourkela campus/gate, via Wikimedia Commons) replaced the broken `assets/nitr-campus.jpg` reference, and the campus video section now embeds a real campus tour video (click-to-play, so it doesn't load until requested). If any hotlinked photo ever fails to load, it gracefully falls back to a themed gradient instead of a broken-image icon.
- Replaced browser `alert()`/`confirm()` popups with in-app toasts and a confirm dialog (e.g. logging out now asks for confirmation instead of signing out immediately).

## Bugs fixed
- `complaint-details.html`'s **Priority** field was never actually wired up — it always showed the static placeholder "Normal" regardless of the real value. Now displays `complaint.priority`.
- Mobile visitors on the homepage had **no way to reach navigation at all** (`nav { display: none }` with no replacement) — added a proper hamburger menu.
- `register-complaint.html` had two conflicting implementations (an unused external `register-complaint.js/css`, and a different inline version with evidence upload). Consolidated into one, using the external-file pattern the rest of the project uses.
- `complaint.css` / `complaint.js` existed but were empty — these are now `complaint-details.html`'s real stylesheet/script (their naming suggested that's what they were meant for).
- `reset-password.html` was referenced by the forgot-password email flow but never existed — added it.

## New features
- Photo evidence upload (drag-and-drop) on the complaint form, now displayed on the complaint details page.
- Live status updates via Supabase Realtime on the dashboard, My Complaints, and complaint details pages.
- A small profile modal on the dashboard, print support on complaint details, animated stat counters, an FAQ section, and a password strength meter on signup.

## Backend setup you may want to do
Everything above degrades gracefully if these aren't set up (nothing will break) — but to get the full effect:

1. **Evidence photo storage** — create a Storage bucket named `complaint-evidence` in your Supabase project. If you want photos visible via the direct `getPublicUrl()` link the code tries first, mark the bucket public; otherwise the code automatically falls back to a signed URL. Either way, uploads work without a database migration: the insert logic tries to save an `evidence_path` / `location` / `priority` column on `complaints` and automatically retries without any field Postgres reports as missing, so it's safe whether or not those columns exist yet.
2. **Realtime** — in Supabase, enable Realtime replication for the `complaints` table if you want the dashboard/complaint pages to update live when a status changes, instead of only on refresh.

## Swapping the photos/video
Search `commons.wikimedia.org/wiki/Special:FilePath` in `index.html`/`login.html` to swap campus photos, and the YouTube ID `W1uMJ794q2g` in `index.html`/`script.js` to swap the campus video.
