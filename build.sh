#!/bin/sh
# Cloudflare Pages: copia in dist/ solo i file pubblici del sito
# (niente cartelle sql/ e netlify/, che restano nel repository).
set -e
rm -rf dist && mkdir -p dist
cp index.html 404.html config.js i18n.js i18n-dict.js chat.js robots.txt og.png dist/
cp -r img dist/
cat > dist/_routes.json <<'JSON'
{ "version": 1,
  "include": ["/", "/b/*", "/prodotti", "/manifesto", "/chi-siamo", "/prezzi", "/privacy", "/termini", "/cookie", "/la-mia-bottega", "/gestione", "/preferite", "/sitemap.xml", "/api/*"],
  "exclude": [] }
JSON
echo "Pronto: $(ls dist | wc -l) file in dist/"
