import { z } from 'zod';
import { decimalString, optionalId, optionalText, percentString } from './common';
import { feeSchema } from './calculation';

export const saleSchema = z.object({
  saleDate: z
    .union([z.string(), z.date()])
    .transform((value) => new Date(value))
    .refine((date) => !Number.isNaN(date.getTime()), 'Date invalide.'),
  productId: z.string().min(1, 'Le produit est obligatoire.'),
  countryId: z.string().min(1, 'Le pays est obligatoire.'),
  warehouseId: optionalId,
  quantity: z.coerce
    .number()
    .int('Quantité entière attendue.')
    .min(1, 'Quantité ≥ 1.')
    .max(1_000_000),
  /** Prix unitaire HT dans la devise du pays de vente. */
  unitPriceExclTax: decimalString({ label: 'Le prix unitaire HT' }),
  vatRatePercent: percentString('Le taux de TVA').nullish(),
  fees: z.array(feeSchema).max(20).default([]),
  note: optionalText(500),
});

export const statsFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
