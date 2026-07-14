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
  ('FORN01', 'ART001', 'Prodotto aliquota 22%', 1220, '22000', '8001234567890', 0, 'generico'),
  ('FORN01', 'ART002', 'Prodotto aliquota 10%', 1100, '10000', '8001234567891', 0, 'generico'),
  ('FORN01', 'ART003', 'Prodotto aliquota 4%', 1040, '04000', '8001234567892', 0, 'generico'),
  ('FORN01', 'ART004', 'Prodotto esente natura N2', 1000, 'N2', '8001234567893', 0, 'generico');
