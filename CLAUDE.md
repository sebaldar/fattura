# CLAUDE.md

## Progetto

Web app fatturazione e-commerce **single-tenant** (fatture e note di credito). La specifica completa e vincolante è in **`docs/prompt-fatturazione-ecom.md`**: leggila prima di implementare qualsiasi funzionalità e in caso di conflitto vince la specifica.

## Regole non negoziabili

- **Denaro sempre in centesimi (integer)**. Aliquote in centesimi di punto percentuale (`2200` = 22,00%). Mai float o decimal per gli importi. Conversione in euro solo a livello di presentazione (PDF, XML, UI).
- **Documenti in stato `emessa` sono immutabili**: mai UPDATE o DELETE su testata o righe (enforcement con trigger Postgres + applicativo). Correzioni solo tramite nota di credito collegata. Non rimuovere o aggirare i trigger, nemmeno nei test.
- **Numerazione**: progressivo assegnato solo al passaggio bozza→emessa, in transazione con `SELECT ... FOR UPDATE` su `contatori`. Mai assegnare numeri alle bozze, mai rigenerare o riordinare numerazioni esistenti. Serie separate: `IT-F-` fatture, `IT-NC-` note di credito.
- **MariaDB legacy (`mysql.baldoweb.it`) è in SOLA LETTURA**: solo SELECT, mai scritture, mai DDL, mai migrazioni su quel database. Il suo schema non si tocca. Se il legacy è irraggiungibile l'app degrada a inserimento manuale, non deve mai bloccarsi.
- **Snapshot, non FK verso il legacy**: le righe documento copiano descrizione, prezzo, codice IVA, aliquota e natura al momento dell'inserimento.
- **Rete**: solo il frontend espone porte verso l'host (3004). Backend e Postgres vivono esclusivamente sulla rete Docker interna. Non aggiungere mai `ports:` ad altri servizi.
- **Secrets solo via env**: mai committare `.env`, mai hardcodare credenziali o API key. `ANTHROPIC_API_KEY` esiste solo lato backend, mai esposta al frontend.
- **TypeScript strict ovunque, zero `any`**. Zod su ogni input API.
- **PDF e XML FatturaPA** generabili solo da documenti `emessa`, sempre on-demand dai dati persistiti: mai archiviare i file generati.

## Stack (vincolante, non sostituire librerie)

Next.js App Router (frontend, PWA) · Fastify 5 (backend) · Drizzle ORM + PostgreSQL 16 · mysql2 (legacy, read-only) · argon2 + otplib (auth 2FA) · pdfmake (PDF) · xmlbuilder2 (FatturaPA 1.2.2) · sharp + Anthropic API `claude-sonnet-4-6` (estrazione dati da foto).

## Struttura

```
/frontend          Next.js (standalone build)
/backend           Fastify + Drizzle
/docs              specifiche
docker-compose.yml
.env.example       sempre aggiornato quando aggiungi una variabile
```

## Comandi

<!-- Compilare dopo lo scaffold -->
- Dev: `docker compose up`
- Migrazioni: `npm run db:migrate` (solo Drizzle, mai SQL manuale sul volume)
- Seed: `npm run db:seed`
- Test: `npm test`

## Workflow

- Migrazioni schema solo tramite Drizzle, versionate e committate.
- Ogni modifica a numerazione, calcolo totali, scorporo IVA o generazione XML richiede che i test relativi passino (inclusa la validazione XSD FatturaPA).
- Prima di dichiarare completo un task, verifica che `docker compose up` parta pulito con il solo `.env` compilato da `.env.example`.
