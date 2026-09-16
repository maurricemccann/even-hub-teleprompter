import './style.css'
import seedsData from './seeds.json'
import { glyphLevels, tileOf, TILES, TILE_W, TILE_H, SCREEN_W } from './glyph-screen'
import { keepScrollableAfterKeyboard } from './keyboard-scroll'
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  MenuContainerProperty,
  MenuItemProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk'

const PLACEHOLDER = 'Paste text on your phone and press Send.'

type Seed = { glyph: string; phrase: string; tag: string }
const seeds = seedsData as Seed[]

const THREE_TRUTHS = [
  'Prepared for luxury.',
  'You are in control of your reality.',
  'What persists in the mind becomes your reality.',
  'Watch this.',
].join('\n\n')

type Mode = 'scroll' | 'cards' | 'cues'
type Zone = 'full' | 'top' | 'middle' | 'bottom'
const MODE_CYCLE: Mode[] = ['scroll', 'cards', 'cues']

// The G2 exposes no font-size control (verified in the SDK's own .d.ts:
// TextContainerProperty has no size field, and the docs state "no font control").
// Legibility is therefore bought with line length, line count, capitals and
// placement — the four things the container DOES expose.
type Settings = { caps: boolean; lineWidth: number; linesPerPage: number; zone: Zone; textPx: number }
const settings: Settings = { caps: true, lineWidth: 24, linesPerPage: 5, zone: 'full', textPx: 0 }

// Measured on the 576px width: ~48 '#', ~50 digits, ~57 '-'. The font is
// proportional, so these are averages, not a grid — they land close enough that
// a wrap at 24 reliably reads as roughly half-width.
const ZONES: Record<Zone, { y: number; h: number }> = {
  full: { y: 0, h: 288 },
  top: { y: 0, h: 104 },
  middle: { y: 92, h: 104 },
  bottom: { y: 184, h: 104 },
}

let mode: Mode = 'scroll'
let pages = [PLACEHOLDER]
let pageIndex = 0
let started = false
let lastText = ''

function wrap(line: string, width: number): string[] {
  const words = line.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= width) cur += ' ' + w
    else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  return out
}

function toLines(text: string): string[] {
  return text.split('\n').flatMap((l) => wrap(l.trim(), settings.lineWidth))
}

function chunk(lines: string[], per: number): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i += per) out.push(lines.slice(i, i + per).join('\n'))
  return out.length ? out : [PLACEHOLDER]
}

function paginate(raw: string): string[] {
  const text = settings.caps ? raw.toUpperCase() : raw
  const trimmed = text.trim()
  if (!trimmed) return [PLACEHOLDER]

  if (mode === 'cues') {
    // One line in = one cue on the lens, with its position. Absorbed from
    // pl-cue-sheet; holds at both ends rather than wrapping, so a performer is
    // never thrown back to cue 1 mid-set.
    const cues = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!cues.length) return [PLACEHOLDER]
    return cues.map((c, i) => `${wrap(c, settings.lineWidth).join('\n')}\n\n${i + 1} / ${cues.length}`)
  }

  if (mode === 'cards') {
    // One idea per card — split on blank lines, never mid-sentence.
    const cards = trimmed.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean)
    return cards.length ? cards.map((c) => wrap(c, settings.lineWidth).slice(0, settings.linesPerPage).join('\n')) : [trimmed]
  }

  return chunk(toLines(trimmed), settings.linesPerPage)
}

const bridge = await waitForEvenAppBridge()

const menu = new MenuContainerProperty({
  menuItems: [
    new MenuItemProperty({ itemName: 'Restart', itemID: 1 }),
    new MenuItemProperty({ itemName: 'Next mode', itemID: 2 }),
    new MenuItemProperty({ itemName: 'Bigger', itemID: 3 }),
    new MenuItemProperty({ itemName: 'Smaller', itemID: 4 }),
    new MenuItemProperty({ itemName: 'New seed', itemID: 5 }),
  ],
})

function container(content: string) {
  const { y, h } = ZONES[settings.zone]
  return new TextContainerProperty({
    xPosition: 0, yPosition: y, width: 576, height: h,
    borderWidth: 0, borderColor: 15, paddingLength: 6,
    containerID: 1, containerName: 'main',
    content,
    isEventCapture: 1,
  })
}

// A dropped BLE bridge (e.g. after the phone was locked) leaves these calls
// awaiting a response that never comes — no error, no timeout of their own,
// so the send silently hangs forever with zero feedback. Race against a
// timeout so a lost connection surfaces as a message instead of a stuck UI.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/**
 * Draw the page with Glyph, at a real font size.
 *
 * This is the path that makes the size slider honest — see glyph-screen.ts. It
 * costs an image send per page (0.5-2 s) instead of a near-free text upgrade,
 * which is the deliberate trade the founder took for legibility.
 *
 * `size 0` means "use the firmware text path instead", so the old fast route is
 * still one setting away rather than deleted.
 */
async function paintGlyph(content: string): Promise<string> {
  const levels = await glyphLevels((g: any) => {
    const { y, h } = ZONES[settings.zone]
    g.textBox(content, { x: 10, y: y + 6, width: SCREEN_W - 20, height: h - 12 }, {
      size: settings.textPx,
      weight: 700,
      leading: settings.textPx * 1.22,
      uppercase: settings.caps,
    }, 15)
  })
  const wasStarted = started
  // zOrderIndex on EVERY container or none, IDs inside 1-12 — both learned the
  // hard way in PL DECK, where a partial z-order silently killed every tile.
  const payload = {
    containerTotalNum: 1 + TILES.length,
    textObject: [new TextContainerProperty({
      xPosition: 0, yPosition: 264, width: SCREEN_W, height: 24,
      borderWidth: 0, borderColor: 0, paddingLength: 4,
      containerID: 1, containerName: 'main', content: ' ',
      isEventCapture: 1, zOrderIndex: 1,
    })],
    imageObject: TILES.map((t, i) => new ImageContainerProperty({
      xPosition: t.x, yPosition: t.y, width: TILE_W, height: TILE_H,
      containerID: t.id, containerName: t.name, zOrderIndex: 2 + i,
    })),
    menuObject: menu,
  }
  if (started) {
    await withTimeout(bridge.rebuildPageContainer(new RebuildPageContainer(payload)), 8000)
  } else {
    await withTimeout(bridge.createStartUpPageContainer(new CreateStartUpPageContainer(payload)), 8000)
    started = true
  }
  // Settle before the first tile, or it returns sendFailed every time.
  await new Promise(r => setTimeout(r, wasStarted ? 300 : 1000))

  let result = 'success'
  for (let i = 0; i < TILES.length && result === 'success'; i++) {
    const t = TILES[i]
    let last = 'no attempt'
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        last = await withTimeout(bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: t.id, containerName: t.name, imageData: tileOf(levels, i),
        })), 8000)
        if (last === 'success') break
      } catch (e: any) { last = 'threw ' + (e?.message ?? e) }
      await new Promise(r => setTimeout(r, 400))
    }
    result = last
  }
  if (result !== 'success') console.warn('[prompter] glyph', result)
  return result
}

// Geometry (the zone) is fixed at create/rebuild time, so a zone change has to
// rebuild rather than upgrade. Content-only changes take the cheaper path.
async function paint(content: string) {
  // A real size means the Glyph path; 0 keeps the original near-free firmware
  // text. Falls back to firmware text if the image send fails, so a bad link
  // degrades to the old behaviour instead of a blank lens.
  if (settings.textPx > 0) {
    const r = await paintGlyph(content)
    if (r === 'success') return
  }
  // menuObject rides along on every rebuild — omitting it clears the menu, per
  // the SDK docs, and every page advance rebuilds.
  const payload = { containerTotalNum: 1, textObject: [container(content)], menuObject: menu }
  if (started) return void (await withTimeout(bridge.rebuildPageContainer(new RebuildPageContainer(payload)), 8000))
  await withTimeout(bridge.createStartUpPageContainer(new CreateStartUpPageContainer(payload)), 8000)
  started = true
}

async function showPage(index: number) {
  pageIndex = Math.max(0, Math.min(index, pages.length - 1))
  // Preview FIRST, then the lens. At a real font size the lens send is an image
  // transfer of 0.5-2 s, and repainting the phone after it made the size slider
  // feel like it had not worked — you move it, nothing changes, then it changes.
  // The phone is local and instant; it should never wait on Bluetooth.
  renderPreview()
  await paint(pages[pageIndex])
}

bridge.onEvenHubEvent(async (event: any) => {
  if (event.menuItemClickEvent) {
    const id = event.menuItemClickEvent.itemID
    if (id === 1) return showPage(0)
    if (id === 2) { setMode(MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length]); return send(lastText) }
    if (id === 3) return step(-1)
    if (id === 4) return step(1)
    if (id === 5) { setMode('scroll'); return send(seeds[Math.floor(Math.random() * seeds.length)].phrase) }
    return
  }
  if (event.textEvent) {
    const type = event.textEvent.eventType ?? 0
    if (type === 1) await showPage(pageIndex - 1)
    if (type === 2) await showPage(pageIndex + 1)
    return
  }
  if (event.sysEvent) {
    if ((event.sysEvent.eventType ?? 0) === 3) await bridge.shutDownPageContainer(1)
  }
})

// "Bigger" used to mean fewer, shorter lines, because the glyphs could not
// grow. With the Glyph path they can, so Bigger/Smaller now walks a real size
// ladder — 0 keeps the original firmware text, which is still the fastest page
// turn and stays reachable at the bottom of the ladder.
const SIZES = [0, 22, 28, 36, 46, 58, 72]
// Kept for the firmware path: at size 0 these are still the only levers.
const WIDTHS = [18, 24, 32, 40, 48]
const LINES = [3, 4, 5, 7, 9]

function step(dir: number) {
  const i = Math.max(0, Math.min(SIZES.indexOf(settings.textPx) + dir, SIZES.length - 1))
  settings.textPx = SIZES[i]
  if (settings.textPx === 0) {
    // Back on firmware text — restore the widest of the old levers so the page
    // is not left wrapped for a size that is no longer being drawn.
    settings.lineWidth = WIDTHS[1]
    settings.linesPerPage = LINES[1]
  }
  syncControls()
  persist()
  return send(lastText)
}

/* ---------- phone UI ---------- */

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const textarea = $<HTMLTextAreaElement>('#script')
const status = $<HTMLParagraphElement>('#status')
const preview = $<HTMLDivElement>('#preview-screen')
const previewMeta = $<HTMLParagraphElement>('#preview-meta')
const capsToggle = $<HTMLInputElement>('#caps')
const sizeInput = $<HTMLInputElement>('#size')
const widthInput = $<HTMLInputElement>('#width')
const linesInput = $<HTMLInputElement>('#lines')

function renderPreview() {
  preview.textContent = pages[pageIndex] ?? ''
  preview.dataset.zone = settings.zone

  // The preview must show the size you actually picked.
  //
  // Founder: "the prompter didn't show the real size when I change the slider".
  // #preview-screen had a hardcoded 13px font, so it rendered every size
  // identically — the one control whose whole purpose is choosing a size, and
  // the preview was blind to it. A preview that does not track the setting is
  // worse than no preview, because it is confidently wrong.
  //
  // The box is the lens at a smaller scale, so the font scales by exactly that
  // ratio: 576 px of lens shown in clientWidth px of phone.
  const scale = (preview.clientWidth || 320) / 576
  if (settings.textPx > 0) {
    preview.style.fontSize = `${(settings.textPx * scale).toFixed(2)}px`
    preview.style.lineHeight = '1.22'      // matches the leading sent to the lens
    preview.style.fontWeight = '700'       // matches weight: 700 in paintGlyph
  } else {
    // Firmware text — hand the box back to the stylesheet.
    preview.style.fontSize = ''
    preview.style.lineHeight = ''
    preview.style.fontWeight = ''
  }

  const unit = mode === 'cues' ? 'cue' : mode === 'cards' ? 'card' : 'page'
  const how = settings.textPx > 0
    ? `${settings.textPx}px drawn`
    : `${settings.lineWidth} chars · ${settings.linesPerPage} lines`
  previewMeta.textContent = pages[0] === PLACEHOLDER
    ? 'Nothing sent yet.'
    : `${unit} ${pageIndex + 1} of ${pages.length} · ${how}`
}

async function send(text: string) {
  lastText = text
  textarea.value = text
  pages = paginate(text)
  try {
    await showPage(0)
    status.textContent = pages[0] === PLACEHOLDER ? '' : 'Sent to glasses.'
  } catch {
    status.textContent = 'Lost connection to the glasses — close and reopen the app.'
  }
}

function setMode(m: Mode) {
  mode = m
  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === m)
    b.setAttribute('aria-pressed', String(b.dataset.mode === m))
  })
  persist()
}

function setZone(z: Zone) {
  settings.zone = z
  document.querySelectorAll<HTMLButtonElement>('.zone-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.zone === z)
    b.setAttribute('aria-pressed', String(b.dataset.zone === z))
  })
  persist()
}

function syncControls() {
  capsToggle.checked = settings.caps
  sizeInput.value = String(Math.max(0, SIZES.indexOf(settings.textPx)))
  widthInput.value = String(WIDTHS.indexOf(settings.lineWidth))
  linesInput.value = String(settings.linesPerPage)
}

async function persist() {
  try {
    await bridge.setLocalStorage('pl-prompter', JSON.stringify({ ...settings, mode }))
  } catch { /* storage is a convenience; never block the prompter on it */ }
}

async function restore() {
  try {
    const raw = await bridge.getLocalStorage('pl-prompter')
    if (!raw) return
    const saved = JSON.parse(raw)
    if (typeof saved.caps === 'boolean') settings.caps = saved.caps
    if (WIDTHS.includes(saved.lineWidth)) settings.lineWidth = saved.lineWidth
    if (LINES.includes(saved.linesPerPage)) settings.linesPerPage = saved.linesPerPage
    if (saved.zone in ZONES) settings.zone = saved.zone
    if (typeof saved.textPx === 'number') settings.textPx = saved.textPx
    if (MODE_CYCLE.includes(saved.mode)) mode = saved.mode
  } catch { /* corrupt or absent — defaults are already correct */ }
}

document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => { setMode(b.dataset.mode as Mode); send(lastText) }))

document.querySelectorAll<HTMLButtonElement>('.zone-btn').forEach((b) =>
  b.addEventListener('click', () => { setZone(b.dataset.zone as Zone); send(lastText) }))

capsToggle.addEventListener('change', () => { settings.caps = capsToggle.checked; persist(); send(lastText) })
sizeInput.addEventListener('input', () => {
  settings.textPx = SIZES[Number(sizeInput.value)] ?? 0
  persist(); send(lastText)
})
widthInput.addEventListener('input', () => {
  const i = Number(widthInput.value)
  settings.lineWidth = WIDTHS[i]
  settings.linesPerPage = LINES[i]
  linesInput.value = String(settings.linesPerPage)
  persist(); send(lastText)
})
linesInput.addEventListener('input', () => { settings.linesPerPage = Number(linesInput.value); persist(); send(lastText) })

$('#send').addEventListener('click', () => send(textarea.value))
$('#prev').addEventListener('click', () => showPage(pageIndex - 1))
$('#next').addEventListener('click', () => showPage(pageIndex + 1))
$('#preset-truths').addEventListener('click', () => { setMode('cards'); send(THREE_TRUTHS) })
$('#preset-seed').addEventListener('click', () => { setMode('scroll'); send(seeds[Math.floor(Math.random() * seeds.length)].phrase) })

keepScrollableAfterKeyboard()
await restore()
setMode(mode)
setZone(settings.zone)
syncControls()
await send('')

// Test-only entry point — the simulator's automation API drives glasses-side
// gestures but not phone-DOM clicks, so this exercises the same send() path.
const testParams = new URLSearchParams(location.search)
const autotest = testParams.get('autotest')
if (autotest) {
  const sz = Number(testParams.get('size'))
  if (Number.isFinite(sz) && sz >= 0) settings.textPx = sz
  const m = testParams.get('mode') as Mode | null
  if (m && MODE_CYCLE.includes(m)) setMode(m)
  await send(decodeURIComponent(autotest))
} else if (testParams.get('preset') === 'truths') {
  setMode('cards')
  await send(THREE_TRUTHS)
}
