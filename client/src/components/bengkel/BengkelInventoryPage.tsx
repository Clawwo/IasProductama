import { InventoryPage } from "@/components/inventory/InventoryPage";

export function BengkelInventoryPage({ readOnly }: { readOnly?: boolean }) {
  return (
    <InventoryPage
      readOnly={readOnly}
      dataSource="raw-materials"
      fixedCategory="Bahan Baku"
      title="Stok Bengkel"
    />
  );
}
