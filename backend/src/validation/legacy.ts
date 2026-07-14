import { z } from "zod";

export const legacyMerciQuerySchema = z
  .object({
    ean: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    // Lookup da QR etichetta: fornitore+merce sono la chiave primaria di `merci`,
    // vanno specificati insieme.
    fornitore: z.string().trim().min(1).max(6).optional(),
    merce: z.string().trim().min(1).max(15).optional(),
  })
  .refine(
    (data) => Boolean(data.ean) || Boolean(data.q) || (Boolean(data.fornitore) && Boolean(data.merce)),
    {
      message: "Specificare il parametro ean, q oppure fornitore e merce",
      path: ["ean"],
    },
  );
