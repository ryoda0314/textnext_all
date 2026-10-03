import type { Database } from "@/lib/database.types";

type PublicSchema = Database["public"];
export type Row<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type ViewRow<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];

export type Profile = Row<"profiles">;
export type Item = Row<"items">;
export type Trade = Row<"trades">;
export type Message = Row<"messages">;
export type AppNotification = Row<"notifications">;
export type Wish = Row<"wishes">;
export type MarketItem = PublicSchema["Functions"]["search_items"]["Returns"][number];
export type MyTrade = ViewRow<"my_trades">;

export type ItemImage = { path: string; thumb?: string; w?: number; h?: number };

export type MeetupSlot = { id: string; label: string; hint?: string };
export type SlotChoice = { date: string; slot: string };
export type Spot = { id: string; name: string; description: string | null; campus_id: string | null };
export type Campus = { id: string; name: string };

export type Proposal = {
  by: string;
  slots: SlotChoice[];
  spot_ids: string[];
  other_place: string | null;
  note?: string | null;
  at: string;
};

export type UniversityContext = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  status: "active" | "external" | "closed";
  name_verified: boolean;
  price_cap_percent: number;
  meetup_slots: MeetupSlot[];
  has_library: boolean;
  campuses: Campus[];
  spots: Spot[];
};

export type SignupVerdict =
  | { ok: true; kind: "admin" }
  | {
      ok: true;
      kind: "member";
      university: { id: string | null; name: string; name_verified: boolean; is_new: boolean };
    }
  | {
      ok: false;
      reason: "invalid" | "blocked" | "external" | "closed" | "unsupported";
      message: string;
      university_name?: string;
      external_url?: string;
      domain?: string;
    };

export type MyContext = {
  user_id: string;
  email: string;
  is_admin: boolean;
  profile: Profile | null;
  settings: Row<"user_settings"> | null;
  restriction: { kind: "suspended" | "banned"; reason: string; ends_at: string | null } | null;
  signup: SignupVerdict | null;
  university: UniversityContext | null;
};

export type ItemWithSeller = Item & {
  seller: Pick<
    Profile,
    | "id"
    | "nickname"
    | "avatar_path"
    | "faculty"
    | "department"
    | "grade"
    | "rating_good"
    | "rating_normal"
    | "rating_bad"
    | "completed_trades"
    | "listings_paused"
    | "deleted_at"
  > | null;
  campus: { name: string } | null;
};

export function itemImages(images: unknown): ItemImage[] {
  return Array.isArray(images) ? (images as ItemImage[]).filter((i) => i && typeof i.path === "string") : [];
}
