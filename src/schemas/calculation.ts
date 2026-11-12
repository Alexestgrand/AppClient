import { z } from 'zod';
import { FEE_TYPES } from '@/domain/pricing';
import { decimalString, optionalId, optionalText, percentString } from './common';

export const vatCalculationSchema = z.object({
  amount: decimalString({ label: 'Le prix' }),
  ratePercent: percentString('Le taux de TVA'),
  mode: z.enum(['HT_TO_TTC', 'TTC_TO_HT']),
  countryId: optionalId,
  productId: optionalId,
  label: optionalText(200),
});

const feeType = z.enum(FEE_TYPES);
export const feeSchema = z.discriminatedUnion('mode', [
  z.object({
    type: feeType,
    label: optionalText(100),
    mode: z.literal('FIXED'),
    value: decimalString({ label: 'Le frais' }),
  }),
  z.object({
    type: feeType,
    label: optionalText(100),
    mode: z.literal('PERCENT'),
    base: z.enum(['HT', 'TTC']),
    value: percentString('Le pourcentage de frais'),
  }),
]);

export const targetSchema = z.object({
  type: z.enum(['AMOUNT', 'MARKUP_PERCENT', 'MARGIN_RATE_PERCENT']),
  value: decimalString({ label: "L'objectif" }),
});

const pricingBase = {
  costPrice: decimalString({ label: 'Le coût de revient' }),
  target: targetSchema,
  fees: z.array(feeSchema).max(20).default([]),
  productId: optionalId,
  label: optionalText(200),
};

/** Calcul pour un pays : le taux peut être imposé manuellement, sinon taux standard du pays. */
export const internationalCalculationSchema = z.object({
  ...pricingBase,
  countryId: z.string().min(1, 'Le pays est obligatoire.'),
  vatRatePercent: percentString('Le taux de TVA').nullish(),
});

export const comparisonSchema = z.object({
  ...pricingBase,
  countryIds: z.array(z.string().min(1)).min(1, 'Sélectionnez au moins un pays.').max(50),
});

export const historyFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(['VAT', 'INTERNATIONAL']).optional(),
  countryId: z.string().max(64).optional(),
});
