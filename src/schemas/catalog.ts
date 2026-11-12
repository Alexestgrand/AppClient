import { z } from 'zod';
import {
  currencyCode,
  decimalString,
  optionalDate,
  optionalId,
  optionalText,
  percentString,
  requiredText,
} from './common';

export const categorySchema = z.object({
  name: requiredText('Le nom', 100),
  description: optionalText(),
});

export const warehouseSchema = z.object({
  name: requiredText('Le nom', 100),
  address: optionalText(300),
  countryId: requiredText('Le pays', 64),
  description: optionalText(),
  isActive: z.boolean().default(true),
});

export const productSchema = z.object({
  name: requiredText('Le nom', 200),
  reference: requiredText('La référence', 64),
  description: optionalText(2000),
  purchasePrice: decimalString({ label: "Le prix d'achat" }),
  costPrice: decimalString({ label: 'Le coût de revient' })
    .nullish()
    .or(z.literal('').transform(() => null))
    .transform((value) => value ?? null),
  categoryId: optionalId,
  warehouseId: optionalId,
});

export const productFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().max(64).optional(),
  warehouseId: z.string().max(64).optional(),
});

export const vatRateTypeSchema = z.enum(['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO']);

export const vatRateSchema = z.object({
  label: requiredText('Le libellé', 100),
  type: vatRateTypeSchema,
  rate: percentString('Le taux de TVA'),
});

export const countrySchema = z.object({
  name: requiredText('Le nom', 100),
  isoCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Code ISO 3166-1 alpha-2 attendu (ex. FR).'),
  currencyCode,
  isActive: z.boolean().default(true),
  taxSource: optionalText(300),
  taxSourceUrl: z
    .string()
    .trim()
    .url('URL invalide.')
    .max(500)
    .nullish()
    .or(z.literal('').transform(() => null))
    .transform((value) => value ?? null),
  lastVerifiedAt: optionalDate,
  vatRates: z.array(vatRateSchema).max(20).default([]),
});

export const exchangeRateSchema = z.object({
  currencyCode,
  rate: decimalString({ min: 0.00000001, label: 'Le taux de change' }),
  source: optionalText(300),
  rateDate: optionalDate.transform((value) => value ?? new Date()),
});

export const settingsSchema = z.object({
  companyName: requiredText("Le nom de l'entreprise", 100),
  mainCurrency: currencyCode,
  defaultTargetAmount: decimalString({ label: "L'objectif par défaut" }),
});
