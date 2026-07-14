import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RESOURCES_DIR = new URL("../../resources/fatturapa/", import.meta.url).pathname;
const XSD_PATH = join(RESOURCES_DIR, "Schema_del_file_xml_FatturaPA_v1.2.2.xsd");
const CATALOG_PATH = join(RESOURCES_DIR, "catalog.xml");

/** Valida un XML FatturaPA contro lo XSD ufficiale 1.2.2 (richiede xmllint, es. `apk add libxml2-utils`). */
export function validaFatturaPaXsd(xml: string): void {
  const dir = mkdtempSync(join(tmpdir(), "fatturapa-xsd-"));
  const xmlPath = join(dir, "fattura.xml");
  writeFileSync(xmlPath, xml, "utf-8");

  execFileSync("xmllint", ["--noout", "--schema", XSD_PATH, xmlPath], {
    env: { ...process.env, XML_CATALOG_FILES: CATALOG_PATH },
    stdio: "pipe",
  });
}
