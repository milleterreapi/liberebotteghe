"""Generatore delle grafiche Instagram di Libere Botteghe (stile 2: logo vero, palette del sito, medaglione illustrato).

Uso: python3 grafica.py spec.json
spec.json = lista di oggetti:
  {"file": "social/07-nome.jpg",          # post 1080x1350 (predefinito)
   "format": "story",                     # opzionale: storia 1080x1920 (file in social/storie/)
   "tema": "crema",                       # crema | terracotta | oliva | notte (sfondo e colori)
   "label": "ETICHETTA",
   "title": "Riga 1\\nRiga _accento_",     # le parole tra _trattini bassi_ vanno in corsivo colorato
   "sub": "Sottotitolo di una frase.",
   "motivo": "ulivo",                     # illustrazione (vedi motivi.py)
   "cta": "Scrivici in DM",               # solo storie: bottone ("" per toglierlo)
   "numbered": ["Passo 1", "Passo 2"],    # solo post: elenco numerato al posto del titolo
   "title_size": 112}
Font: Caladea (vicino al Gloock del sito) e Inter. Logo: img/logo-orizz.png.
"""
import os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from motivi import motivo as _motivo

ROOT = os.path.dirname(os.path.dirname(HERE))
LOGO = os.path.join(ROOT, "img", "logo-orizz.png")

SERIF_B = "/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf"
SERIF_BI = "/usr/share/fonts/truetype/crosextra/Caladea-BoldItalic.ttf"
SANS = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
SANS_SB = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

# Palette del sito (index.html): inchiostro #2f2618, pietra #e2c48a, corallo #c8643f, foglia #6b7f3a
TEMI = {
    "crema":      dict(bg=(245, 234, 214), bg2=(236, 220, 190), ink=(47, 38, 24), soft=(104, 86, 60), accent=(184, 82, 46), line=(196, 156, 92), medal=(250, 243, 228), pill=(184, 82, 46), pill_ink=(250, 243, 228)),
    "terracotta": dict(bg=(176, 86, 52), bg2=(158, 72, 42), ink=(250, 240, 222), soft=(244, 216, 190), accent=(242, 193, 78), line=(232, 176, 128), medal=(245, 234, 214), pill=(250, 240, 222), pill_ink=(158, 72, 42)),
    "oliva":      dict(bg=(92, 104, 52), bg2=(78, 90, 42), ink=(250, 243, 226), soft=(222, 226, 196), accent=(242, 193, 78), line=(196, 196, 140), medal=(245, 234, 214), pill=(250, 243, 226), pill_ink=(78, 90, 42)),
    "notte":      dict(bg=(47, 38, 24), bg2=(36, 29, 18), ink=(245, 234, 214), soft=(205, 184, 148), accent=(226, 196, 138), line=(150, 120, 74), medal=(245, 234, 214), pill=(226, 196, 138), pill_ink=(47, 38, 24)),
}

W = 1080


def f(p, s):
    return ImageFont.truetype(p, s)


def background(w, h, t, seed):
    """Sfondo a sfumatura morbida con grana di pietra leggera."""
    random.seed(seed)
    grad = Image.linear_gradient("L").resize((w, h)).point(lambda v: int(255 * (v / 255) ** 1.6))
    img = Image.composite(Image.new("RGB", (w, h), t["bg2"]), Image.new("RGB", (w, h), t["bg"]), grad)
    noise = Image.effect_noise((w, h), 22).convert("L").point(lambda v: 26 if v > 150 else 0)
    light = tuple(min(255, c + 14) for c in t["bg"])
    return Image.composite(Image.new("RGB", (w, h), light), img, noise)


def frame(d, w, top, bottom, t, inset=58):
    """Portale ad arco con doppia linea, chiave di volta e capitelli."""
    l, r = inset, w - inset
    rad = (r - l) // 2
    for i, wd in ((0, 4), (16, 2)):
        d.arc([l + i, top + i, r - i, top + 2 * rad - i], 180, 360, fill=t["line"], width=wd)
        d.line([l + i, top + rad, l + i, bottom - i], fill=t["line"], width=wd)
        d.line([r - i, top + rad, r - i, bottom - i], fill=t["line"], width=wd)
        d.line([l + i, bottom - i, r - i, bottom - i], fill=t["line"], width=wd)
    cx = w / 2
    key = [(cx - 22, top - 8), (cx + 22, top - 8), (cx + 15, top + 34), (cx - 15, top + 34)]
    d.polygon(key, fill=t["bg"])
    d.polygon(key, outline=t["line"], width=3)
    for x in (l + 8, r - 8):
        d.rectangle([x - 16, top + rad - 6, x + 16, top + rad + 6], fill=t["line"])


def medallion(img, cx, cy, r, t, nome):
    halo = Image.new("L", img.size, 0)
    ImageDraw.Draw(halo).ellipse([cx - r - 14, cy - r - 4, cx + r + 14, cy + r + 24], fill=80)
    halo = halo.filter(ImageFilter.GaussianBlur(18))
    img.paste(Image.new("RGB", img.size, tuple(max(0, c - 40) for c in t["bg2"])), (0, 0), halo)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=t["medal"], outline=t["line"], width=3)
    d.ellipse([cx - r + 12, cy - r + 12, cx + r - 12, cy + r - 12], outline=t["line"], width=1)
    if nome:
        s = int(r * 1.35)
        m = _motivo(nome, s)
        img.paste(m, (int(cx - s / 2), int(cy - s / 2)), m)


def spaced(d, cx, y, text, font, fill, spacing=6):
    widths = [d.textlength(ch, font=font) for ch in text]
    x = cx - (sum(widths) + spacing * (len(text) - 1)) / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + spacing


def rich_line(d, cx, y, line, size, t):
    """Riga del titolo: le parti tra _trattini bassi_ in corsivo con colore d'accento."""
    segs = [(p, i % 2 == 1) for i, p in enumerate(line.split("_")) if p]
    fonts = {False: f(SERIF_B, size), True: f(SERIF_BI, size)}
    x = cx - sum(d.textlength(s, font=fonts[it]) for s, it in segs) / 2
    for s, it in segs:
        d.text((x, y), s, font=fonts[it], fill=t["accent"] if it else t["ink"])
        x += d.textlength(s, font=fonts[it])


def title_block(d, cx, y, title, size, t, gap=1.06):
    for line in title.split("\n"):
        rich_line(d, cx, y, line, size, t)
        y += size * gap
    return y


def wrap(d, text, font, maxw):
    out = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split():
            tt = (cur + " " + w).strip()
            if d.textlength(tt, font=font) <= maxw:
                cur = tt
            else:
                out.append(cur)
                cur = w
        out.append(cur)
    return [l for l in out if l]


def centered(d, cx, y, lines, font, fill, gap=1.4):
    for line in lines:
        d.text((cx - d.textlength(line, font=font) / 2, y), line, font=font, fill=fill)
        y += font.size * gap
    return y


def pill(d, cx, y, text, font, t):
    w = d.textlength(text, font=font)
    h = font.size + 44
    d.rounded_rectangle([cx - w / 2 - 46, y, cx + w / 2 + 46, y + h], radius=h / 2, fill=t["pill"])
    d.text((cx - w / 2, y + 22 - font.size * 0.1), text, font=font, fill=t["pill_ink"])


def logo(img, cx, y, width, color):
    lg = Image.open(LOGO).convert("RGBA")
    lg = lg.resize((width, int(lg.height * width / lg.width)), Image.LANCZOS)
    solid = Image.new("RGBA", lg.size, color + (255,))
    solid.putalpha(lg.getchannel("A"))
    img.paste(solid, (int(cx - width / 2), int(y)), solid)


def ornament(d, cx, y, t):
    d.line([cx - 70, y, cx - 14, y], fill=t["line"], width=2)
    d.line([cx + 14, y, cx + 70, y], fill=t["line"], width=2)
    d.polygon([(cx, y - 7), (cx + 7, y), (cx, y + 7), (cx - 7, y)], fill=t["accent"])


def story(spec, seed):
    H = 1920
    t = TEMI[spec.get("tema", "crema")]
    img = background(W, H, t, seed)
    d = ImageDraw.Draw(img)
    top, bottom = 250, H - 230
    frame(d, W, top, bottom, t)
    medallion(img, W / 2, 570, 190, t, spec.get("motivo"))
    d = ImageDraw.Draw(img)
    spaced(d, W / 2, 810, spec.get("label", ""), f(SANS_SB, 27), t["accent"], spacing=7)
    ornament(d, W / 2, 868, t)
    y = title_block(d, W / 2, 912, spec.get("title", ""), spec.get("title_size", 118), t) + 34
    sf = f(SANS, 40)
    y = centered(d, W / 2, y, wrap(d, spec.get("sub", ""), sf, 780), sf, t["soft"]) + 50
    cta = spec.get("cta", "liberebotteghe.it")
    if cta:
        pill(d, W / 2, min(y, bottom - 240), cta, f(SANS_SB, 36), t)
    logo(img, W / 2, bottom - 132, 300, t["ink"])
    return img


def card(spec, seed):
    H = 1350
    t = TEMI[spec.get("tema", "crema")]
    img = background(W, H, t, seed)
    d = ImageDraw.Draw(img)
    top, bottom = 120, H - 70
    frame(d, W, top, bottom, t)
    medallion(img, W / 2, 335, 140, t, spec.get("motivo"))
    d = ImageDraw.Draw(img)
    spaced(d, W / 2, 510, spec.get("label", ""), f(SANS_SB, 23), t["accent"], spacing=6)
    ornament(d, W / 2, 558, t)
    y = 598
    if spec.get("numbered"):
        tf, nf = f(SERIF_B, 62), f(SERIF_BI, 62)
        for i, line in enumerate(spec["numbered"], 1):
            num = str(i)
            wn, wl = d.textlength(num, font=nf), d.textlength(line, font=tf)
            x = (W - (wn + 30 + wl)) / 2
            d.text((x, y), num, font=nf, fill=t["accent"])
            d.text((x + wn + 30, y), line, font=tf, fill=t["ink"])
            y += 92
        y += 12
    else:
        y = title_block(d, W / 2, y, spec.get("title", ""), spec.get("title_size", 104), t) + 26
    sf = f(SANS, 34)
    centered(d, W / 2, y, wrap(d, spec.get("sub", ""), sf, 740), sf, t["soft"])
    logo(img, W / 2, bottom - 116, 250, t["ink"])
    return img


if __name__ == "__main__":
    import json
    for s in json.load(open(sys.argv[1])):
        os.makedirs(os.path.dirname(s["file"]) or ".", exist_ok=True)
        seed = sum(map(ord, s["file"])) % 1000
        img = story(s, seed) if s.get("format") == "story" else card(s, seed)
        img.save(s["file"], quality=86, optimize=True, progressive=True)
        print("ok", s["file"])
