import { ItemDetail } from "./item-detail";

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}
