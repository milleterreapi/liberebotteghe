"""Reel animati per Instagram (1080x1920, 30 fps, MP4 H.264) nello stile di grafica.py.

Uso: python3 reel.py spec.json
spec.json = lista di reel: {"file": "social/reel/r01-nome.mp4", "scene": [scena, scena, ...]}
Ogni scena ha gli stessi campi di una storia di grafica.py (tema, label, title con _accento_, sub, motivo, cta).
In ogni scena gli elementi compaiono uno dopo l'altro (medaglione, etichetta, righe del titolo, testo, bottone)
salendo leggermente; tra una scena e l'altra c'è una dissolvenza. Video senza audio: la musica si aggiunge,
se si vuole, dall'app di Instagram.
Viene salvata anche la copertina (stesso nome, .jpg) = ultima scena completa.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import grafica as g

FPS = 30
SCENA = 4.6      # secondi per scena
STAGGER = 0.32   # ritardo tra un elemento e il successivo
FADE = 0.55      # durata della comparsa di un elemento
RISE = 34        # pixel di salita durante la comparsa
XFADE = 0.5      # dissolvenza tra scene


def base_story(spec, seed):
    """Sfondo, portale e logo, senza contenuti: è il punto di partenza dell'animazione."""
    t = g.TEMI[spec.get("tema", "crema")]
    img = g.background(g.W, 1920, t, seed)
    d = ImageDraw.Draw(img)
    g.frame(d, g.W, 250, 1920 - 230, t)
    g.logo(img, g.W / 2, 1920 - 230 - 132, 300, t["ink"])
    return img


def bands(full, base, gap=16, thr=14):
    """Fasce orizzontali in cui la grafica completa differisce dalla base = gli elementi da animare, in ordine."""
    diff = np.abs(full.astype(np.int16) - base.astype(np.int16)).max(axis=2) > thr
    rows = np.where(diff.any(axis=1))[0]
    out = []
    for y in rows:
        if out and y - out[-1][1] <= gap:
            out[-1][1] = y
        else:
            out.append([y, y])
    return [(max(0, a - 6), min(full.shape[0], b + 7)) for a, b in out if b - a > 3]


def ease(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def scene_frames(spec, seed):
    full = np.array(g.story(spec, seed).convert("RGB"))
    base = np.array(base_story(spec, seed).convert("RGB"))
    bs = bands(full, base)
    n = int(SCENA * FPS)
    for i in range(n):
        tt = i / FPS
        out = base.astype(np.float32).copy()
        for k, (y0, y1) in enumerate(bs):
            a = ease((tt - 0.15 - k * STAGGER) / FADE)
            if a <= 0:
                continue
            dy = int(round(RISE * (1 - a)))
            src = full[y0:y1].astype(np.float32)
            ty0, ty1 = y0 + dy, min(full.shape[0], y1 + dy)
            src = src[: ty1 - ty0]
            mask = (np.abs(src - base[ty0:ty1]).max(axis=2, keepdims=True) > 6).astype(np.float32) * a
            out[ty0:ty1] = out[ty0:ty1] * (1 - mask) + src * mask
        yield out.astype(np.uint8), full


def make_reel(r):
    path = r["file"]
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    seed = sum(map(ord, path)) % 1000
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1080x1920",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
           "-preset", "medium", "-movflags", "+faststart", path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    prev_last = None
    last_full = None
    xf = int(XFADE * FPS)
    for si, sc in enumerate(r["scene"]):
        frames = scene_frames(sc, seed + si)
        for i, (fr, full) in enumerate(frames):
            if prev_last is not None and i < xf:
                a = (i + 1) / (xf + 1)
                fr = (prev_last.astype(np.float32) * (1 - a) + fr.astype(np.float32) * a).astype(np.uint8)
            p.stdin.write(fr.tobytes())
            last_full = full
        prev_last = last_full
    # pausa finale sull'ultima scena completa
    for _ in range(int(1.2 * FPS)):
        p.stdin.write(last_full.tobytes())
    p.stdin.close()
    p.wait()
    Image.fromarray(last_full).save(os.path.splitext(path)[0] + ".jpg", quality=88)
    print("ok", path)


if __name__ == "__main__":
    for r in json.load(open(sys.argv[1])):
        make_reel(r)
