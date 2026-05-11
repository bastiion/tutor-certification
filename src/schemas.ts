import { z } from "zod";

/** Raw multiline input → non-empty trimmed lines */
export function parseNamesFromText(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const dataUrlOrEmpty = z.union([
  z.literal(""),
  z.string().refine((s) => s.startsWith("data:"), {
    message: "Logo muss eine gültige Data-URL sein.",
  }),
]);

export const certificateConfigSchema = z.object({
  title: z.string().trim().min(1, "Titel ist erforderlich."),
  date: z.string().trim().min(1, "Datum ist erforderlich."),
  description: z.string(),
  institutionName: z.string().trim().min(1, "Name der Einrichtung ist erforderlich."),
  logoDataUrl: dataUrlOrEmpty,
});

export const namesSchema = z
  .array(z.string().min(1))
  .min(1, "Mindestens ein Name ist erforderlich.");

export const generatePayloadSchema = z.object({
  config: certificateConfigSchema,
  names: namesSchema,
});

export type CertificateConfig = z.infer<typeof certificateConfigSchema>;
export type GeneratePayload = z.infer<typeof generatePayloadSchema>;
