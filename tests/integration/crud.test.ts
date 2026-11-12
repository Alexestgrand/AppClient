import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { productSchema, categorySchema, warehouseSchema, countrySchema } from '@/schemas/catalog';
import { saleSchema } from '@/schemas/sale';
import { categoryService, productService, warehouseService } from '@/services/catalog.service';
import { calculationService, historyService } from '@/services/calculation.service';
import { countryService, exchangeRateService } from '@/services/country.service';
import { saleService } from '@/services/sale.service';
import { statsService } from '@/services/stats.service';
import { createCountry, hasTestDatabase, resetDatabase } from './helpers';

describe.skipIf(!hasTestDatabase)('Opérations CRUD (base PostgreSQL de test)', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('crée, modifie, filtre et supprime un produit', async () => {
    const country = await createCountry();
    const category = await categoryService.create(categorySchema.parse({ name: 'Maison' }));
    const warehouse = await warehouseService.create(
      warehouseSchema.parse({ name: 'Lyon', countryId: country.id }),
    );
    const product = await productService.create(
      productSchema.parse({
        name: 'Lampe',
        reference: 'L-1',
        purchasePrice: '18,50',
        costPrice: '',
        categoryId: category.id,
        warehouseId: warehouse.id,
      }),
    );
    expect(product.purchasePrice.toString()).toBe('18.5');
    expect(product.costPrice).toBeNull();

    await productService.update(
      product.id,
      productSchema.parse({
        name: 'Lampe LED',
        reference: 'L-1',
        purchasePrice: '18.5',
        costPrice: '20',
      }),
    );
    expect((await productService.list({ search: 'led' })).map((p) => p.name)).toEqual([
      'Lampe LED',
    ]);
    expect(await productService.list({ categoryId: category.id })).toHaveLength(0); // catégorie retirée par la mise à jour

    await productService.delete(product.id);
    await expect(productService.get(product.id)).rejects.toThrow('introuvable');
  });

  it('refuse les doublons de référence', async () => {
    await productService.create(
      productSchema.parse({ name: 'A', reference: 'X', purchasePrice: 1 }),
    );
    await expect(
      productService.create(productSchema.parse({ name: 'B', reference: 'X', purchasePrice: 1 })),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuse de supprimer une catégorie ou un entrepôt utilisé', async () => {
    const country = await createCountry();
    const category = await categoryService.create({ name: 'C', description: null });
    const warehouse = await warehouseService.create(
      warehouseSchema.parse({ name: 'W', countryId: country.id }),
    );
    await productService.create(
      productSchema.parse({
        name: 'P',
        reference: 'P',
        purchasePrice: 1,
        categoryId: category.id,
        warehouseId: warehouse.id,
      }),
    );
    await expect(categoryService.delete(category.id)).rejects.toThrow(/Suppression impossible/);
    await expect(warehouseService.delete(warehouse.id)).rejects.toThrow(/Suppression impossible/);
    await expect(countryService.delete(country.id)).rejects.toThrow(/Suppression impossible/);
  });

  it('gère les pays et refuse deux taux standard', async () => {
    const input = countrySchema.parse({
      name: 'Belgique',
      isoCode: 'be',
      currencyCode: 'eur',
      taxSource: 'TEDB',
      vatRates: [
        { label: 'Normal', type: 'STANDARD', rate: '21' },
        { label: 'Réduit', type: 'REDUCED', rate: '6' },
      ],
    });
    const country = await countryService.create(input);
    expect(country.isoCode).toBe('BE');
    expect(country.vatRates).toHaveLength(2);
    const updated = await countryService.update(country.id, {
      ...input,
      vatRates: [{ label: 'Normal', type: 'STANDARD', rate: '21' }],
    });
    expect(updated.vatRates).toHaveLength(1);
    await expect(
      countryService.update(country.id, {
        ...input,
        vatRates: [...input.vatRates.slice(0, 1), ...input.vatRates.slice(0, 1)],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('enregistre un calcul international recalculé côté serveur, puis le supprime', async () => {
    const country = await createCountry('FR', 'EUR', '20');
    const saved = await calculationService.saveInternational({
      costPrice: '20',
      target: { type: 'AMOUNT', value: '5' },
      fees: [],
      countryId: country.id,
      vatRatePercent: null,
      productId: null,
      label: 'Test',
    });
    expect(saved.priceInclTax.toString()).toBe('30');
    expect(saved.profit?.toString()).toBe('5');
    expect(await historyService.list({ search: 'test' })).toHaveLength(1);
    await historyService.delete(saved.id);
    expect(await historyService.list({})).toHaveLength(0);
  });

  it('exige un taux de change pour une devise étrangère', async () => {
    const swiss = await createCountry('CH', 'CHF', '8.1');
    const input = {
      costPrice: '20',
      target: { type: 'AMOUNT' as const, value: '5' },
      fees: [],
      countryId: swiss.id,
      vatRatePercent: null,
      productId: null,
      label: null,
    };
    await expect(calculationService.international(input)).rejects.toThrow(/taux de change/);
    await exchangeRateService.upsert({
      currencyCode: 'CHF',
      rate: '0.94',
      source: null,
      rateDate: new Date(),
    });
    expect((await calculationService.international(input)).sale.priceExclTax).toBe('23.50');
  });

  it('compare plusieurs pays', async () => {
    const fr = await createCountry('FR', 'EUR', '20');
    const de = await createCountry('DE', 'EUR', '19');
    const rows = await calculationService.compare({
      costPrice: '20',
      target: { type: 'AMOUNT', value: '5' },
      fees: [],
      countryIds: [fr.id, de.id],
      productId: null,
      label: null,
    });
    expect(rows.map((r) => (r.ok ? r.result.sale.priceInclTax : null)).sort()).toEqual([
      '29.75',
      '30.00',
    ]);
  });

  it('enregistre des ventes et calcule les statistiques par pays et entrepôt', async () => {
    const fr = await createCountry('FR', 'EUR', '20');
    const warehouse = await warehouseService.create(
      warehouseSchema.parse({ name: 'Lyon', countryId: fr.id }),
    );
    const product = await productService.create(
      productSchema.parse({
        name: 'P',
        reference: 'P',
        purchasePrice: '18',
        costPrice: '20',
        warehouseId: warehouse.id,
      }),
    );
    await saleService.create(
      saleSchema.parse({
        saleDate: '2026-03-10',
        productId: product.id,
        countryId: fr.id,
        quantity: 2,
        unitPriceExclTax: '25',
      }),
    );
    await saleService.create(
      saleSchema.parse({
        saleDate: '2026-04-10',
        productId: product.id,
        countryId: fr.id,
        quantity: 1,
        unitPriceExclTax: '30',
      }),
    );

    const stats = await statsService.sales({});
    expect(stats.totals).toMatchObject({
      count: 2,
      quantity: 3,
      revenue: '80',
      vat: '16',
      profit: '20',
    });
    expect(stats.byCountry[0]).toMatchObject({ label: 'Pays FR', revenue: '80' });
    expect(stats.byWarehouse[0]).toMatchObject({ label: 'Lyon' });
    expect(stats.byMonth.map((m) => m.label)).toEqual(['2026-03', '2026-04']);
    expect((await statsService.sales({ from: new Date('2026-04-01') })).totals.revenue).toBe('30');

    // La suppression du produit conserve la vente (instantané).
    await productService.delete(product.id);
    expect((await saleService.list({}))[0]?.productName).toBe('P');
  });
});
