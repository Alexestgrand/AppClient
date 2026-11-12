/**
 * Initialisation de la base.
 *
 * 1. Toujours : paramètres par défaut + pays de référence.
 *    Les taux de TVA proviennent de la base officielle TEDB de la Commission européenne
 *    (et des administrations suisse / britannique). Ils sont insérés SANS date de
 *    vérification : ils apparaissent « À vérifier » tant que l'administrateur ne les a
 *    pas contrôlés lui-même. Les pays existants ne sont jamais écrasés.
 * 2. Si ADMIN_EMAIL et ADMIN_PASSWORD sont définis et qu'aucun compte n'existe : création de l'admin.
 * 3. Si SEED_DEMO=true : données de démonstration (catégories, entrepôts, produits, ventes,
 *    taux de change FICTIFS clairement étiquetés). À ne pas utiliser en production.
 */
import { PrismaClient, type VatRateType } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { computeSaleFinancials } from '../src/domain/sales';

const prisma = new PrismaClient();

const TEDB = {
  taxSource: 'Commission européenne — Taxes in Europe Database (TEDB)',
  taxSourceUrl: 'https://ec.europa.eu/taxation_customs/tedb/',
};

type Rate = [label: string, type: VatRateType, rate: string];
const COUNTRIES: {
  name: string;
  isoCode: string;
  currencyCode: string;
  source: { taxSource: string; taxSourceUrl: string };
  rates: Rate[];
}[] = [
  {
    name: 'France',
    isoCode: 'FR',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '20'],
      ['Taux intermédiaire', 'REDUCED', '10'],
      ['Taux réduit', 'REDUCED', '5.5'],
      ['Taux particulier', 'SUPER_REDUCED', '2.1'],
    ],
  },
  {
    name: 'Belgique',
    isoCode: 'BE',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '21'],
      ['Taux réduit', 'REDUCED', '12'],
      ['Taux réduit', 'REDUCED', '6'],
    ],
  },
  {
    name: 'Allemagne',
    isoCode: 'DE',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '19'],
      ['Taux réduit', 'REDUCED', '7'],
    ],
  },
  {
    name: 'Espagne',
    isoCode: 'ES',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '21'],
      ['Taux réduit', 'REDUCED', '10'],
      ['Taux super-réduit', 'SUPER_REDUCED', '4'],
    ],
  },
  {
    name: 'Italie',
    isoCode: 'IT',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '22'],
      ['Taux réduit', 'REDUCED', '10'],
      ['Taux réduit', 'REDUCED', '5'],
      ['Taux super-réduit', 'SUPER_REDUCED', '4'],
    ],
  },
  {
    name: 'Pays-Bas',
    isoCode: 'NL',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '21'],
      ['Taux réduit', 'REDUCED', '9'],
    ],
  },
  {
    name: 'Luxembourg',
    isoCode: 'LU',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '17'],
      ['Taux intermédiaire', 'REDUCED', '14'],
      ['Taux réduit', 'REDUCED', '8'],
      ['Taux super-réduit', 'SUPER_REDUCED', '3'],
    ],
  },
  {
    name: 'Portugal (continental)',
    isoCode: 'PT',
    currencyCode: 'EUR',
    source: TEDB,
    rates: [
      ['Taux normal', 'STANDARD', '23'],
      ['Taux intermédiaire', 'REDUCED', '13'],
      ['Taux réduit', 'REDUCED', '6'],
    ],
  },
  {
    name: 'Suisse',
    isoCode: 'CH',
    currencyCode: 'CHF',
    source: {
      taxSource: 'Administration fédérale des contributions (AFC)',
      taxSourceUrl: 'https://www.estv.admin.ch/',
    },
    rates: [
      ['Taux normal', 'STANDARD', '8.1'],
      ['Taux spécial hébergement', 'REDUCED', '3.8'],
      ['Taux réduit', 'REDUCED', '2.6'],
    ],
  },
  {
    name: 'Royaume-Uni',
    isoCode: 'GB',
    currencyCode: 'GBP',
    source: {
      taxSource: 'GOV.UK — VAT rates',
      taxSourceUrl: 'https://www.gov.uk/guidance/rates-of-vat-on-different-goods-and-services',
    },
    rates: [
      ['Taux normal', 'STANDARD', '20'],
      ['Taux réduit', 'REDUCED', '5'],
      ['Taux zéro', 'ZERO', '0'],
    ],
  },
];

async function seedReference() {
  await prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  for (const country of COUNTRIES) {
    const exists = await prisma.country.findUnique({ where: { isoCode: country.isoCode } });
    if (exists) continue;
    await prisma.country.create({
      data: {
        name: country.name,
        isoCode: country.isoCode,
        currencyCode: country.currencyCode,
        ...country.source,
        lastVerifiedAt: null,
        vatRates: { create: country.rates.map(([label, type, rate]) => ({ label, type, rate })) },
      },
    });
  }
  console.log(`✔ Paramètres et ${COUNTRIES.length} pays de référence (taux « à vérifier »).`);
}

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD)
    return console.log(
      'ℹ ADMIN_EMAIL / ADMIN_PASSWORD absents : aucun compte créé (utilisez `pnpm admin:create`).',
    );
  if (await prisma.user.count()) return console.log('ℹ Compte administrateur déjà présent.');
  await prisma.user.create({
    data: { email: ADMIN_EMAIL.toLowerCase(), passwordHash: await hashPassword(ADMIN_PASSWORD) },
  });
  console.log(`✔ Compte administrateur créé : ${ADMIN_EMAIL}`);
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed démo : ${what} introuvable.`);
  return value;
}

async function seedDemo() {
  if (await prisma.product.count())
    return console.log('ℹ Des produits existent déjà : données de démonstration ignorées.');
  const DEMO = 'DÉMO — valeur fictive à remplacer';
  await prisma.exchangeRate.createMany({
    data: [
      { currencyCode: 'CHF', rate: '0.94', source: DEMO, rateDate: new Date() },
      { currencyCode: 'GBP', rate: '0.85', source: DEMO, rateDate: new Date() },
    ],
    skipDuplicates: true,
  });
  const [home, deco] = await Promise.all([
    prisma.category.create({ data: { name: 'Maison', description: 'Démo' } }),
    prisma.category.create({ data: { name: 'Décoration', description: 'Démo' } }),
  ]);
  const countries = await prisma.country.findMany({ include: { vatRates: true } });
  const byIso = (iso: string) =>
    required(
      countries.find((c) => c.isoCode === iso),
      `pays ${iso}`,
    );
  const [lyon, madrid] = await Promise.all([
    prisma.warehouse.create({
      data: { name: 'Entrepôt Lyon', countryId: byIso('FR').id, address: 'Lyon (démo)' },
    }),
    prisma.warehouse.create({
      data: { name: 'Entrepôt Madrid', countryId: byIso('ES').id, address: 'Madrid (démo)' },
    }),
  ]);
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Lampe de bureau',
        reference: 'DEMO-001',
        purchasePrice: '18',
        costPrice: '20',
        categoryId: home.id,
        warehouseId: lyon.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Vase céramique',
        reference: 'DEMO-002',
        purchasePrice: '9.5',
        costPrice: '11',
        categoryId: deco.id,
        warehouseId: madrid.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Coussin lin',
        reference: 'DEMO-003',
        purchasePrice: '7',
        costPrice: null,
        categoryId: deco.id,
        warehouseId: lyon.id,
      },
    }),
  ]);
  const rates: Record<string, string> = { EUR: '1', CHF: '0.94', GBP: '0.85' };
  const isos = ['FR', 'BE', 'DE', 'ES', 'IT', 'CH', 'GB'];
  // Générateur pseudo-aléatoire déterministe (démo reproductible).
  let seed = 42;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = new Date();
  for (let i = 0; i < 80; i++) {
    const product = required(products[Math.floor(random() * products.length)], 'produit');
    const country = byIso(required(isos[Math.floor(random() * isos.length)], 'code ISO'));
    const vat = required(
      country.vatRates.find((r) => r.type === 'STANDARD'),
      'taux standard',
    ).rate.toString();
    const rate = required(rates[country.currencyCode], 'taux de change');
    const unitCost = (product.costPrice ?? product.purchasePrice).toString();
    const unitPrice = ((Number(unitCost) + 5 + random() * 6) * Number(rate)).toFixed(2);
    const quantity = 1 + Math.floor(random() * 5);
    const saleDate = new Date(
      now.getFullYear(),
      now.getMonth() - Math.floor(random() * 6),
      1 + Math.floor(random() * 27),
    );
    const fin = computeSaleFinancials({
      quantity,
      unitPriceExclTax: unitPrice,
      vatRatePercent: vat,
      exchangeRate: rate,
      unitCost,
      fees: [{ type: 'PAYMENT', mode: 'PERCENT', base: 'TTC', value: '1.5' }],
      saleCurrency: country.currencyCode,
      mainCurrency: 'EUR',
    });
    await prisma.sale.create({
      data: {
        saleDate,
        productId: product.id,
        productName: product.name,
        countryId: country.id,
        warehouseId: product.warehouseId,
        quantity,
        currency: country.currencyCode,
        exchangeRate: rate,
        unitPriceExclTax: unitPrice,
        vatRate: vat,
        note: 'Démo',
        ...fin,
      },
    });
  }
  console.log('✔ Données de démonstration créées (taux de change et ventes FICTIFS).');
}

async function main() {
  await seedReference();
  await seedAdmin();
  if (process.env.SEED_DEMO === 'true') await seedDemo();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
