import { EntityManager } from './EntityManager';
import { formatDate, formatMoney } from '@/utils/format';

export interface ProductRow {
  id: string;
  name: string;
  reference: string;
  description: string | null;
  purchasePrice: string;
  costPrice: string | null;
  categoryId: string | null;
  warehouseId: string | null;
  category: { id: string; name: string } | null;
  warehouse: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  initialRows: ProductRow[];
  categories: Option[];
  warehouses: Option[];
  currency: string;
}

export default function ProductsManager({ initialRows, categories, warehouses, currency }: Props) {
  const toOptions = (items: Option[]) =>
    items.map((item) => ({ value: item.id, label: item.name }));
  return (
    <EntityManager<ProductRow>
      endpoint="/api/products"
      entityLabel="Produit"
      initialRows={initialRows}
      searchPlaceholder="Nom ou référence…"
      serverFilters={[
        { name: 'categoryId', label: 'Catégorie', options: toOptions(categories) },
        { name: 'warehouseId', label: 'Entrepôt', options: toOptions(warehouses) },
      ]}
      columns={[
        { header: 'Référence', render: (row) => <code className="text-sm">{row.reference}</code> },
        { header: 'Nom', render: (row) => <span className="font-medium">{row.name}</span> },
        {
          header: "Prix d'achat",
          render: (row) => formatMoney(row.purchasePrice, currency),
          className: 'text-right tabular-nums',
        },
        {
          header: 'Coût de revient',
          render: (row) => (row.costPrice ? formatMoney(row.costPrice, currency) : '—'),
          className: 'text-right tabular-nums',
        },
        { header: 'Catégorie', render: (row) => row.category?.name ?? '—' },
        { header: 'Entrepôt', render: (row) => row.warehouse?.name ?? '—' },
        { header: 'Modifié le', render: (row) => formatDate(row.updatedAt) },
      ]}
      fields={[
        { name: 'name', label: 'Nom', type: 'text', required: true },
        { name: 'reference', label: 'Référence', type: 'text', required: true },
        {
          name: 'purchasePrice',
          label: `Prix d'achat (${currency})`,
          type: 'decimal',
          required: true,
          placeholder: '0,00',
        },
        {
          name: 'costPrice',
          label: `Coût de revient (${currency})`,
          type: 'decimal',
          placeholder: '0,00',
          hint: "Prix d'achat + frais d'approche. À défaut, le prix d'achat est utilisé dans les calculs.",
        },
        { name: 'categoryId', label: 'Catégorie', type: 'select', options: toOptions(categories) },
        { name: 'warehouseId', label: 'Entrepôt', type: 'select', options: toOptions(warehouses) },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toForm={(row) => ({
        name: row?.name ?? '',
        reference: row?.reference ?? '',
        purchasePrice: row?.purchasePrice ?? '',
        costPrice: row?.costPrice ?? '',
        categoryId: row?.categoryId ?? '',
        warehouseId: row?.warehouseId ?? '',
        description: row?.description ?? '',
      })}
    />
  );
}
