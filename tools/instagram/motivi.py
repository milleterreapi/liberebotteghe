"""Illustrazioni al tratto per le grafiche di Libere Botteghe, disegnate in codice (nessun diritto di terzi).

Ogni motivo si disegna in un riquadro quadrato e viene incollato sopra il marchio, dentro l'arco.
Uso: motivo(nome, lato) -> immagine RGBA. Nomi disponibili: vedi MOTIVI.
"""
import math
from PIL import Image, ImageDraw

OCHRE = (184, 140, 74, 255)
TERRA = (168, 78, 44, 255)
OLIVE = (112, 118, 70, 255)
INK = (52, 38, 26, 255)
SS = 4  # supersampling per linee morbide


def _canvas(size):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img), s


def _done(img, size):
    return img.resize((size, size), Image.LANCZOS)


def _leaf(d, cx, cy, length, width, angle, fill):
    pts = []
    for t in range(0, 181, 6):
        a = math.radians(t)
        x = (t / 180) * length
        y = math.sin(a) * width / 2
        pts.append((x, y))
    pts += [(x, -y) for x, y in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts], fill=fill)


def ulivo(size):
    img, d, s = _canvas(size)
    lw = int(s * 0.012)
    pts = [(s * 0.12 + i * s * 0.0076, s * 0.78 - math.sin(i / 100 * math.pi * 0.9) * s * 0.42 - i * s * 0.002) for i in range(101)]
    d.line(pts, fill=INK, width=lw, joint="curve")
    for k, i in enumerate(range(8, 98, 9)):
        x, y = pts[i]
        side = 1 if k % 2 else -1
        ang = math.radians(-60 + i * 0.6) + side * 0.75
        _leaf(d, x, y, s * 0.2, s * 0.06, ang, OLIVE)
    for (i, dx, dy) in [(40, 0.03, 0.08), (66, -0.02, 0.09)]:
        x, y = pts[i]
        r = s * 0.035
        cx, cy = x + dx * s, y + dy * s
        d.line([(x, y), (cx, cy - r)], fill=INK, width=lw // 2)
        d.ellipse([cx - r * 0.85, cy - r, cx + r * 0.85, cy + r], fill=(70, 72, 46, 255))
    return _done(img, size)


def vaso(size):
    img, d, s = _canvas(size)
    lw = int(s * 0.014)
    prof = []
    for i in range(101):
        t = i / 100
        y = s * (0.12 + 0.76 * t)
        w = 0.09 + 0.05 * math.sin(t * math.pi * 1.0) ** 6 if t < 0.18 else 0.08 + 0.24 * math.sin((t - 0.12) / 0.88 * math.pi) ** 0.9
        prof.append((w * s, y))
    left = [(s / 2 - w, y) for w, y in prof]
    right = [(s / 2 + w, y) for w, y in reversed(prof)]
    d.polygon(left + right, fill=(226, 196, 150, 255))
    d.line(left + right + [left[0]], fill=TERRA, width=lw)
    for t in (0.42, 0.5, 0.58):
        i = int(t * 100)
        w, y = prof[i]
        d.line([(s / 2 - w + lw, y), (s / 2 + w - lw, y)], fill=TERRA, width=lw // 2)
    w, y = prof[50]
    for k in range(-3, 4):
        x = s / 2 + k * w * 0.26
        d.polygon([(x, y - s * 0.03), (x + s * 0.018, y), (x, y + s * 0.03), (x - s * 0.018, y)], fill=TERRA)
    # manici
    for sgn in (-1, 1):
        x0 = s / 2 + sgn * prof[16][0]
        d.arc([min(x0, x0 + sgn * s * 0.14), s * 0.2, max(x0, x0 + sgn * s * 0.14), s * 0.42],
              -90 if sgn > 0 else 90, 90 if sgn > 0 else 270, fill=TERRA, width=lw)
    return _done(img, size)


def tamburello(size):
    img, d, s = _canvas(size)
    c, R = s / 2, s * 0.36
    lw = int(s * 0.014)
    d.ellipse([c - R, c - R, c + R, c + R], fill=(236, 220, 188, 255), outline=INK, width=lw)
    d.ellipse([c - R * 0.86, c - R * 0.86, c + R * 0.86, c + R * 0.86], outline=OCHRE, width=lw // 2)
    for k in range(6):
        a = math.radians(k * 60 + 30)
        x, y = c + math.cos(a) * R, c + math.sin(a) * R
        r = s * 0.045
        d.ellipse([x - r, y - r, x + r, y + r], fill=OCHRE, outline=INK, width=lw // 2)
    # nastri colorati
    for k, col in enumerate([TERRA, OLIVE, OCHRE]):
        x = c - s * 0.05 + k * s * 0.05
        pts = [(x + math.sin(t / 8) * s * 0.02, c + R + t * s * 0.004) for t in range(0, 30)]
        d.line([(x, c + R * 0.95)] + pts, fill=col, width=lw)
    return _done(img, size)


def rosone(size):
    img, d, s = _canvas(size)
    c = s / 2
    lw = int(s * 0.012)
    for r, col in [(0.42, OCHRE), (0.34, OCHRE)]:
        d.ellipse([c - r * s, c - r * s, c + r * s, c + r * s], outline=col, width=lw)
    for k in range(12):
        a = math.radians(k * 30)
        _leaf(d, c + math.cos(a) * s * 0.07, c + math.sin(a) * s * 0.07, s * 0.26, s * 0.085, a, (214, 178, 120, 255))
        x, y = c + math.cos(a) * s * 0.38, c + math.sin(a) * s * 0.38
        d.ellipse([x - s * 0.014, y - s * 0.014, x + s * 0.014, y + s * 0.014], fill=TERRA)
    d.ellipse([c - s * 0.07, c - s * 0.07, c + s * 0.07, c + s * 0.07], fill=TERRA)
    return _done(img, size)


def telaio(size):
    img, d, s = _canvas(size)
    m, n = s * 0.18, 9
    step = (s - 2 * m) / n
    lw = int(s * 0.03)
    for i in range(n + 1):  # ordito
        x = m + i * step
        d.line([(x, m - s * 0.06), (x, s - m + s * 0.06)], fill=OCHRE, width=lw // 3)
    for j in range(n):  # trama a fasce colorate
        y = m + (j + 0.5) * step
        col = [TERRA, OCHRE, OLIVE][j % 3]
        for i in range(n):
            if (i + j) % 2 == 0:
                x = m + i * step
                d.rounded_rectangle([x - step * 0.05, y - step * 0.32, x + step * 1.05, y + step * 0.32], radius=step * 0.2, fill=col)
    d.line([(m - s * 0.08, m - s * 0.06), (s - m + s * 0.08, m - s * 0.06)], fill=INK, width=lw // 2)
    d.line([(m - s * 0.08, s - m + s * 0.06), (s - m + s * 0.08, s - m + s * 0.06)], fill=INK, width=lw // 2)
    return _done(img, size)


def cesto(size):
    img, d, s = _canvas(size)
    lw = int(s * 0.014)
    top, bot = s * 0.42, s * 0.8
    d.arc([s * 0.24, s * 0.14, s * 0.76, s * 0.7], 180, 360, fill=INK, width=lw * 2)  # manico
    body = [(s * 0.18, top), (s * 0.82, top), (s * 0.7, bot), (s * 0.3, bot)]
    d.polygon(body, fill=(214, 178, 120, 255))
    rows = 6
    for r in range(rows):
        y = top + (r + 0.5) * (bot - top) / rows
        f = (y - top) / (bot - top)
        x0, x1 = s * (0.18 + 0.12 * f), s * (0.82 - 0.12 * f)
        k = 0
        x = x0
        while x < x1:
            w = s * 0.07
            if (k + r) % 2 == 0:
                d.rounded_rectangle([x, y - s * 0.022, min(x + w, x1), y + s * 0.022], radius=s * 0.02, fill=OCHRE)
            x += w
            k += 1
    d.polygon(body, outline=INK, width=lw)
    d.line([(s * 0.16, top), (s * 0.84, top)], fill=INK, width=lw * 2)
    return _done(img, size)


def goccia(size):
    """Goccia d'olio con fogliolina."""
    img, d, s = _canvas(size)
    c = s / 2
    pts = []
    for t in range(0, 361, 4):
        a = math.radians(t)
        r = s * 0.26
        x = c + r * math.sin(a) * (1 - 0.0)
        y = c + s * 0.08 - r * math.cos(a)
        if math.cos(a) > 0:  # parte alta appuntita
            x = c + (x - c) * (1 - math.cos(a)) ** 0.9
            y = c + s * 0.08 - r * 1.6 * math.cos(a)
        pts.append((x, y))
    d.polygon(pts, fill=(196, 168, 62, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=int(s * 0.012))
    d.ellipse([c - s * 0.12, c + s * 0.02, c - s * 0.05, c + s * 0.14], fill=(236, 220, 140, 255))
    _leaf(d, c + s * 0.06, c - s * 0.36, s * 0.2, s * 0.06, math.radians(-25), OLIVE)
    return _done(img, size)


def ago(size):
    """Ago e filo per ricamo e merletto."""
    img, d, s = _canvas(size)
    lw = int(s * 0.016)
    x0, y0, x1, y1 = s * 0.22, s * 0.8, s * 0.8, s * 0.2
    d.line([(x0, y0), (x1, y1)], fill=INK, width=lw)
    d.ellipse([x1 - s * 0.04, y1 - s * 0.04, x1 + s * 0.02, y1 + s * 0.02], outline=INK, width=lw // 2)
    pts = [(x1, y1)]
    for i in range(1, 160):
        t = i / 160
        pts.append((x1 - t * s * 0.55 + math.sin(t * 9) * s * 0.12, y1 + t * s * 0.62 + math.cos(t * 7) * s * 0.06))
    d.line(pts, fill=TERRA, width=lw // 1, joint="curve")
    for k in range(5):  # punti croce
        cx, cy = s * (0.2 + k * 0.08), s * 0.9
        r = s * 0.022
        d.line([(cx - r, cy - r), (cx + r, cy + r)], fill=OCHRE, width=lw // 2)
        d.line([(cx - r, cy + r), (cx + r, cy - r)], fill=OCHRE, width=lw // 2)
    return _done(img, size)


def bottega(size):
    """Porta di bottega ad arco con insegna e piccola vetrina."""
    img, d, s = _canvas(size)
    lw = int(s * 0.014)
    l, r, t, b = s * 0.24, s * 0.76, s * 0.18, s * 0.86
    rad = (r - l) / 2
    d.pieslice([l, t, r, t + 2 * rad], 180, 360, fill=(226, 206, 168, 255))
    d.rectangle([l, t + rad, r, b], fill=(226, 206, 168, 255))
    d.arc([l, t, r, t + 2 * rad], 180, 360, fill=INK, width=lw)
    d.line([(l, t + rad), (l, b)], fill=INK, width=lw)
    d.line([(r, t + rad), (r, b)], fill=INK, width=lw)
    d.line([(s * 0.12, b), (s * 0.88, b)], fill=INK, width=lw)
    d.line([(s / 2, t + rad * 0.55), (s / 2, b)], fill=OCHRE, width=lw // 2)
    for sgn in (-1, 1):
        d.ellipse([s / 2 + sgn * s * 0.05 - s * 0.012, s * 0.6, s / 2 + sgn * s * 0.05 + s * 0.012, s * 0.624], fill=TERRA)
    for k in range(5):  # chiave di volta e conci
        a = math.radians(180 + k * 45)
        x, y = s / 2 + math.cos(a) * rad * 1.08, t + rad + math.sin(a) * rad * 1.08
        d.ellipse([x - s * 0.016, y - s * 0.016, x + s * 0.016, y + s * 0.016], fill=TERRA)
    return _done(img, size)


def statuina(size):
    """Pastore del presepe in cartapesta, stilizzato."""
    img, d, s = _canvas(size)
    lw = int(s * 0.013)
    c = s / 2
    d.polygon([(c - s * 0.16, s * 0.86), (c + s * 0.16, s * 0.86), (c + s * 0.09, s * 0.36), (c - s * 0.09, s * 0.36)], fill=(196, 120, 80, 255), outline=INK)
    d.polygon([(c - s * 0.11, s * 0.58), (c + s * 0.12, s * 0.5), (c + s * 0.13, s * 0.56), (c - s * 0.1, s * 0.64)], fill=(232, 214, 176, 255))
    d.ellipse([c - s * 0.075, s * 0.2, c + s * 0.075, s * 0.35], fill=(232, 200, 160, 255), outline=INK, width=lw)
    d.chord([c - s * 0.09, s * 0.17, c + s * 0.09, s * 0.33], 180, 360, fill=OLIVE)
    d.line([(c + s * 0.2, s * 0.14), (c + s * 0.2, s * 0.88)], fill=INK, width=lw * 2)  # bastone
    d.arc([c + s * 0.14, s * 0.08, c + s * 0.26, s * 0.2], 180, 360, fill=INK, width=lw * 2)
    d.rectangle([c - s * 0.2, s * 0.86, c + s * 0.24, s * 0.9], fill=OCHRE)
    return _done(img, size)


def giunco(size):
    """Steli di giunco di palude con pannocchie, legati in un fascio."""
    img, d, s = _canvas(size)
    lw = int(s * 0.012)
    base = (s * 0.5, s * 0.86)
    for k in range(-4, 5):
        tx = s * 0.5 + k * s * 0.075
        ty = s * (0.16 + abs(k) * 0.035)
        mx = (base[0] + tx) / 2 + k * s * 0.02
        pts = []
        for i in range(41):
            t = i / 40
            x = (1 - t) ** 2 * base[0] + 2 * (1 - t) * t * mx + t ** 2 * tx
            y = (1 - t) ** 2 * base[1] + 2 * (1 - t) * t * s * 0.55 + t ** 2 * ty
            pts.append((x, y))
        d.line(pts, fill=OLIVE if k % 2 else INK, width=lw, joint="curve")
        if k % 2 == 0:
            x, y = pts[-6]
            d.ellipse([x - s * 0.02, y - s * 0.06, x + s * 0.02, y + s * 0.03], fill=(150, 98, 52, 255))
    d.rounded_rectangle([s * 0.43, s * 0.7, s * 0.57, s * 0.76], radius=s * 0.02, fill=TERRA)
    d.line([(s * 0.3, s * 0.88), (s * 0.7, s * 0.88)], fill=OCHRE, width=lw * 2)
    return _done(img, size)


def scalpello(size):
    """Blocco di pietra leccese con scalpello e mazzuolo."""
    img, d, s = _canvas(size)
    lw = int(s * 0.013)
    stone = (226, 196, 138, 255)
    front = [(s * 0.18, s * 0.5), (s * 0.62, s * 0.5), (s * 0.62, s * 0.84), (s * 0.18, s * 0.84)]
    top = [(s * 0.18, s * 0.5), (s * 0.3, s * 0.4), (s * 0.74, s * 0.4), (s * 0.62, s * 0.5)]
    side = [(s * 0.62, s * 0.5), (s * 0.74, s * 0.4), (s * 0.74, s * 0.74), (s * 0.62, s * 0.84)]
    d.polygon(top, fill=(240, 218, 170, 255), outline=INK)
    d.polygon(side, fill=(200, 164, 104, 255), outline=INK)
    d.polygon(front, fill=stone, outline=INK)
    for poly in (top, side, front):
        d.line(poly + [poly[0]], fill=INK, width=lw)
    c = (s * 0.4, s * 0.67)  # piccolo fiore scolpito
    for k in range(6):
        a = math.radians(k * 60)
        _leaf(d, c[0], c[1], s * 0.09, s * 0.045, a, OCHRE)
    d.ellipse([c[0] - s * 0.022, c[1] - s * 0.022, c[0] + s * 0.022, c[1] + s * 0.022], fill=TERRA)
    d.line([(s * 0.5, s * 0.36), (s * 0.7, s * 0.12)], fill=INK, width=lw * 2)  # scalpello
    d.polygon([(s * 0.49, s * 0.37), (s * 0.53, s * 0.33), (s * 0.5, s * 0.4)], fill=INK)
    d.line([(s * 0.76, s * 0.3), (s * 0.86, s * 0.12)], fill=(150, 98, 52, 255), width=lw * 2)  # mazzuolo
    d.rounded_rectangle([s * 0.78, s * 0.06, s * 0.94, s * 0.16], radius=s * 0.02, fill=TERRA, outline=INK, width=lw)
    return _done(img, size)


def pasticciotto(size):
    """Pasticciotto leccese: ovale di frolla dorata, con la crema che si intravede."""
    img, d, s = _canvas(size)
    lw = int(s * 0.013)
    d.ellipse([s * 0.14, s * 0.6, s * 0.86, s * 0.84], fill=(214, 178, 120, 255), outline=INK, width=lw)  # piattino
    d.ellipse([s * 0.22, s * 0.32, s * 0.78, s * 0.72], fill=(196, 128, 54, 255), outline=INK, width=lw)
    d.ellipse([s * 0.27, s * 0.35, s * 0.73, s * 0.62], fill=(222, 158, 74, 255))
    d.ellipse([s * 0.33, s * 0.38, s * 0.55, s * 0.47], fill=(238, 190, 110, 255))  # lucido
    d.chord([s * 0.5, s * 0.47, s * 0.74, s * 0.67], 0, 180, fill=(246, 214, 96, 255), outline=INK, width=lw)  # crema
    for x, y in [(0.36, 0.2), (0.5, 0.14), (0.64, 0.2)]:  # vapore: ancora tiepido
        pts = [(s * x + math.sin(i / 6) * s * 0.02, s * (y + 0.1) - i * s * 0.004) for i in range(25)]
        d.line(pts, fill=OCHRE, width=lw, joint="curve")
    return _done(img, size)


MOTIVI = {
    "ulivo": ulivo, "vaso": vaso, "tamburello": tamburello, "rosone": rosone, "telaio": telaio,
    "cesto": cesto, "goccia": goccia, "ago": ago, "bottega": bottega, "statuina": statuina,
    "giunco": giunco, "scalpello": scalpello, "pasticciotto": pasticciotto,
}


def motivo(nome, lato):
    return MOTIVI[nome](lato)
