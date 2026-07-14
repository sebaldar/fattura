import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clienti, documenti } from "../../src/db/schema.js";
import { client, db, resetTables } from "./setup.js";

describe("unicità progressivo documenti", () => {
  beforeEach(async () => {
    await resetTables();
  });

  afterAll(async () => {
    // Evita che le fixture con anno/progressivo fissi (2026/1) restino nel DB
    // condiviso e collidano con altri file di test eseguiti successivamente.
    await resetTables();
    await client.end();
  });

  it("impedisce due documenti con lo stesso tipo/anno/progressivo", async () => {
    const [cliente] = await db.insert(clienti).values({ denominazione: "Cliente Test" }).returning();

    await db.insert(documenti).values({
      tipo: "fattura",
      stato: "emessa",
      anno: 2026,
      progressivo: 1,
      numero: "IT-F-260001",
      clienteId: cliente!.id,
      dataDocumento: "2026-07-13",
      emessaAt: new Date(),
    });

    await expect(
      db.insert(documenti).values({
        tipo: "fattura",
        stato: "emessa",
        anno: 2026,
        progressivo: 1,
        numero: "IT-F-260002",
        clienteId: cliente!.id,
        dataDocumento: "2026-07-13",
        emessaAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("consente lo stesso progressivo per tipi documento diversi nello stesso anno", async () => {
    const [cliente] = await db.insert(clienti).values({ denominazione: "Cliente Test" }).returning();

    const [fattura] = await db
      .insert(documenti)
      .values({
        tipo: "fattura",
        stato: "emessa",
        anno: 2026,
        progressivo: 1,
        numero: "IT-F-260001",
        clienteId: cliente!.id,
        dataDocumento: "2026-07-13",
        emessaAt: new Date(),
      })
      .returning();

    await expect(
      db.insert(documenti).values({
        tipo: "nota_credito",
        stato: "emessa",
        anno: 2026,
        progressivo: 1,
        numero: "IT-NC-260001",
        clienteId: cliente!.id,
        documentoRiferimentoId: fattura!.id,
        dataDocumento: "2026-07-13",
        emessaAt: new Date(),
      }),
    ).resolves.toBeDefined();
  });
});
