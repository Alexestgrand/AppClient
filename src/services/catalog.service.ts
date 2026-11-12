/** Catégories, entrepôts et produits. */
import type { z } from 'zod';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { categoryRepository } from '@/repositories/category.repository';
import { warehouseRepository } from '@/repositories/warehouse.repository';
import { productRepository, type ProductFilter } from '@/repositories/product.repository';
import type { categorySchema, productSchema, warehouseSchema } from '@/schemas/catalog';

export const categoryService = {
  list: () => categoryRepository.list(),
  create: (input: z.infer<typeof categorySchema>) => categoryRepository.create(input),
  async update(id: string, input: z.infer<typeof categorySchema>) {
    if (!(await categoryRepository.findById(id))) throw new NotFoundError('Catégorie');
    return categoryRepository.update(id, input);
  },
  /** Règle : suppression refusée si des produits y sont rattachés. */
  async delete(id: string) {
    if (!(await categoryRepository.findById(id))) throw new NotFoundError('Catégorie');
    const products = await categoryRepository.countProducts(id);
    if (products > 0) {
      throw new ConflictError(
        `Suppression impossible : ${products} produit(s) utilisent cette catégorie.`,
      );
    }
    await categoryRepository.delete(id);
  },
};

export const warehouseService = {
  list: () => warehouseRepository.list(),
  create: (input: z.infer<typeof warehouseSchema>) => warehouseRepository.create(input),
  async update(id: string, input: z.infer<typeof warehouseSchema>) {
    if (!(await warehouseRepository.findById(id))) throw new NotFoundError('Entrepôt');
    return warehouseRepository.update(id, input);
  },
  async delete(id: string) {
    if (!(await warehouseRepository.findById(id))) throw new NotFoundError('Entrepôt');
    const products = await warehouseRepository.countProducts(id);
    if (products > 0) {
      throw new ConflictError(
        `Suppression impossible : ${products} produit(s) sont rattachés à cet entrepôt.`,
      );
    }
    await warehouseRepository.delete(id);
  },
};

export const productService = {
  list: (filter: ProductFilter) => productRepository.list(filter),
  async get(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError('Produit');
    return product;
  },
  create: (input: z.infer<typeof productSchema>) => productRepository.create(input),
  async update(id: string, input: z.infer<typeof productSchema>) {
    await productService.get(id);
    return productRepository.update(id, input);
  },
  async delete(id: string) {
    await productService.get(id);
    // L'historique et les ventes conservent leur instantané (relation SetNull).
    await productRepository.delete(id);
  },
};

/** Coût de référence d'un produit : coût de revient, à défaut prix d'achat. */
export function productUnitCost(product: {
  costPrice: { toString(): string } | null;
  purchasePrice: { toString(): string };
}): string {
  return (product.costPrice ?? product.purchasePrice).toString();
}
