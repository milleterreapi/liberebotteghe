#!/bin/sh
# Cloudflare Pages: copia in dist/ solo i file pubblici del sito
# (niente cartelle sql/ e netlify/, che restano nel repository).
set -e
rm -rf dist && mkdir -p dist
cp index.html 404.html config.js i18n.js i18n-dict.js chat.js qr.js robots.txt og.png dist/
cp lib/luoghi.js dist/luoghi.js
cp -r img dist/
[ -d social ] && cp -r social dist/   # grafiche per Instagram (le prende Metricool)
cat > dist/_routes.json <<'JSON'
{ "version": 1,
  "include": ["/", "/b/*", "/artigiani/*", "/artigianato/*", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi", "/privacy", "/termini", "/cookie", "/la-mia-bottega", "/gestione", "/preferite", "/sitemap.xml", "/api/*"],
  "exclude": [] }
JSON
echo "Pronto: $(ls dist | wc -l) file in dist/"
