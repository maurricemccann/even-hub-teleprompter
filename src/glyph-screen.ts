// Glyph as a rasterizer — and in this app, as the thing that finally makes the
// text bigger.
//
// PL PROMPTER was built against a hard constraint: `TextContainerProperty` has
// no size field, and Even's own guidelines say "no sizing controls". So size
// was bought indirectly with four levers (ALL CAPS, line length, lines per
// screen, zone), and the spec recorded that a size slider "would have been a
// lie the founder would have discovered wearing the glasses".
//
// That is true of the SDK. It is not true of a framebuffer. Glyph rasterises
// text at any `size` and `weight` and ships the result as image tiles, so the
// slider can now be real — which matters here specifically, because the founder
// has a lazy eye and the original complaint was that the font was too small.
//
// THE PRICE, and it is not small: a page becomes an image send, 0.5-2 s instead
// of a near-free text upgrade. Founder ruling S276·2997: take it across all
// modes, with the size slider exposed.
//
// The three page rules that must be obeyed or every tile returns `sendFailed`
// with no useful error (learned in PL DECK, recorded in the fleet blueprint):
//   1. settle ~1000 ms after page creation, ~300 ms after a rebuild
//   2. container IDs live inside 1-12
//   3. zOrderIndex is all-or-nothing — every container or none
import { GlyphFrame, loadFontSet, type GlyphRaster } from '@gabrielevierti/glyph'

export const SCREEN_W = 576
export const SCREEN_H = 288
export const TILE_W = 288
export const TILE_H = 144
export const TILES = [
  { id: 2, name: 'tl', x: 0, y: 0 },
  { id: 3, name: 'tr', x: TILE_W, y: 0 },
  { id: 4, name: 'bl', x: 0, y: TILE_H },
  { id: 5, name: 'br', x: TILE_W, y: TILE_H },
] as const

let fontPromise: Promise<unknown> | null = null
let font: unknown = null

/** The bitmap atlas ships in this app, unlike the others: legibility IS the
 *  product here. Measured on the same screen, the atlas renders ~19% more lit
 *  pixels than Glyph's vector fallback — a heavier face, which is the right
 *  trade for a lazy eye even at ~190 KB. */
async function ensureFont() {
  if (font) return font
  if (!fontPromise) {
    fontPromise = loadFontSet('/fonts/inter.json')
      .then(f => { font = f; return f })
      .catch(e => { console.warn('[prompter] glyph font atlas unavailable', e); return null })
  }
  return fontPromise
}

export async function glyphLevels(draw: (g: GlyphRaster) => void): Promise<Uint8Array> {
  await ensureFont()
  const frame = new GlyphFrame({
    width: SCREEN_W, height: SCREEN_H, supersample: 2, surface: 'outline',
  })
  if (font) {
    try { (frame.raster as any).useFont(font, 'auto') } catch { /* vector fallback */ }
  }
  frame.draw(draw)
  const levels = frame.toLevels()
  frame.dispose()
  return levels
}

export function tileOf(levels: Uint8Array, index: number): number[] {
  const t = TILES[index]
  const out = new Array<number>(TILE_W * TILE_H)
  for (let y = 0; y < TILE_H; y++) {
    const src = (t.y + y) * SCREEN_W + t.x
    const dst = y * TILE_W
    for (let x = 0; x < TILE_W; x++) out[dst + x] = levels[src + x]
  }
  return out
}
