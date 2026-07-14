-- Dati fittizi per la demo pubblica: schema identico al legacy reale
-- (vedi docs/prompt-fatturazione-ecom.md), nessun dato reale.

CREATE TABLE IF NOT EXISTS aliquotaiva (
  codice VARCHAR(10) PRIMARY KEY,
  aliquota_iva INT NOT NULL,
  descrizione VARCHAR(100) NOT NULL,
  operazione ENUM('imponibile','non imponibile','esente') NOT NULL,
  natura CHAR(3) NULL
);

CREATE TABLE IF NOT EXISTS merci (
  codice_fornitore VARCHAR(6) NOT NULL,
  codice_merce VARCHAR(15) NOT NULL,
  descrizione VARCHAR(200) NOT NULL,
  prezzo_di_vendita INT NOT NULL,
  codice_IVA VARCHAR(10) NOT NULL,
  codice_EAN VARCHAR(15),
  fuori_produzione TINYINT(1) NOT NULL DEFAULT 0,
  tipologia VARCHAR(50),
  PRIMARY KEY (codice_fornitore, codice_merce)
);
CREATE INDEX idx_merci_ean ON merci (codice_EAN);

INSERT INTO aliquotaiva (codice, aliquota_iva, descrizione, operazione, natura) VALUES
  ('22000', 2200, 'IVA 22%', 'imponibile', NULL),
  ('10000', 1000, 'IVA 10%', 'imponibile', NULL),
  ('04000', 400, 'IVA 4%', 'imponibile', NULL),
  ('N2', 0, 'Non soggetto', 'non imponibile', 'N2');

INSERT INTO merci (codice_fornitore, codice_merce, descrizione, prezzo_di_vendita, codice_IVA, codice_EAN, fuori_produzione, tipologia) VALUES
  ('MB001', 'PASS01', 'Passeggino trio 3 in 1', 34900, '22000', '8012345000011', 0, 'puericultura'),
  ('MB001', 'SEGG01', 'Seggiolino auto gruppo 0+', 12900, '22000', '8012345000028', 0, 'sicurezza'),
  ('MB001', 'CULL01', 'Culla neonato con cassettiera', 24900, '22000', '8012345000035', 0, 'arredo'),
  ('MB002', 'BODY01', 'Body neonato cotone bio (3 pezzi)', 1990, '10000', '8012345000042', 0, 'abbigliamento'),
  ('MB002', 'TUTA01', 'Tutina invernale 0-3 mesi', 2490, '10000', '8012345000059', 0, 'abbigliamento'),
  ('MB003', 'LATT01', 'Latte in polvere formula 1 (800g)', 1890, '04000', '8012345000066', 0, 'alimentazione'),
  ('MB003', 'PANN01', 'Pannolini taglia 3 (176 pz)', 2290, '04000', '8012345000073', 0, 'igiene'),
  ('MB004', 'GIOC01', 'Giostrina musicale per lettino', 3990, '22000', '8012345000080', 0, 'giochi'),
  ('MB004', 'PELU01', 'Peluche orsetto 30cm', 1590, '22000', '8012345000097', 0, 'giochi'),
  ('MB005', 'BUON01', 'Buono sconto promozionale', 500, 'N2', '8012345000103', 0, 'servizi');
