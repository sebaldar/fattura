-- Immutabilità dei documenti emessi (CLAUDE.md: "Documenti in stato `emessa` sono immutabili").
-- Blocca UPDATE/DELETE su `documenti` quando lo stato non è `bozza`, con whitelist per le
-- sole transizioni bozza->emessa (libera, gestita a livello applicativo) ed emessa->annullata
-- (consentita, ma solo come cambio di stato puro: nessun altro campo può variare).
CREATE OR REPLACE FUNCTION fn_documenti_immutabilita() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stato <> 'bozza' THEN
      RAISE EXCEPTION 'Impossibile eliminare il documento %: stato % non modificabile', OLD.id, OLD.stato;
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.stato = 'bozza' THEN
    RETURN NEW; -- bozza liberamente modificabile, incluso il passaggio bozza->emessa
  END IF;

  IF OLD.stato = 'emessa' AND NEW.stato = 'annullata' THEN
    IF NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.anno IS DISTINCT FROM OLD.anno
       OR NEW.progressivo IS DISTINCT FROM OLD.progressivo
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.cliente_snapshot IS DISTINCT FROM OLD.cliente_snapshot
       OR NEW.documento_riferimento_id IS DISTINCT FROM OLD.documento_riferimento_id
       OR NEW.data_documento IS DISTINCT FROM OLD.data_documento
       OR NEW.totale_imponibile_cent IS DISTINCT FROM OLD.totale_imponibile_cent
       OR NEW.totale_iva_cent IS DISTINCT FROM OLD.totale_iva_cent
       OR NEW.totale_cent IS DISTINCT FROM OLD.totale_cent
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.emessa_at IS DISTINCT FROM OLD.emessa_at
    THEN
      RAISE EXCEPTION 'Annullamento documento %: consentita solo la modifica dello stato', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Documento % in stato % è immutabile', OLD.id, OLD.stato;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_documenti_immutabilita ON documenti;
--> statement-breakpoint
CREATE TRIGGER trg_documenti_immutabilita
BEFORE UPDATE OR DELETE ON documenti
FOR EACH ROW EXECUTE FUNCTION fn_documenti_immutabilita();
--> statement-breakpoint

-- Le righe seguono lo stato della testata collegata: nessuna modifica/cancellazione
-- possibile se il documento non è più in bozza (nessuna eccezione, a differenza della testata).
CREATE OR REPLACE FUNCTION fn_righe_documento_immutabilita() RETURNS trigger AS $$
DECLARE
  v_stato stato_documento;
BEGIN
  SELECT stato INTO v_stato FROM documenti WHERE id = COALESCE(OLD.documento_id, NEW.documento_id);
  IF v_stato IS NOT NULL AND v_stato <> 'bozza' THEN
    RAISE EXCEPTION 'Riga documento %: il documento collegato è in stato % non modificabile', OLD.id, v_stato;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_righe_documento_immutabilita ON righe_documento;
--> statement-breakpoint
CREATE TRIGGER trg_righe_documento_immutabilita
BEFORE UPDATE OR DELETE ON righe_documento
FOR EACH ROW EXECUTE FUNCTION fn_righe_documento_immutabilita();
