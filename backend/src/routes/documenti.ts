import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
import { clienti, documenti, emittente, righeDocumento } from "../db/schema.js";
import { emettiDocumento } from "../documenti/emissione.js";
import type { DocumentoRiferimentoPerXml } from "../documenti/fatturapa.js";
import { generaXmlFatturaPa, nomeFileXml } from "../documenti/fatturapa.js";
import type { ClienteSnapshot, DocumentoRiferimentoPerPdf } from "../documenti/pdf.js";
import { generaPdfDocumento } from "../documenti/pdf.js";
import {
  campiRiga,
  caricaBozza,
  caricaDocumentoConRighe,
  prossimaPosizione,
  ricalcolaEPersistiTotali,
  trovaRiga,
  valoriRiga,
} from "../documenti/repository.js";
import { HttpError } from "../lib/http-error.js";
import { validateBody } from "../lib/validation.js";
import {
  aggiornaDocumentoSchema,
  creaDocumentoSchema,
  documentoIdParamSchema,
  listaDocumentiQuerySchema,
  rigaIdParamSchema,
  rigaInputSchema,
} from "../validation/documenti.js";

export interface DocumentiRoutesOptions {
  db: Db;
  env: Env;
}

function annoDa(dataDocumento: string): number {
  return Number(dataDocumento.slice(0, 4));
}

export async function documentiRoutes(app: FastifyInstance, opts: DocumentiRoutesOptions): Promise<void> {
  const { db } = opts;

  function gestisciErrore(err: unknown, reply: FastifyReply): boolean {
    if (err instanceof HttpError) {
      reply.code(err.statusCode).send({ error: err.message });
      return true;
    }
    return false;
  }

  app.get("/api/documenti", async (request, reply) => {
    const query = validateBody(listaDocumentiQuerySchema, request.query, reply);
    if (!query) return;

    const condizioni = [];
    if (query.anno !== undefined) condizioni.push(eq(documenti.anno, query.anno));
    if (query.tipo) condizioni.push(eq(documenti.tipo, query.tipo));
    if (query.stato) condizioni.push(eq(documenti.stato, query.stato));
    if (query.clienteId) condizioni.push(eq(documenti.clienteId, query.clienteId));

    const rows = await db
      .select()
      .from(documenti)
      .where(condizioni.length > 0 ? and(...condizioni) : undefined)
      .orderBy(desc(documenti.createdAt))
      .limit(200);

    reply.send(rows);
  });

  app.get("/api/documenti/:id", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    const risultato = await caricaDocumentoConRighe(db, params.id);
    if (!risultato) {
      reply.code(404).send({ error: "Documento non trovato" });
      return;
    }
    reply.send(risultato);
  });

  app.get("/api/documenti/:id/pdf", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    const documento = await caricaDocumentoConRighe(db, params.id);
    if (!documento) {
      reply.code(404).send({ error: "Documento non trovato" });
      return;
    }
    if (documento.stato !== "emessa" || !documento.numero) {
      reply.code(403).send({ error: "Il PDF è generabile solo per documenti emessi" });
      return;
    }

    const [em] = await db.select().from(emittente).where(eq(emittente.id, 1)).limit(1);
    if (!em) {
      reply.code(500).send({ error: "Dati emittente non configurati" });
      return;
    }

    let riferimento: DocumentoRiferimentoPerPdf | null = null;
    if (documento.documentoRiferimentoId) {
      const [fatturaRif] = await db
        .select()
        .from(documenti)
        .where(eq(documenti.id, documento.documentoRiferimentoId))
        .limit(1);
      if (fatturaRif?.numero) {
        riferimento = { numero: fatturaRif.numero, dataDocumento: fatturaRif.dataDocumento };
      }
    }

    // clienteSnapshot è scritto solo da emettiDocumento() a partire dalla riga clienti al momento dell'emissione: dato fidato, non input utente.
    const pdf = await generaPdfDocumento(
      { ...documento, numero: documento.numero, clienteSnapshot: documento.clienteSnapshot as ClienteSnapshot },
      em,
      riferimento,
    );

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${documento.numero}.pdf"`)
      .send(pdf);
  });

  app.get("/api/documenti/:id/xml", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    const documento = await caricaDocumentoConRighe(db, params.id);
    if (!documento) {
      reply.code(404).send({ error: "Documento non trovato" });
      return;
    }
    const { numero, progressivo } = documento;
    if (documento.stato !== "emessa" || !numero || !progressivo) {
      reply.code(403).send({ error: "L'XML FatturaPA è generabile solo per documenti emessi" });
      return;
    }

    const [em] = await db.select().from(emittente).where(eq(emittente.id, 1)).limit(1);
    if (!em) {
      reply.code(500).send({ error: "Dati emittente non configurati" });
      return;
    }

    let riferimento: DocumentoRiferimentoPerXml | null = null;
    if (documento.documentoRiferimentoId) {
      const [fatturaRif] = await db
        .select()
        .from(documenti)
        .where(eq(documenti.id, documento.documentoRiferimentoId))
        .limit(1);
      if (fatturaRif?.numero) {
        riferimento = { numero: fatturaRif.numero, dataDocumento: fatturaRif.dataDocumento };
      }
    }

    let xml: string;
    try {
      // clienteSnapshot è scritto solo da emettiDocumento() a partire dalla riga clienti al momento dell'emissione: dato fidato, non input utente.
      xml = generaXmlFatturaPa(
        {
          tipo: documento.tipo,
          anno: documento.anno,
          progressivo,
          numero,
          dataDocumento: documento.dataDocumento,
          clienteSnapshot: documento.clienteSnapshot as typeof clienti.$inferSelect,
          righe: documento.righe,
          totaleCent: documento.totaleCent,
        },
        em,
        riferimento,
      );
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply
      .header("Content-Type", "application/xml")
      .header(
        "Content-Disposition",
        `attachment; filename="${nomeFileXml({ tipo: documento.tipo, anno: documento.anno, progressivo }, em.partitaIva)}"`,
      )
      .send(xml);
  });

  app.post("/api/documenti", async (request, reply) => {
    const body = validateBody(creaDocumentoSchema, request.body, reply);
    if (!body) return;

    const [cliente] = await db.select().from(clienti).where(eq(clienti.id, body.clienteId)).limit(1);
    if (!cliente) {
      reply.code(400).send({ error: "Cliente non trovato" });
      return;
    }

    const [documento] = await db
      .insert(documenti)
      .values({
        tipo: "fattura",
        stato: "bozza",
        anno: annoDa(body.dataDocumento),
        clienteId: body.clienteId,
        dataDocumento: body.dataDocumento,
      })
      .returning();

    reply.code(201).send({ ...documento, righe: [], riepilogoIva: [] });
  });

  app.put("/api/documenti/:id", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;
    const body = validateBody(aggiornaDocumentoSchema, request.body, reply);
    if (!body) return;

    try {
      await caricaBozza(db, params.id);
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    const [cliente] = await db.select().from(clienti).where(eq(clienti.id, body.clienteId)).limit(1);
    if (!cliente) {
      reply.code(400).send({ error: "Cliente non trovato" });
      return;
    }

    await db
      .update(documenti)
      .set({ clienteId: body.clienteId, dataDocumento: body.dataDocumento, anno: annoDa(body.dataDocumento) })
      .where(eq(documenti.id, params.id));

    reply.send(await caricaDocumentoConRighe(db, params.id));
  });

  app.delete("/api/documenti/:id", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    try {
      await db.transaction(async (tx) => {
        const documento = await caricaBozza(tx, params.id);
        await tx.delete(righeDocumento).where(eq(righeDocumento.documentoId, documento.id));
        await tx.delete(documenti).where(eq(documenti.id, documento.id));
      });
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply.code(204).send();
  });

  app.post("/api/documenti/:id/righe", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;
    const body = validateBody(rigaInputSchema, request.body, reply);
    if (!body) return;

    try {
      await db.transaction(async (tx) => {
        await caricaBozza(tx, params.id);
        const posizione = await prossimaPosizione(tx, params.id);
        await tx.insert(righeDocumento).values(valoriRiga(body, params.id, posizione));
        await ricalcolaEPersistiTotali(tx, params.id);
      });
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply.code(201).send(await caricaDocumentoConRighe(db, params.id));
  });

  app.put("/api/documenti/:id/righe/:rigaId", async (request, reply) => {
    const params = validateBody(rigaIdParamSchema, request.params, reply);
    if (!params) return;
    const body = validateBody(rigaInputSchema, request.body, reply);
    if (!body) return;

    try {
      await db.transaction(async (tx) => {
        await caricaBozza(tx, params.id);
        await trovaRiga(tx, params.id, params.rigaId);
        await tx.update(righeDocumento).set(campiRiga(body)).where(eq(righeDocumento.id, params.rigaId));
        await ricalcolaEPersistiTotali(tx, params.id);
      });
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply.send(await caricaDocumentoConRighe(db, params.id));
  });

  app.delete("/api/documenti/:id/righe/:rigaId", async (request, reply) => {
    const params = validateBody(rigaIdParamSchema, request.params, reply);
    if (!params) return;

    try {
      await db.transaction(async (tx) => {
        await caricaBozza(tx, params.id);
        await trovaRiga(tx, params.id, params.rigaId);
        await tx.delete(righeDocumento).where(eq(righeDocumento.id, params.rigaId));
        await ricalcolaEPersistiTotali(tx, params.id);
      });
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply.send(await caricaDocumentoConRighe(db, params.id));
  });

  app.post("/api/documenti/:id/emetti", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    try {
      await emettiDocumento(db, params.id);
    } catch (err) {
      if (gestisciErrore(err, reply)) return;
      throw err;
    }

    reply.send(await caricaDocumentoConRighe(db, params.id));
  });

  app.post("/api/documenti/:id/note-credito", async (request, reply) => {
    const params = validateBody(documentoIdParamSchema, request.params, reply);
    if (!params) return;

    const [fattura] = await db.select().from(documenti).where(eq(documenti.id, params.id)).limit(1);
    if (!fattura) {
      reply.code(404).send({ error: "Fattura non trovata" });
      return;
    }
    if (fattura.tipo !== "fattura" || fattura.stato !== "emessa") {
      reply.code(409).send({ error: "È possibile creare una nota di credito solo da una fattura emessa" });
      return;
    }

    const nc = await db.transaction(async (tx) => {
      const righeFattura = await tx
        .select()
        .from(righeDocumento)
        .where(eq(righeDocumento.documentoId, fattura.id))
        .orderBy(righeDocumento.posizione);

      const oggi = new Date().toISOString().slice(0, 10);

      const [nuovaNc] = await tx
        .insert(documenti)
        .values({
          tipo: "nota_credito",
          stato: "bozza",
          anno: annoDa(oggi),
          clienteId: fattura.clienteId,
          documentoRiferimentoId: fattura.id,
          dataDocumento: oggi,
        })
        .returning();

      if (righeFattura.length > 0) {
        await tx.insert(righeDocumento).values(
          righeFattura.map((r) => ({
            documentoId: nuovaNc!.id,
            posizione: r.posizione,
            codiceFornitore: r.codiceFornitore,
            codiceMerce: r.codiceMerce,
            codiceEan: r.codiceEan,
            descrizione: r.descrizione,
            codiceIva: r.codiceIva,
            aliquotaIvaCent: r.aliquotaIvaCent,
            natura: r.natura,
            quantita: r.quantita,
            prezzoUnitarioCent: r.prezzoUnitarioCent,
            totaleRigaCent: r.totaleRigaCent,
          })),
        );
        await ricalcolaEPersistiTotali(tx, nuovaNc!.id);
      }

      return nuovaNc!;
    });

    reply.code(201).send(await caricaDocumentoConRighe(db, nc.id));
  });
}
