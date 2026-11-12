import { EntityManager } from './EntityManager';
import { formatDate } from '@/utils/format';

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { products: number };
}

export default function CategoriesManager({ initialRows }: { initialRows: CategoryRow[] }) {
  return (
    <EntityManager<CategoryRow>
      endpoint="/api/categories"
      entityLabel="Catégorie"
      initialRows={initialRows}
      localSearch={(row) => `${row.name} ${row.description ?? ''}`}
      columns={[
        { header: 'Nom', render: (row) => <span className="font-medium">{row.name}</span> },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Produits', render: (row) => row._count.products },
        { header: 'Créée le', render: (row) => formatDate(row.createdAt) },
      ]}
      fields={[
        { name: 'name', label: 'Nom', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toForm={(row) => ({ name: row?.name ?? '', description: row?.description ?? '' })}
    />
  );
}
