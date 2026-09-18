"""Capture the three store screenshots PL PROMPTER's STORE-LISTING.md asks for.

The simulator's glasses framebuffer is RGBA: lit pixels are (0,255,0,255), background
is (0,255,0,0) — transparent, NOT black. Converting to RGB would make every pixel pure
green and the shot unreadable, so the alpha channel is what gets composited onto black.

Usage: python scripts/capture-store-shots.py [--port 9898]
"""
import argparse, io, json, sys, time, urllib.request
from pathlib import Path

from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=9898)
ap.add_argument("--out", default="store-assets")
args = ap.parse_args()
BASE = f"http://localhost:{args.port}"
OUT = Path(__file__).resolve().parent.parent / args.out
OUT.mkdir(parents=True, exist_ok=True)


def get(path: str) -> bytes:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=20) as r:
        if r.status != 200:
            raise SystemExit(f"{path} -> HTTP {r.status}")
        return r.read()


def shot(name: str, note: str) -> dict:
    """Grab the framebuffer, composite onto black, and refuse to save an empty frame."""
    raw = get("/api/screenshot/glasses")
    img = Image.open(io.BytesIO(raw))            # keep RGBA — do not convert('RGB')
    if img.mode != "RGBA":
        raise SystemExit(f"expected RGBA framebuffer, got {img.mode}")
    lit = sum(1 for px in img.getdata() if px[3] > 0)
    # A blank frame is the failure this check exists to catch: the app not ready, or
    # input silently ignored because no event container was active.
    if lit == 0:
        raise SystemExit(f"{name}: framebuffer is entirely unlit — nothing was on the lenses")
    black = Image.new("RGBA", img.size, (0, 0, 0, 255))
    black.alpha_composite(img)
    final = black.convert("RGB")
    path = OUT / name
    final.save(path)
    pct = 100 * lit / (img.size[0] * img.size[1])
    print(f"  {name}: {img.size[0]}x{img.size[1]}, {lit} lit px ({pct:.1f}%) — {note}")
    return {"file": name, "size": list(img.size), "lit_px": lit, "note": note}


def press(action: str, settle: float = 0.6):
    body = json.dumps({"action": action}).encode()
    req = urllib.request.Request(f"{BASE}/api/input", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        r.read()
    time.sleep(settle)


if get("/api/ping") != b"pong":
    raise SystemExit("simulator not answering on /api/ping")
print(f"simulator up on {BASE}; writing to {OUT}")
time.sleep(1.0)

manifest = [shot("screenshot-1-scroll.png", "whatever mode the app opens in")]
press("down"); manifest.append(shot("screenshot-2-cues.png", "after one down-swipe"))
press("down"); manifest.append(shot("screenshot-3-cards.png", "after a second down-swipe"))

(OUT / "capture-manifest.json").write_text(json.dumps(manifest, indent=2))
print(f"\nwrote {len(manifest)} files + capture-manifest.json")
print("NOT verified here: which mode each frame actually shows — read the images before shipping them.")
