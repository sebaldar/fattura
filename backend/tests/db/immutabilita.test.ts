import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clienti, documenti, righeDocumento } from "../../src/db/schema.js";
import { client, db, resetTables } from "./setup.js";

async function creaClienteEDocumentoEmesso() {
  const [cliente] = await db.insert(clienti).values({ denominazione: "Cliente Test" }).returning();
  const [documento] = await db
    .insert(documenti)
    .values({
      tipo: "fattura",
      stato: "bozza",
      anno: 2026,
      clienteId: cliente!.id,
      dataDocumento: "2026-07-13",
    })
    .returning();
  const [riga] = await db
    .insert(righeDocumento)
    .values({
      documentoId: documento!.id,
      posizione: 1,
      descrizione: "Prodotto test",
      codiceIva: "22000",
      aliquotaIvaCent: 2200,
      quantita: "1.00",
      prezzoUnitarioCent: 1000,
      totaleRigaCent: 1000,
    })
    .returning();

  const [emesso] = await db
    .update(documenti)
    .set({ stato: "emessa", progressivo: 1, numero: "IT-F-260001", emessaAt: new Date() })
    .where(eq(documenti.id, documento!.id))
    .returning();

  return { cliente: cliente!, documento: emesso!, riga: riga! };
}

describe("immutabilità documenti emessi", () => {
  beforeEach(async () => {
    await resetTables();
  });

  afterAll(async () => {
    await client.end();
  });

  it("consente la transizione bozza -> emessa", async () => {
    const { documento } = await creaClienteEDocumentoEmesso();
    expect(documento.stato).toBe("emessa");
    expect(documento.numero).toBe("IT-F-260001");
  });

  it("blocca UPDATE su un documento emesso", async () => {
    const { documento } = await creaClienteEDocumentoEmesso();
    await expect(
      db.update(documenti).set({ dataDocumento: "2026-07-14" }).where(eq(documenti.id, documento.id)),
    ).rejects.toThrow();
  });

  it("blocca DELETE su un documento emesso", async () => {
    const { documento } = await creaClienteEDocumentoEmesso();
    await expect(db.delete(documenti).where(eq(documenti.id, documento.id))).rejects.toThrow();
  });

  it("consente la transizione emessa -> annullata come puro cambio di stato", async () => {
    const { documento } = await creaClienteEDocumentoEmesso();
    const [annullato] = await db
      .update(documenti)
      .set({ stato: "annullata" })
      .where(eq(documenti.id, documento.id))
      .returning();
    expect(annullato!.stato).toBe("annullata");
  });

  it("blocca la transizione emessa -> annullata se cambia anche un altro campo", async () => {
    const { documento } = await creaClienteEDocumentoEmesso();
    await expect(
      db
        .update(documenti)
        .set({ stato: "annullata", totaleCent: 999999 })
        .where(eq(documenti.id, documento.id)),
    ).rejects.toThrow();
  });

  it("blocca UPDATE e DELETE sulle righe di un documento emesso", async () => {
    const { riga } = await creaClienteEDocumentoEmesso();
    await expect(
      db.update(righeDocumento).set({ descrizione: "modificata" }).where(eq(righeDocumento.id, riga.id)),
    ).rejects.toThrow();
    await expect(db.delete(righeDocumento).where(eq(righeDocumento.id, riga.id))).rejects.toThrow();
  });

  it("consente UPDATE e DELETE su documenti e righe ancora in bozza", async () => {
    const [cliente] = await db.insert(clienti).values({ denominazione: "Cliente Bozza" }).returning();
    const [documento] = await db
      .insert(documenti)
      .values({
        tipo: "fattura",
        stato: "bozza",
        anno: 2026,
        clienteId: cliente!.id,
        dataDocumento: "2026-07-13",
      })
      .returning();
    const [riga] = await db
      .insert(righeDocumento)
      .values({
        documentoId: documento!.id,
        posizione: 1,
        descrizione: "Prodotto bozza",
        codiceIva: "22000",
        aliquotaIvaCent: 2200,
        quantita: "1.00",
        prezzoUnitarioCent: 1000,
        totaleRigaCent: 1000,
      })
      .returning();

    await expect(
      db.update(righeDocumento).set({ descrizione: "modificata" }).where(eq(righeDocumento.id, riga!.id)),
    ).resolves.toBeDefined();
    await expect(db.delete(righeDocumento).where(eq(righeDocumento.id, riga!.id))).resolves.toBeDefined();
    await expect(db.delete(documenti).where(eq(documenti.id, documento!.id))).resolves.toBeDefined();
  });
});
