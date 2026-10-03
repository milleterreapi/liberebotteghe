"""Generatore delle grafiche Instagram di Libere Botteghe (stile pietra leccese, cornice ad arco).

Uso: python3 grafica.py spec.json
spec.json = lista di oggetti {"file": "social/07-nome.jpg", "label": "ETICHETTA", "title": "Riga 1\nRiga 2", "sub": "Sottotitolo", "title_size": 118, "numbered": null}
Post: 1080x1350 JPEG. Storie ("format": "story", campo opzionale "cta"): 1080x1920 JPEG, nella cartella social/storie/.
I file vengono salvati come JPEG. Font usati: Caladea (titoli) e Inter (testi).
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, os

W, H = 1080, 1350
BG = (239, 228, 204)      # pietra leccese chiara
STONE = (226, 210, 176)
OCHRE = (184, 140, 74)
INK = (52, 38, 26)
TERRA = (168, 78, 44)
SOFT = (110, 90, 66)

SERIF = "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf"
SERIF_IT = "/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf"
SANS = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
SANS_SB = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
SANS_L = "/usr/share/fonts/opentype/inter/Inter-Light.otf"

def f(p, s): return ImageFont.truetype(p, s)

def background(seed):
    random.seed(seed)
    img = Image.new("RGB", (W, H), BG)
    # grana della pietra
    noise = Image.effect_noise((W, H), 18).convert("L")
    tex = Image.merge("RGB", [noise] * 3)
    img = Image.blend(img, Image.composite(Image.new("RGB", (W, H), STONE), img, noise.point(lambda v: 60 if v > 140 else 0)), 0.5)
    d = ImageDraw.Draw(img)
    for _ in range(900):
        x, y = random.randint(0, W), random.randint(0, H)
        r = random.choice([1, 1, 2])
        c = random.choice([STONE, (230, 216, 186), (244, 236, 216)])
        d.ellipse([x, y, x + r, y + r], fill=c)
    return img

def arch(d, inset=64, top=150, color=OCHRE, width=3):
    # cornice ad arco, come un portale di bottega
    l, r, b = inset, W - inset, H - inset
    rad = (r - l) // 2
    d.arc([l, top, r, top + 2 * rad], 180, 360, fill=color, width=width)
    d.line([l, top + rad, l, b], fill=color, width=width)
    d.line([r, top + rad, r, b], fill=color, width=width)
    d.line([l, b, r, b], fill=color, width=width)
    # cornice interna sottile
    i = 14
    d.arc([l + i, top + i, r - i, top + 2 * rad - i], 180, 360, fill=color, width=1)
    d.line([l + i, top + rad, l + i, b - i], fill=color, width=1)
    d.line([r - i, top + rad, r - i, b - i], fill=color, width=1)
    d.line([l + i, b - i, r - i, b - i], fill=color, width=1)

def spaced(d, xy, text, font, fill, spacing=6, anchor_center=True):
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x, y = xy
    if anchor_center: x -= total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + spacing

def centered(d, y, text, font, fill, line_gap=1.12):
    for line in text.split("\n"):
        w = d.textlength(line, font=font)
        d.text(((W - w) / 2, y), line, font=font, fill=fill)
        y += font.size * line_gap
    return y

def wrap(d, text, font, maxw):
    out = []
    for para in text.split("\n"):
        words, cur = para.split(), ""
        for w in words:
            t = (cur + " " + w).strip()
            if d.textlength(t, font=font) <= maxw: cur = t
            else: out.append(cur); cur = w
        out.append(cur)
    return "\n".join(out)

def ornament(d, y, color=TERRA):
    cx = W // 2
    d.line([cx - 90, y, cx - 18, y], fill=color, width=2)
    d.line([cx + 18, y, cx + 90, y], fill=color, width=2)
    d.polygon([(cx, y - 9), (cx + 9, y), (cx, y + 9), (cx - 9, y)], fill=color)

def card(name, label, title, sub, seed, title_size=118, numbered=None):
    img = background(seed)
    d = ImageDraw.Draw(img)
    arch(d)
    # marchio in alto, dentro l'arco
    spaced(d, (W / 2, 430), "LIBERE BOTTEGHE", f(SANS_SB, 26), INK, spacing=9)
    ornament(d, 490)
    spaced(d, (W / 2, 540), label, f(SANS_SB, 22), TERRA, spacing=6)
    y = 640
    if numbered:
        tf = f(SERIF, 64)
        nf = f(SERIF_IT, 64)
        for i, line in enumerate(numbered, 1):
            num = f"{i}"
            wn = d.textlength(num, font=nf)
            wl = d.textlength(line, font=tf)
            x = (W - (wn + 34 + wl)) / 2
            d.text((x, y), num, font=nf, fill=TERRA)
            d.text((x + wn + 34, y), line, font=tf, fill=INK)
            y += 112
        y += 10
    else:
        y = centered(d, y, title, f(SERIF, title_size), INK, line_gap=1.08) + 50
    sf = f(SANS_L, 38)
    centered(d, y, wrap(d, sub, sf, 700), sf, SOFT, line_gap=1.4)
    spaced(d, (W / 2, H - 150), "liberebotteghe.it", f(SANS, 28), INK, spacing=3)
    img.save(name, quality=95)


def pill(d, y, text, font, fg=BG, bg=TERRA, pad_x=44, pad_y=22):
    w = d.textlength(text, font=font)
    box = [(W - w) / 2 - pad_x, y, (W + w) / 2 + pad_x, y + font.size + 2 * pad_y]
    d.rounded_rectangle(box, radius=(box[3] - box[1]) / 2, fill=bg)
    d.text(((W - w) / 2, y + pad_y - font.size * 0.12), text, font=font, fill=fg)


def story(name, label, title, sub, seed, title_size=124, cta="liberebotteghe.it"):
    """Storia verticale 1080x1920. Lascia libere le fasce alta e bassa (~250px) coperte dall'interfaccia di Instagram."""
    global H
    old_h, H = H, 1920
    try:
        img = background(seed)
        d = ImageDraw.Draw(img)
        arch(d, inset=64, top=260)
        d_bottom = H - 260
        d.rectangle([0, d_bottom + 1, W, H], fill=BG)  # niente cornice nella fascia bassa
        d.line([64, d_bottom, W - 64, d_bottom], fill=OCHRE, width=3)
        spaced(d, (W / 2, 640), "LIBERE BOTTEGHE", f(SANS_SB, 30), INK, spacing=10)
        ornament(d, 710)
        spaced(d, (W / 2, 765), label, f(SANS_SB, 26), TERRA, spacing=7)
        y = centered(d, 880, title, f(SERIF, title_size), INK, line_gap=1.08) + 60
        sf = f(SANS_L, 44)
        y = centered(d, y, wrap(d, sub, sf, 760), sf, SOFT, line_gap=1.4) + 80
        if cta:
            pill(d, min(y, d_bottom - 200), cta, f(SANS_SB, 36))
        img.save(name, quality=95)
    finally:
        H = old_h


if __name__ == "__main__":
    # Ogni voce può avere "format": "story" (1080x1920) oppure essere un post (1080x1350, predefinito).
    # Le storie accettano anche "cta": testo del bottone in basso (predefinito "liberebotteghe.it", "" per toglierlo).
    import json, sys
    from PIL import Image
    for i, s in enumerate(json.load(open(sys.argv[1]))):
        os.makedirs(os.path.dirname(s["file"]) or ".", exist_ok=True)
        seed = sum(map(ord, s["file"])) % 1000
        if s.get("format") == "story":
            story(s["file"], s["label"], s.get("title", ""), s.get("sub", ""), seed,
                  title_size=s.get("title_size", 124), cta=s.get("cta", "liberebotteghe.it"))
        else:
            card(s["file"], s["label"], s.get("title", ""), s.get("sub", ""), seed,
                 title_size=s.get("title_size", 118), numbered=s.get("numbered"))
        Image.open(s["file"]).save(s["file"], quality=85, optimize=True, progressive=True)
        print("ok", s["file"])
