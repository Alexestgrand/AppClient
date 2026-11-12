/** Statistiques du tableau de bord (montants en devise principale). */
import { prisma } from '@/lib/db';
import { saleRepository, type Period } from '@/repositories/sale.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { productRepository } from '@/repositories/product.repository';
import { warehouseRepository } from '@/repositories/warehouse.repository';

export interface SeriesPoint {
  label: string;
  revenue: string;
  profit: string;
  vat: string;
  quantity?: number;
}

const str = (value: { toString(): string } | null | undefined) => (value ?? 0).toString();

export const statsService = {
  async counts() {
    const [products, categories, warehouses, countries] = await Promise.all([
      productRepository.count(),
      categoryRepository.count(),
      warehouseRepository.count(),
      prisma.country.count({ where: { isActive: true } }),
    ]);
    return { products, categories, warehouses, countries };
  },

  async sales(period: Period) {
    const [totals, byCountry, byWarehouse, byProduct, byMonth, countries, warehouses] =
      await Promise.all([
        saleRepository.totals(period),
        saleRepository.byCountry(period),
        saleRepository.byWarehouse(period),
        saleRepository.byProduct(period),
        saleRepository.byMonth(period),
        prisma.country.findMany({ select: { id: true, name: true } }),
        prisma.warehouse.findMany({ select: { id: true, name: true } }),
      ]);
    const countryName = new Map(countries.map((c) => [c.id, c.name]));
    const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]));
    const byRevenue = (a: SeriesPoint, b: SeriesPoint) => Number(b.revenue) - Number(a.revenue);

    return {
      totals: {
        count: totals._count,
        quantity: totals._sum.quantity ?? 0,
        revenue: str(totals._sum.revenueExclTax),
        vat: str(totals._sum.vatCollected),
        cost: str(totals._sum.totalCost),
        fees: str(totals._sum.totalFees),
        profit: str(totals._sum.profit),
      },
      byCountry: byCountry
        .map((row) => ({
          label: countryName.get(row.countryId) ?? '—',
          revenue: str(row._sum.revenueExclTax),
          profit: str(row._sum.profit),
          vat: str(row._sum.vatCollected),
          quantity: row._sum.quantity ?? 0,
        }))
        .sort(byRevenue),
      byWarehouse: byWarehouse
        .map((row) => ({
          label: row.warehouseId ? (warehouseName.get(row.warehouseId) ?? '—') : 'Sans entrepôt',
          revenue: str(row._sum.revenueExclTax),
          profit: str(row._sum.profit),
          vat: str(row._sum.vatCollected),
          quantity: row._sum.quantity ?? 0,
        }))
        .sort(byRevenue),
      byProduct: byProduct.map((row) => ({
        label: row.productName,
        revenue: str(row._sum.revenueExclTax),
        profit: str(row._sum.profit),
        vat: str(row._sum.vatCollected),
        quantity: row._sum.quantity ?? 0,
      })),
      byMonth: byMonth.map((row) => ({
        label: row.month.toISOString().slice(0, 7),
        revenue: str(row.revenue),
        profit: str(row.profit),
        vat: str(row.vat),
      })),
    };
  },
};

export type SalesStats = Awaited<ReturnType<typeof statsService.sales>>;
