import { EntityManager } from './EntityManager';

export interface WarehouseRow {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  isActive: boolean;
  countryId: string;
  country: { id: string; name: string; isoCode: string };
  _count: { products: number };
}

interface Props {
  initialRows: WarehouseRow[];
  countries: { id: string; name: string }[];
}

export default function WarehousesManager({ initialRows, countries }: Props) {
  return (
    <EntityManager<WarehouseRow>
      endpoint="/api/warehouses"
      entityLabel="Entrepôt"
      initialRows={initialRows}
      localSearch={(row) => `${row.name} ${row.address ?? ''} ${row.country.name}`}
      columns={[
        { header: 'Nom', render: (row) => <span className="font-medium">{row.name}</span> },
        { header: 'Pays', render: (row) => row.country.name },
        { header: 'Adresse', render: (row) => row.address ?? '—' },
        { header: 'Produits', render: (row) => row._count.products },
        {
          header: 'Statut',
          render: (row) => (
            <span
              className={`badge ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}
            >
              {row.isActive ? 'Actif' : 'Inactif'}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Nom', type: 'text', required: true },
        {
          name: 'countryId',
          label: 'Pays',
          type: 'select',
          required: true,
          options: countries.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: 'address', label: 'Adresse', type: 'text' },
        { name: 'isActive', label: 'Entrepôt actif', type: 'checkbox' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toForm={(row) => ({
        name: row?.name ?? '',
        countryId: row?.countryId ?? '',
        address: row?.address ?? '',
        isActive: row?.isActive ?? true,
        description: row?.description ?? '',
      })}
    />
  );
}
