# Fatturazione e-commerce

Web app single-tenant per la gestione di fatture e note di credito di un e-commerce italiano, con generazione PDF e XML FatturaPA, integrazione in sola lettura con il gestionale legacy (MariaDB) ed estrazione dati cliente da foto via Anthropic API.

La specifica completa e vincolante è in [`docs/prompt-fatturazione-ecom.md`](docs/prompt-fatturazione-ecom.md).

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript strict, Tailwind, PWA (manifest + service worker per l'app shell)
- **Backend**: Fastify 5, TypeScript strict, Drizzle ORM + PostgreSQL 16, Zod su ogni input
- **Legacy**: `mysql2` verso MariaDB esistente, **sola lettura**
- **PDF**: `pdfmake` · **FatturaPA XML**: `xmlbuilder2` (schema 1.2.2)
- **Auth**: argon2id + TOTP a due fattori (`otplib`), JWT access/refresh in cookie `httpOnly`
- **AI**: Anthropic API (`claude-sonnet-4-6`) per l'estrazione dati cliente da foto

## Setup

```bash
cp .env.example .env
# compila i valori reali in .env (vedi tabella sotto)
docker compose up
```

Il frontend è raggiungibile su `http://localhost:3004`. Backend e Postgres vivono solo sulla rete Docker interna, nessuna porta è esposta verso l'host.

Al primo avvio le migrazioni Drizzle vengono applicate automaticamente all'avvio del backend. Il seed dell'utente amministratore **non** è automatico:

```bash
docker compose exec backend node dist/db/seed.js
```

Crea (se non esiste già) l'utente con le credenziali `ADMIN_EMAIL`/`ADMIN_PASSWORD` e, se assente, la riga singleton dell'emittente con dati segnaposto (modificabili poi da **Impostazioni** nell'app). Il primo login richiede il setup del secondo fattore (QR TOTP).

## Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credenziali del Postgres applicativo (rete interna) |
| `DATABASE_URL` | Connection string Postgres usata dal backend |
| `LEGACY_DB_HOST` / `PORT` / `USER` / `PASSWORD` / `DATABASE` | Connessione al MariaDB legacy, **sola lettura** |
| `ANTHROPIC_API_KEY` | Chiave API Anthropic, solo lato backend, mai esposta al frontend |
| `JWT_SECRET` | Segreto per firma JWT (access/refresh/pending), minimo 32 caratteri casuali |
| `TOTP_ENC_KEY` | Chiave per cifratura AES-256-GCM dei secret TOTP at rest, minimo 32 caratteri casuali |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenziali usate dallo script di seed per creare l'utente amministratore |
| `BACKEND_INTERNAL_URL` | URL interno del backend usato dal proxy `/api/*` del frontend (di norma non va cambiato) |
| `NEXT_PUBLIC_APP_URL` | URL pubblico dell'app dietro il reverse proxy |

Se il MariaDB legacy è irraggiungibile o le credenziali non sono corrette, le funzionalità che ne dipendono (lookup EAN, elenco aliquote) degradano a inserimento manuale con risposta `503 {degraded:true}`: l'app non si blocca mai.

## Creazione utenti

Non esiste registrazione pubblica. Gli utenti si creano solo via script CLI: rieseguire il seed con `ADMIN_EMAIL`/`ADMIN_PASSWORD` diversi (in `.env` o come variabili d'ambiente inline) crea un ulteriore utente, lasciando invariati quelli già presenti (`ON CONFLICT DO NOTHING` sull'email).

```bash
docker compose exec -e ADMIN_EMAIL=nuovo@esempio.it -e ADMIN_PASSWORD='password-forte' backend node dist/db/seed.js
```

## Reverse proxy

L'app è pensata per stare dietro un reverse proxy con **un solo upstream pubblico**: la porta `3004` del servizio `frontend` (che internamente instrada `/api/*` verso il backend). Il proxy deve inoltrare gli header `X-Forwarded-Proto`, `X-Forwarded-Host` e `X-Forwarded-For` perché cookie `Secure`/`SameSite` e URL assoluti generati dall'app siano coerenti. Non esporre mai direttamente le porte di `backend` o `postgres`. Config di riferimento in [`docs/nginx-reverse-proxy.conf`](docs/nginx-reverse-proxy.conf).

## Ambiente demo

`docker-compose.demo.yml` avvia uno stack completamente separato (rete, volumi Postgres/MariaDB, porta `3006` invece di `3004`) con **nessun dato reale**: il "legacy" è un catalogo fittizio caricato da [`demo/mariadb-legacy/init.sql`](demo/mariadb-legacy/init.sql), Postgres viene popolato da uno script di seed dedicato con clienti e fatture di esempio già emesse.

```bash
cp .env.demo.example .env.demo
# compila .env.demo con segreti DIVERSI da quelli di produzione
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
docker compose -f docker-compose.demo.yml --env-file .env.demo exec backend node dist/db/seed-demo.js
```

Config del reverse proxy per il sottodominio demo in [`docs/nginx-demo-reverse-proxy.conf`](docs/nginx-demo-reverse-proxy.conf).

## Comandi

```bash
docker compose up              # avvio stack completo
npm run db:migrate              # migrazioni Drizzle (backend/), mai SQL manuale sul volume
npm run db:seed                 # seed utente admin + emittente iniziale (backend/)
npm test                        # suite di test backend (richiede Postgres reale; vedi sotto)
```

I test vanno eseguiti con accesso a un Postgres reale (mai mock del layer DB) e, per la suite `legacy`, a un MariaDB raggiungibile con le credenziali configurate — in assenza di queste, solo quei test falliscono con errori di connessione/autenticazione, il resto della suite non ne risente. La validazione XSD del FatturaPA generato richiede `xmllint` (pacchetto `libxml2-utils`) nell'ambiente che esegue i test.

## Test minimi coperti

- Numerazione concorrente senza progressivi duplicati (`tests/documenti/concorrenza.test.ts`)
- Checksum Partita IVA e Codice Fiscale (`tests/lib/fiscal.test.ts`)
- Calcolo totali e riepilogo IVA con arrotondamenti (`tests/documenti/totali.test.ts`)
- Scorporo IVA dal prezzo legacy, incluse aliquote 22/10/4/0% con natura (`tests/legacy/scorporo.test.ts`)
- Immutabilità dei documenti emessi, trigger Postgres (`tests/db/immutabilita.test.ts`)
- Validazione XSD del FatturaPA 1.2.2 generato, fattura e nota di credito (`tests/documenti/xml.test.ts`)
- Redazione dei log: password/token/secret mai in chiaro (`tests/lib/logger-redact.test.ts`)

## Fuori scope

Trasmissione a SdI dell'XML generato, multi-utente con ruoli, registrazione stato/esito trasmissione SdI: la generazione del file conforme è coperta, l'invio no (vedi specifica).
