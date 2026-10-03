import { EditItem } from "./edit-item";

export default async function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  return <EditItem id={id} />;
}
