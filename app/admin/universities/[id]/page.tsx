import { UniversityAdmin } from "./university-admin";

export default async function AdminUniversityPage({ params }: PageProps<"/admin/universities/[id]">) {
  const { id } = await params;
  return <UniversityAdmin id={id} />;
}
