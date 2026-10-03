import { UserAdmin } from "./user-admin";

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  return <UserAdmin id={id} />;
}
