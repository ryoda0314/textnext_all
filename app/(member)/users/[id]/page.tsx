import { UserProfile } from "./user-profile";

export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const { id } = await params;
  return <UserProfile id={id} />;
}
