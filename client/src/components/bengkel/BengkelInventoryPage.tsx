import { RawMaterialsPage } from "@/components/raw/RawMaterialsPage";

export function BengkelInventoryPage({ readOnly }: { readOnly?: boolean }) {
  return <RawMaterialsPage readOnly={readOnly} />;
}
