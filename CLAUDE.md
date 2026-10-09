# Libere Botteghe — regole di lavoro

## Pubblicazione
- Ogni push su `main` viene pubblicato subito su liberebotteghe.it (deploy automatico di Cloudflare).
- **Non fare push su `main` di propria iniziativa.** Lavora su un ramo separato (es. `prova/<argomento>`),
  fai push di quel ramo e chiedi conferma al titolare prima di portare le modifiche su `main`.
- Unica eccezione: un file che deve essere pubblico subito per Instagram (gli script prendono i file da
  `raw.githubusercontent.com/.../main/`). Anche in questo caso chiedi prima.
- Mai token, password o chiavi segrete nel repository: vanno nelle variabili d'ambiente / secrets.
