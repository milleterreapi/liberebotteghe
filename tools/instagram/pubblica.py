"""Pubblica su Instagram @liberebotteghe direttamente con l'API ufficiale, senza Metricool.

Configurazione (una volta sola, vedi tools/instagram/API.md): due variabili d'ambiente, MAI nel repository.
  IG_TOKEN    access token dell'account Instagram professionale
  IG_USER_ID  id dell'account Instagram (lo stampa `python3 pubblica.py verifica`)
  IG_HOST     opzionale: graph.instagram.com (accesso con Instagram, predefinito)
              oppure graph.facebook.com (accesso tramite Pagina Facebook)

Uso:
  python3 pubblica.py verifica
  python3 pubblica.py post     social/03-cartapesta.jpg            --testo "Didascalia..."
  python3 pubblica.py carosello social/caroselli/c01-mestieri-{1..7}.jpg --testo "..."
  python3 pubblica.py reel     social/reel/r03-materie.mp4         --testo "..."   (copertina = .jpg con lo stesso nome)
  python3 pubblica.py storia   social/storie/s23-ogliarola.jpg
  --prova  mostra cosa verrebbe pubblicato senza pubblicare.

Instagram scarica i file da un indirizzo pubblico: i percorsi `social/...` diventano link
raw.githubusercontent.com del ramo main, quindi il file deve essere già su GitHub (commit + push).
Si possono passare anche link https:// già pubblici.
"""
import argparse, json, os, sys, time, urllib.error, urllib.parse, urllib.request

VERSIONE = "v21.0"
RAW = "https://raw.githubusercontent.com/milleterreapi/liberebotteghe/main/"


def url_pubblico(percorso):
    return percorso if percorso.startswith("https://") else RAW + percorso.lstrip("./")


def chiama(metodo, endpoint, **param):
    host = os.environ.get("IG_HOST", "graph.instagram.com")
    param["access_token"] = os.environ["IG_TOKEN"]
    url = f"https://{host}/{VERSIONE}/{endpoint}"
    dati = urllib.parse.urlencode({k: v for k, v in param.items() if v is not None})
    if metodo == "GET":
        req = urllib.request.Request(url + "?" + dati)
    else:
        req = urllib.request.Request(url, data=dati.encode(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Errore Instagram ({e.code}) su {endpoint}: {e.read().decode(errors='replace')}")


def contenitore(**param):
    return chiama("POST", f"{os.environ['IG_USER_ID']}/media", **param)["id"]


def attendi(cid, max_sec=600):
    """I video vengono elaborati da Instagram: si pubblica solo quando lo stato è FINISHED."""
    inizio = time.time()
    while time.time() - inizio < max_sec:
        stato = chiama("GET", cid, fields="status_code,status").get("status_code")
        if stato == "FINISHED":
            return
        if stato in ("ERROR", "EXPIRED"):
            sys.exit(f"Instagram non è riuscito a elaborare il file (stato {stato}).")
        time.sleep(5)
    sys.exit("Elaborazione troppo lunga: riprova più tardi.")


def pubblica(cid):
    mid = chiama("POST", f"{os.environ['IG_USER_ID']}/media_publish", creation_id=cid)["id"]
    link = chiama("GET", mid, fields="permalink").get("permalink", "")
    print(f"Pubblicato: {link or mid}")


def main():
    p = argparse.ArgumentParser(description="Pubblica su Instagram con l'API ufficiale.")
    p.add_argument("tipo", choices=["verifica", "post", "carosello", "reel", "storia"])
    p.add_argument("file", nargs="*")
    p.add_argument("--testo", default="", help="didascalia (non vale per le storie)")
    p.add_argument("--testo-da", help="file di testo con la didascalia")
    p.add_argument("--copertina", help="copertina del Reel (predefinita: stesso nome .jpg)")
    p.add_argument("--prova", action="store_true", help="non pubblica, mostra solo cosa farebbe")
    a = p.parse_args()

    for v in ("IG_TOKEN",) + (() if a.tipo == "verifica" else ("IG_USER_ID",)):
        if not os.environ.get(v) and not a.prova:
            sys.exit(f"Manca la variabile d'ambiente {v}: vedi tools/instagram/API.md")

    if a.tipo == "verifica":
        print(json.dumps(chiama("GET", "me", fields="user_id,username,account_type"), indent=2))
        return

    if not a.file:
        sys.exit("Indica almeno un file.")
    testo = open(a.testo_da, encoding="utf-8").read().strip() if a.testo_da else a.testo
    urls = [url_pubblico(f) for f in a.file]
    if a.tipo == "carosello" and not 2 <= len(urls) <= 10:
        sys.exit("Un carosello ha da 2 a 10 file.")
    if a.tipo != "carosello" and len(urls) != 1:
        sys.exit("Post, Reel e storie hanno un solo file.")
    copertina = None
    if a.tipo == "reel":
        copertina = url_pubblico(a.copertina or os.path.splitext(a.file[0])[0] + ".jpg")

    if a.prova:
        print(json.dumps({"tipo": a.tipo, "file": urls, "copertina": copertina, "testo": testo},
                         indent=2, ensure_ascii=False))
        return

    video = lambda u: u.lower().endswith((".mp4", ".mov"))
    if a.tipo == "post":
        cid = contenitore(image_url=urls[0], caption=testo)
    elif a.tipo == "storia":
        campo = "video_url" if video(urls[0]) else "image_url"
        cid = contenitore(media_type="STORIES", **{campo: urls[0]})
        if video(urls[0]):
            attendi(cid)
    elif a.tipo == "reel":
        cid = contenitore(media_type="REELS", video_url=urls[0], cover_url=copertina,
                          caption=testo, share_to_feed="true")
        attendi(cid)
    else:
        figli = []
        for u in urls:
            if video(u):
                f = contenitore(media_type="VIDEO", video_url=u, is_carousel_item="true")
                attendi(f)
            else:
                f = contenitore(image_url=u, is_carousel_item="true")
            figli.append(f)
        cid = contenitore(media_type="CAROUSEL", children=",".join(figli), caption=testo)
        attendi(cid)
    pubblica(cid)


if __name__ == "__main__":
    main()
