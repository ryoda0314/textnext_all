"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { orNull } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export function CreateUniversitySheet({ open, onClose, initialDomain = "" }: { open: boolean; onClose: () => void; initialDomain?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState(initialDomain.split(".")[0] ?? "");
  const [domain, setDomain] = useState(initialDomain);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    const supabase = getSupabase();
    const { data: id, error } = await supabase.rpc("admin_save_university", {
      p_id: orNull<string>(null),
      p_name: name.trim(),
      p_short_name: orNull<string>(null),
      p_slug: slug.trim(),
      p_status: "active",
      p_external_url: orNull<string>(null),
      p_price_cap_percent: 30,
      p_meetup_slots: orNull<never>(null),
      p_calil_system_id: orNull<string>(null),
      p_name_verified: true,
    });
    if (error || !id) {
      setSaving(false);
      toast(errorMessage(error, "作成できませんでした（スラッグの重複など）"), "error");
      return;
    }
    if (domain.trim()) {
      const { error: domainError } = await supabase.rpc("admin_set_domain", { p_domain: domain.trim(), p_university_id: id, p_include_subdomains: true });
      if (domainError) toast("ドメインを登録できませんでした", "error");
    }
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    onClose();
    router.push(`/admin/universities/${id}`);
  }

  return (
    <Sheet open={open} onClose={onClose} title="大学を追加" footer={<Button className="w-full" disabled={!name.trim() || !/^[a-z0-9-]{2,50}$/.test(slug.trim())} loading={saving} onClick={create}>作成</Button>}>
      <div className="space-y-4">
        <Field label="正式名称" htmlFor="u-name" required><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 〇〇大学" /></Field>
        <Field label="スラッグ" htmlFor="u-slug" required hint="英小文字・数字・ハイフン（例: keio）"><Input id="u-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} /></Field>
        <Field label="メールドメイン" htmlFor="u-domain" hint="サブドメインも含めて判定します（例: keio.jp → st.keio.jp も対象）"><Input id="u-domain" value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} placeholder="example.ac.jp" /></Field>
      </div>
    </Sheet>
  );
}
