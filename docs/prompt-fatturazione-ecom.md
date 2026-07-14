# Prompt di implementazione — Web app fatturazione e-commerce (single-tenant)

## Contesto

Realizza una web app PWA **single-tenant** per la gestione di fatture e note di credito emesse da un e-commerce italiano. L'app gestisce: anagrafica clienti (inserimento manuale o via foto di biglietto da visita / testo dattiloscritto o manoscritto con estrazione AI), dati dell'emittente, emissione documenti con righe prodotto inseribili anche via scansione codice a barre EAN con lookup su un database legacy MariaDB remoto.

Tutto gira in **Docker Compose** su un unico VPS, **eccetto** il MariaDB legacy che risiede su `mysql.baldoweb.it` (accesso di sola lettura via rete). Il frontend espone la **porta 3004** verso l'host; un reverse proxy su un altro VPS termina TLS e inoltra il traffico. Nessun altro servizio deve esporre porte verso l'host.

## Stack vincolante

- **Frontend**: Next.js 15+ (App Router), TypeScript strict, Tailwind CSS, PWA (manifest + service worker). Build standalone.
- **Backend**: Node.js 22, Fastify 5, TypeScript strict, validazione **Zod** su tutti gli input, **Drizzle ORM** con migrazioni versionate, **pdfmake** per la generazione PDF, **xmlbuilder2** per la generazione FatturaPA XML.
- **DB principale**: PostgreSQL 16 (container, volume persistente).
- **DB legacy (sola lettura)**: MariaDB remoto su `mysql.baldoweb.it`, client `mysql2` con pool dedicato, utente read-only, credenziali via env.
- **Estrazione AI**: Anthropic Messages API, modello `claude-sonnet-4-6` (vision), API key solo lato backend via env.
- **Auth**: email + password (hash **argon2id**) + **TOTP** compatibile Google Authenticator (`otplib`). Sessioni JWT in cookie `httpOnly`, `Secure`, `SameSite=Strict`.
- **Architettura di rete**: il backend è raggiungibile solo sulla rete interna Docker; Next.js fa da unico punto d'ingresso e inoltra le chiamate al backend tramite `rewrites` su `/api/*`. Un solo upstream per il reverse proxy.

## Modello dati (PostgreSQL)

Tutti gli **importi in centesimi** (integer). Le **aliquote in centesimi di punto percentuale** (es. `2200` = 22,00%), coerenti col legacy.

### `emittente` (riga singola)
`id` (check id=1), `ragione_sociale`, `partita_iva`, `codice_fiscale`, `indirizzo`, `cap`, `comune`, `provincia`, `nazione` (default 'IT'), `regime_fiscale`, `iban`, `email`, `telefono`, `updated_at`.

### `utenti`
`id` uuid, `email` unique, `password_hash` (argon2id), `totp_secret` (cifrato at rest con chiave da env, AES-256-GCM), `totp_enabled` boolean, `failed_attempts`, `locked_until`, `created_at`. **Nessuna registrazione pubblica**: utenti creati via seed/script CLI.

### `clienti`
`id` uuid, `denominazione`, `partita_iva`, `codice_fiscale`, `codice_sdi`, `pec`, `indirizzo`, `cap`, `comune`, `provincia`, `nazione`, `email`, `telefono`, `note`, `created_at`, `updated_at`. Validazione Zod: P.IVA italiana (11 cifre + checksum), CF (regex 16 caratteri + checksum, o 11 cifre per soggetti giuridici), email, CAP 5 cifre, provincia 2 lettere.

### `documenti`
`id` uuid, `tipo` enum (`fattura` | `nota_credito`), `stato` enum (`bozza` | `emessa` | `annullata`), `anno` smallint, `progressivo` int (nullable in bozza), `numero` varchar (nullable in bozza, formato `IT-F-<YY><NNNN>` per fatture, `IT-NC-<YY><NNNN>` per note di credito), `cliente_id` FK, `cliente_snapshot` jsonb (copiato all'emissione), `documento_riferimento_id` FK nullable (obbligatorio per note di credito: la fattura stornata), `data_documento` date, `totale_imponibile_cent` int, `totale_iva_cent` int, `totale_cent` int, `created_at`, `emessa_at`.
Vincoli: `UNIQUE (tipo, anno, progressivo)`; check che `numero` sia valorizzato ⇔ stato ≠ bozza.

### `righe_documento`
`id` uuid, `documento_id` FK, `posizione` int, `codice_fornitore` varchar(6) nullable, `codice_merce` varchar(15) nullable, `codice_ean` varchar(15) nullable, `descrizione` varchar(200) NOT NULL, `codice_iva` char(5) NOT NULL, `aliquota_iva_cent` int NOT NULL (snapshot), `natura` char(3) nullable (snapshot, per operazioni non imponibili/esenti), `quantita` numeric(10,2) NOT NULL > 0, `prezzo_unitario_cent` int NOT NULL, `totale_riga_cent` int NOT NULL.
I dati prodotto sono **snapshot al momento dell'inserimento**: nessuna FK verso il legacy, il documento deve restare storicamente corretto anche se il listino cambia.

### `contatori`
PK composta `(tipo, anno)`, `ultimo_progressivo` int. La prima fattura dell'anno è **0001**.

## Numerazione e ciclo di vita documenti

- Il progressivo viene assegnato **esclusivamente al passaggio bozza → emessa**, mai alla creazione della bozza (nessun progressivo bruciato).
- Assegnazione atomica in transazione: `SELECT ultimo_progressivo FROM contatori WHERE tipo=$1 AND anno=$2 FOR UPDATE`, incremento, upsert se l'anno non esiste ancora, composizione del `numero`, update del documento — tutto nella stessa transazione.
- Un documento `emessa` è **immutabile**: vietati update e delete (enforcement sia applicativo sia con trigger Postgres che solleva eccezione su UPDATE/DELETE di documenti e righe con stato ≠ bozza, con whitelist per il solo passaggio di stato bozza→emessa e emessa→annullata).
- Correzioni solo tramite **nota di credito** collegata (`documento_riferimento_id`), con propria serie di numerazione `IT-NC-`.
- PDF e XML FatturaPA sono generabili **solo** da documenti in stato `emessa`: grazie all'immutabilità, la generazione è deterministica e on-demand dai dati persistiti (niente file da archiviare).
- Test obbligatorio: due emissioni concorrenti non devono mai produrre progressivi duplicati (test con transazioni parallele).

## Calcolo totali

- Totale riga: `round(quantita × prezzo_unitario_cent)`.
- IVA calcolata **per raggruppamento di aliquota** sull'imponibile aggregato (non riga per riga), arrotondamento half-up al centesimo.
- Riepilogo IVA per aliquota mostrato in testata e in stampa.
- Totali ricalcolati e persistiti server-side all'emissione; il frontend mostra totali live ma il valore autoritativo è quello del backend.

## Integrazione MariaDB legacy (sola lettura)

Schema rilevante:

- `merci`: PK (`codice_fornitore`, `codice_merce`), campi utili: `descrizione`, `prezzo_di_vendita` (int, **centesimi**), `codice_IVA` char(3), `codice_EAN` varchar(15) (indicizzato), `fuori_produzione`, `tipologia`.
- `aliquotaiva`: PK `codice` char(5), `aliquota_iva` (int, **centesimi di punto**, es. 2200 = 22%), `descrizione`, `operazione` enum (`imponibile`|`non imponibile`|`esente`), `natura` char(3). Relazione: `merci.codice_IVA → aliquotaiva.codice`.

Endpoint backend:

- `GET /api/legacy/merci?ean=<EAN>` → `SELECT m.codice_fornitore, m.codice_merce, m.descrizione, m.prezzo_di_vendita, m.codice_IVA, a.aliquota_iva, a.operazione, a.natura FROM merci m JOIN aliquotaiva a ON a.codice = m.codice_IVA WHERE m.codice_EAN = ?`
- `GET /api/legacy/merci?q=<testo>` → ricerca fallback per codice o descrizione (LIKE, limit 20).
- `GET /api/legacy/aliquote` → elenco aliquote per la select del form riga (con cache in memoria, TTL 1h).

Requisiti:

- Timeout di connessione/query breve (3s) e gestione esplicita dell'irraggiungibilità: se il legacy è giù, la UI degrada a **inserimento manuale** della riga con messaggio chiaro, senza bloccare l'emissione.
- `prezzo_di_vendita` è **IVA inclusa**: al lookup il backend scorpora sempre l'IVA per proporre il prezzo unitario imponibile: `prezzo_unitario_cent = round(prezzo_di_vendita / (1 + aliquota_iva / 10000))`. Il prezzo proposto resta comunque editabile nel form riga.

## Generazione PDF e FatturaPA XML (fase 1)

### PDF (pdfmake, server-side)

- Endpoint `GET /api/documenti/:id/pdf`, consentito solo per stato `emessa` (403 altrimenti), risposta `Content-Disposition: attachment` con nome file = numero documento (es. `IT-F-260001.pdf`).
- Layout completo: intestazione emittente (denominazione, indirizzo, P.IVA, CF, IBAN), dati cliente da `cliente_snapshot`, tipo/numero/data documento, per le note di credito il riferimento alla fattura stornata, tabella righe (codici, descrizione, quantità, prezzo unitario, aliquota, totale riga), riepilogo IVA per aliquota, totale imponibile / IVA / documento. Importi formattati in euro con locale `it-IT`.

### FatturaPA XML (xmlbuilder2)

- Endpoint `GET /api/documenti/:id/xml`, solo stato `emessa`. Formato **FatturaPA 1.2.2**, `FormatoTrasmissione` FPR12.
- `TipoDocumento`: `TD01` per fatture, `TD04` per note di credito (con `DatiFattureCollegate` che referenzia numero e data della fattura stornata).
- Mapping: `CedentePrestatore` dai dati emittente (`IdFiscaleIVA`, `CodiceFiscale`, `RegimeFiscale`); `CessionarioCommittente` da `cliente_snapshot`; `CodiceDestinatario` dal codice SDI del cliente, `0000000` + `PECDestinatario` se solo PEC, `0000000` per consumatori privati, `XXXXXXX` per esteri.
- `DettaglioLinee` dalle righe: `PrezzoUnitario` e `PrezzoTotale` convertiti da centesimi a decimali (2 cifre), `AliquotaIVA` in formato `22.00`, `Natura` obbligatoria per le righe con aliquota 0 (dal snapshot `natura`).
- `DatiRiepilogo` raggruppati per aliquota/natura, coerenti al centesimo con i totali persistiti in testata (stessa logica di arrotondamento).
- `ProgressivoInvio` derivato da anno+progressivo. Nome file secondo convenzione SdI: `IT<PIVA emittente>_<progressivo alfanumerico 5 caratteri>.xml`.
- Test: XML well-formed e validato contro lo XSD FatturaPA 1.2.2 (incluso nel repo) sia per una fattura sia per una nota di credito, inclusi casi con aliquote multiple e righe esenti/non imponibili.

## Autenticazione (2 fattori)

1. **Login step 1**: email + password → verifica argon2id. Rate limiting (`@fastify/rate-limit`) e lockout progressivo dopo N tentativi falliti (`failed_attempts`, `locked_until`).
2. **Login step 2**: codice TOTP a 6 cifre → verifica `otplib` (window 1). Solo a verifica riuscita vengono emessi access token JWT (15 min) + refresh token (7 giorni), entrambi in cookie `httpOnly` `Secure` `SameSite=Strict`. Endpoint di refresh con rotazione.
3. **Setup TOTP**: generazione secret, QR `otpauth://totp/...` da inquadrare con Google Authenticator, attivazione confermata dal primo codice valido. Secret cifrato at rest.
4. Middleware auth su tutte le route tranne login/refresh. Logout = revoca refresh + clear cookie.

## Estrazione dati cliente da foto (AI)

Flusso:

1. Frontend: `<input type="file" accept="image/*" capture="environment">` — foto di biglietto da visita, testo dattiloscritto o manoscritto.
2. Backend: ridimensionamento con `sharp` (lato lungo max 1568px, JPEG qualità 85), conversione base64.
3. Chiamata Anthropic Messages API, modello `claude-sonnet-4-6`, con l'immagine e un prompt che impone di rispondere **solo con JSON** conforme allo schema campi cliente (denominazione, partita_iva, codice_fiscale, indirizzo, cap, comune, provincia, email, telefono, pec, codice_sdi — `null` per i campi non leggibili, nessuna invenzione di dati).
4. Parse della risposta (strip di eventuali fence markdown) → validazione **Zod** con gli stessi checksum dell'inserimento manuale → i campi che falliscono la validazione tornano `null` con warning.
5. Risposta al frontend che **precompila il form cliente**: l'utente rivede, corregge e conferma. Nessun salvataggio automatico.
6. Le foto **non vengono persistite**: processate in memoria/tmpfs e scartate dopo l'estrazione.

## Frontend / PWA

Pagine:

- **Login** (2 step: credenziali, poi TOTP) e **setup TOTP** (primo accesso).
- **Dashboard**: ultimi documenti, totali anno corrente.
- **Clienti**: lista con ricerca, nuovo/modifica con doppia modalità (form manuale | "da foto" con precompilazione AI).
- **Documenti**: lista con filtri per anno, tipo, stato, cliente; azioni contestuali allo stato (modifica solo su bozze, "crea nota di credito" solo su fatture emesse).
- **Editor documento**: testata (cliente da ricerca/autocomplete, data) + righe. Aggiunta riga manuale o via **scanner EAN**: `BarcodeDetector` API nativa dove disponibile, fallback `@zxing/browser`; a lettura riuscita, lookup sul legacy e riga precompilata (codici, descrizione, prezzo, codice IVA con aliquota snapshot), tutto editabile prima della conferma. Prezzi digitati in euro, memorizzati in centesimi. Totali e riepilogo IVA live.
- **Impostazioni emittente**: form dei dati dell'emittente.
- **Dettaglio documento emesso**: vista in sola lettura con pulsanti **Scarica PDF** e **Scarica XML FatturaPA** (visibili solo per stato `emessa`) e azione "Crea nota di credito".

PWA: manifest, icone, service worker (`next-pwa` o Workbox) con cache della sola app shell — **mai** cache delle risposte API. HTTPS garantito dal reverse proxy (necessario per camera e BarcodeDetector).

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD da .env]
    healthcheck: pg_isready
    restart: unless-stopped
    # nessuna porta esposta verso l'host

  backend:
    build: ./backend
    depends_on:
      postgres: { condition: service_healthy }
    env_file: .env
    restart: unless-stopped
    # nessuna porta esposta verso l'host

  frontend:
    build: ./frontend   # Next.js standalone
    depends_on: [backend]
    ports:
      - "3004:3000"     # opzionale: bind sul solo IP WireGuard, es. "10.10.0.X:3004:3000"
    restart: unless-stopped

volumes:
  pgdata:
```

- Rete bridge interna unica; il frontend raggiunge il backend come `http://backend:3005`, il backend raggiunge Postgres come `postgres:5432` e il legacy come `mysql.baldoweb.it:3306`.
- `.env.example` completo e documentato: `DATABASE_URL`, `LEGACY_DB_HOST/USER/PASSWORD/DATABASE`, `ANTHROPIC_API_KEY`, `JWT_SECRET`, `TOTP_ENC_KEY`, `NEXT_PUBLIC_APP_URL`.
- Le migrazioni Drizzle girano automaticamente all'avvio del backend (o via comando dedicato documentato).

## Seed

Script di seed idempotente: utente admin (email/password da env, TOTP da configurare al primo login), emittente di esempio, nessuna aliquota locale (le aliquote arrivano dal legacy).

## Requisiti di qualità

- TypeScript strict ovunque, zero `any`.
- Zod su ogni input API; errori di validazione con messaggi strutturati.
- Logging strutturato (pino) con redaction di password, token, secret.
- Test minimi: numerazione concorrente senza duplicati, checksum P.IVA e CF, calcolo totali e riepilogo IVA con arrotondamenti, scorporo IVA dal prezzo legacy (inclusi casi 22%, 10%, 4%, 0% con natura), immutabilità dei documenti emessi (trigger), validazione XSD del FatturaPA generato.
- README: setup, variabili d'ambiente, creazione utente, note sul reverse proxy (upstream unico su :3004, header `X-Forwarded-*`).

## Fuori scope (fase 2 — predisporre, non implementare)

- **Trasmissione a SdI** dell'XML generato (via PEC o canale accreditato): la generazione del file conforme è in fase 1, l'invio no.
- Multi-utente con ruoli.
- Registrazione stato di trasmissione/esito SdI (ricevute).
