import { z } from "zod";

export const legacyMerciQuerySchema = z
  .object({
    ean: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).max(200).optional(),
  })
  .refine((data) => Boolean(data.ean) || Boolean(data.q), {
    message: "Specificare il parametro ean oppure q",
    path: ["ean"],
  });
