# PL PROMPTER — Even Hub store submission

Everything the dev portal will ask for. Copy-paste at submission time.

## Manifest (already in `app.json` — reviewer checks these)

| Field | Value | Rubric check |
|---|---|---|
| `package_id` | `com.psychedluxuries.teleprompter` | lowercase reverse-domain, no hyphens/underscores, 3 segments ✅ (already registered in the Hub — kept, not renamed) |
| `name` | `PL PROMPTER` | 11 chars (≤20) ✅ · contains no "even" ✅ (founder-ruled name, S276·2997) |
| `version` | `0.3.0` | three-part semver ✅ — **check with founder before submit: first public release commonly starts at 1.0.0; this line already carries real dev history (0.1→0.3). Confirm which number goes out, since it is permanent once Released.** |
| `min_sdk_version` | `0.0.12` | below the current `0.0.14` floor — verify this still installs clean on a fresh Hub account before submit |
| `min_app_version` | `2.0.0` | already stamped in `app.json` |
| `permissions` | `[]` | app is fully offline — no network, no location, no mic, no album ✅ |

## Release notes (1–3 lines, en)

> One prompter for the whole set. Scroll long text, flip through idea cards, or step
> cue by cue — the same app now carries what `PL CUE SHEET` used to do alone. Four
> legibility controls (caps, line length, lines per screen, and where on the lens the
> text sits) replace the font-size control the hardware doesn't have.

## Store description

> A performer's prompter for the G2 lenses — paste a script on your phone, read it on
> the glasses.
>
> Three modes read the same text differently. Scroll breaks long copy into wrapped
> pages. Cards split on blank lines, one idea per screen. Cues step one line at a time
> with a count, holding at the first and last line rather than wrapping past them —
> built for a set list, not a paragraph.
>
> The G2 has no font-size control, so size is bought four other ways: ALL CAPS, line
> length, lines per screen, and a zone that parks text at the top, middle, bottom, or
> full lens. All four are remembered between sessions.
>
> Two presets ship in the box — the Three Truths, and a rotating line from the Psyched
> Luxuries seed library. Swipe to move through pages, double-press to exit.
>
> Nothing to sign into. No data leaves the phone.

## Controls

| Gesture | Action |
|---|---|
| Swipe down | Next page / card / cue |
| Swipe up | Previous page / card / cue |
| Double-press | Exit (system confirmation dialog) |
| Tap then long press | Contextual menu: Restart · Next mode · Bigger · Smaller · New seed |
| Phone: Scroll / Cards / Cues buttons | Switch mode — re-paginates the current text immediately |
| Phone: zone buttons (Full / Top / Middle / Bottom) | Move the text block on the lens |
| Phone: CAPS toggle, width + lines sliders | Legibility controls, persisted via `setLocalStorage` |
| Phone: Truths / Seed preset buttons | Load the Three Truths (Cards mode) or a random brand seed (Scroll mode) |

"Bigger"/"Smaller" in the glasses-side menu step through five paired width/line-count
presets (18/3 … 48/9) together, so the two never drift out of the ratio that keeps a
page legible. Menu labels are verbs, not state, because the contextual menu is
fire-and-forget — the OS never re-renders item state, so a label showing the current
value would go stale the moment it was used (same reasoning as `PL CURVES HERO`).

## Visual assets (in `store-assets/`, to be created)

| Asset | File | Notes |
|---|---|---|
| App icon | `icon-24.png` | 24×24, monochrome, drawn directly in the portal editor — **founder hands.** Fine line art turns to grey mush at this size (learned on `curve-hero`); keep it to one simple glyph, not the full merged-app concept. |
| Screenshot 1 | `screenshot-1-scroll.png` | Scroll mode, a wrapped page, real simulator capture at 576×288 on black |
| Screenshot 2 | `screenshot-2-cues.png` | Cues mode showing the `n / total` counter |
| Screenshot 3 *(optional, if the portal wants a third)* | `screenshot-3-cards.png` | Cards mode holding the Three Truths preset |

Unlike `PL CURVES HERO`, this app has no separate foreground/background 1024² icon
pair to composite — the portal's icon field for this app class is the 24×24 upload
only. Confirm that against the live portal form before treating this table as final.

## Privacy policy

https://psychedluxuries.com/privacy — the app requests no permissions and makes no
network calls: text is entered on the phone, sent to the glasses over the existing
Even Hub bridge, and only the four legibility settings + last mode persist locally via
`setLocalStorage` on the user's own device.

## Verified against the rubric (in the simulator, AT2/AT3/AT4 from the spec)

- Opening line on launch (`PASTE TEXT ON YOUR PHONE AND PRESS SEND.`), so the lenses
  are never blank before first content — verify this still reads as an intentional
  empty state, not a bug, before submit.
- Three modes render distinct pagination from the same input — Scroll wraps at the
  set width, Cards splits on blank lines, Cues is one line + `n / total` — verified
  live per the spec's evidence table (`PAGE 1 OF 2 · 24 CHARS · 5 LINES` / `CUE 1 OF 4`).
- Cue mode holds at both ends rather than wrapping (AT3) — confirm on device before
  submit; not yet device-verified per the spec.
- Three Truths preset renders as card 1 of 4 on a fresh install with no text entered
  (AT4) — confirm on device before submit.
- Menu open/close arrive as `sysEvent` types 4/5 and are explicitly ignored — same
  discipline as `curve-hero`; treating them as taps would toggle state on every menu
  open.
- **Ring input confirmed working (AT1, S276·2997, founder hands):** swipe down
  advances, double-press raises the exit dialog, on SDK `0.0.14` with no ring-specific
  code. No `eventSource` branching added — ruled "mirror the temple."

## Portal state

Hub builds **v0.2.0** and **v0.3.0** both listed as **Private** as of this session
(S276·2997). Submission (category, description, assets, privacy flow, Submit for
review) has **not** been started in the portal — everything above is drafted ready
to copy in, matching the process `curve-hero` already cleared review with.

## Still to do — needs your hands

1. **Version number call** — 0.3.0 as-is, or bump to 1.0.0 for the first public
   release. Whichever is chosen is permanent once Released.
2. **Draw the 24×24 icon** directly in the portal editor.
3. **Device test**: install a Private build, lock the phone 5 minutes, confirm cue
   mode holds at both ends and the Truths preset renders correctly (AT3/AT4 on real
   hardware, not just the simulator).
4. Fill category, description, screenshots, privacy flow in the portal (content
   above is ready to paste).
5. **Submit for review** — one-way. Submitted cannot be self-withdrawn, and Released
   is terminal: no rollback, no editing a released manifest, only publishing a higher
   version.

## Two things worth knowing before you submit

- **Released is terminal.** No withdrawal, no rollback, no editing a released
  manifest. Any change means publishing a higher version.
- **`pl-cue-sheet` is retired but not deleted from disk** (`C:\dev\even-hub-apps\cue-sheet`,
  fully pushed, 0 ahead/0 behind — an inert stray, founder ruling S276·2997, deleting it
  hit a sandbox wall Claude Code can't force past from a coordinator session). Its Hub
  project listing should still be retired/unpublished in the portal since `PL PROMPTER`
  now covers cue mode — that's a portal action, not a filesystem one, and isn't blocked.
