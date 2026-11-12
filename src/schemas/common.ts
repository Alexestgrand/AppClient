import { z } from 'zod';

/**
 * Montant décimal accepté en nombre ou en texte (virgule française tolérée),
 * normalisé en chaîne pour être passé tel quel à Decimal / Prisma (pas de flottant).
 */
export function decimalString(options: { min?: number; max?: number; label?: string } = {}) {
  const { min = 0, max = 1_000_000_000, label = 'La valeur' } = options;
  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim().replace(',', '.'))
    .refine((value) => /^-?\d+(\.\d+)?$/.test(value), { message: `${label} doit être un nombre.` })
    .refine((value) => Number(value) >= min, { message: `${label} doit être ≥ ${min}.` })
    .refine((value) => Number(value) <= max, { message: `${label} doit être ≤ ${max}.` });
}

export const percentString = (label = 'Le taux') => decimalString({ min: 0, max: 100, label });

export const idSchema = z.string().min(1).max(64);

/** Chaîne facultative : une chaîne vide devient null. */
export const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const optionalId = z
  .string()
  .nullish()
  .transform((value) => (value ? value : null));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} est obligatoire.` })
    .trim()
    .min(1, `${label} est obligatoire.`)
    .max(max);

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 attendu (ex. EUR).');

export const optionalDate = z
  .union([z.string(), z.date()])
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Date invalide.' });
      return z.NEVER;
    }
    return date;
  });
