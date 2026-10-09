# Pubblicare su Instagram senza Metricool

Lo script `pubblica.py` usa l'API ufficiale di Instagram (Instagram API con accesso Instagram).
Non serve una Pagina Facebook: basta un account Instagram **professionale** (Business o Creator).

## Configurazione (una volta sola)

1. **Account professionale.** App Instagram → Impostazioni → Tipo di account e strumenti → passa ad account professionale (se non lo è già).
2. **Account sviluppatore Meta.** Vai su <https://developers.facebook.com>, accedi e registrati come sviluppatore (gratis).
3. **Crea un'app.** "Le mie app" → "Crea app" → caso d'uso **"Gestisci messaggi e contenuti su Instagram"** → tipo *Business*. Nome a piacere, per esempio "Libere Botteghe pubblicazione".
4. **Collega l'account.** Nell'app: *Instagram* → *Configurazione API con accesso Instagram* → *Genera token di accesso* → *Aggiungi account* e accedi con @liberebotteghe. Concedi i permessi `instagram_business_basic` e `instagram_business_content_publish`.
5. **Copia il token** che compare (dura 60 giorni, vedi sotto come rinnovarlo).
6. **App in modalità sviluppo:** va bene così. Finché la usi solo tu sul tuo account non serve la verifica di Meta (App Review).

## Uso

Imposta il token solo nel terminale o nei *secrets*, **mai in un file del repository**:

```bash
export IG_TOKEN="il-token-copiato"
python3 tools/instagram/pubblica.py verifica      # stampa user_id e username
export IG_USER_ID="il-user_id-stampato"
```

Poi:

```bash
# Prima controlla senza pubblicare
python3 tools/instagram/pubblica.py post social/03-cartapesta.jpg --testo "La cartapesta leccese..." --prova

python3 tools/instagram/pubblica.py post      social/03-cartapesta.jpg --testo "..."
python3 tools/instagram/pubblica.py carosello social/caroselli/c01-mestieri-{1..7}.jpg --testo "..."
python3 tools/instagram/pubblica.py reel      social/reel/r03-materie.mp4 --testo "..."
python3 tools/instagram/pubblica.py storia    social/storie/s23-ogliarola.jpg
```

Per didascalie lunghe: `--testo-da didascalia.txt`.

## Da sapere

- **I file devono essere già su GitHub** (ramo `main`): Instagram li scarica da
  `raw.githubusercontent.com/milleterreapi/liberebotteghe/main/...`. Prima commit e push, poi pubblica.
- **Immagini:** JPEG. **Reel:** MP4 H.264, verticale 9:16, da 3 secondi a 15 minuti (i file di `reel.py` vanno bene).
- **Storie:** solo immagine o video, niente sticker, link o sondaggi (come con Metricool).
- **La pubblicazione è immediata:** l'API non programma. Per pubblicare a un orario preciso serve un'automazione
  che lanci lo script a quell'ora (per esempio un workflow GitHub Actions con il token nei *secrets*).
- **Limite:** al massimo circa 100 pubblicazioni via API ogni 24 ore per account.
- **Rinnovo token:** il token dura 60 giorni. Si rinnova (prima che scada, e almeno 24 ore dopo l'emissione) con
  `curl "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=$IG_TOKEN"`.
