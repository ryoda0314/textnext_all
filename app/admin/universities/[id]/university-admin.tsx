"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { PageSpinner } from "@/components/ui/spinner";
import { orNull } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type { Row } from "@/lib/types";
import { useAdminDashboard } from "../../_components/dashboard";
import { AdminCard, AdminTitle } from "../../admin-shell";

type Detail = {
  university: Row<"universities">;
  domains: Row<"university_domains">[];
  campuses: Row<"campuses">[];
  spots: Row<"meetup_spots">[];
  name_suggestions: { name: string; count: number }[];
  members: number;
};

export function UniversityAdmin({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const supabase = getSupabase();
  const { data, isPending } = useQuery({
    queryKey: ["admin-university", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_university_detail", { p_university_id: id });
      if (error) throw error;
      return data as unknown as Detail | null;
    },
  });
  const dashboard = useAdminDashboard();

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-university", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  async function run(promise: PromiseLike<{ error: unknown }>, success: string) {
    const { error } = await promise;
    if (error) toast(errorMessage(error), "error");
    else {
      toast(success);
      reload();
    }
  }

  if (isPending) return <PageSpinner />;
  if (!data) return <p className="text-sm text-muted">見つかりません</p>;
  const u = data.university;

  return (
    <div className="space-y-5">
      <AdminTitle>
        {u.name} <span className="ml-2 align-middle text-sm font-bold text-muted">会員 {data.members}人</span>
      </AdminTitle>

      {data.name_suggestions.length > 0 && !u.name_verified && (
        <AdminCard title="会員からの大学名の提案">
          <ul className="space-y-2">
            {data.name_suggestions.map((s) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="font-bold">{s.name}</span>
                <Badge>{s.count}件</Badge>
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => run(supabase.rpc("admin_apply_university_name", { p_university_id: id, p_name: s.name, p_short_name: orNull<string>(null) }), "大学名を設定しました")}>
                  この名前にする
                </Button>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      {/* Remount with fresh values whenever the university row changes (e.g. a name suggestion was applied). */}
      <BasicForm key={u.updated_at} university={u} onSaved={reload} />

      <AdminCard title="メールドメイン">
        <ul className="divide-y divide-border">
          {data.domains.map((d) => (
            <li key={d.domain} className="flex items-center gap-3 py-2 text-sm">
              <span className="font-mono font-bold">{d.domain}</span>
              {d.include_subdomains && <Badge>サブドメイン含む</Badge>}
              <button type="button" className="ml-auto text-danger" aria-label="削除" onClick={async () => {
                if (await confirm({ title: `${d.domain} を外しますか？`, message: "このドメインの新規登録ができなくなります（既存会員はそのまま）。", danger: true, confirmLabel: "外す" })) {
                  run(supabase.rpc("admin_remove_domain", { p_domain: d.domain }), "ドメインを外しました");
                }
              }}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <AddDomain onAdd={(domain, sub) => run(supabase.rpc("admin_set_domain", { p_domain: domain, p_university_id: id, p_include_subdomains: sub }), "ドメインを登録しました")} />
      </AdminCard>

      <AdminCard title="キャンパス">
        <ul className="divide-y divide-border">
          {data.campuses.map((c) => (
            <EditableRow key={c.id} name={c.name} active={c.is_active} sort={c.sort_order}
              onSave={(name, active, sort) => run(supabase.rpc("admin_save_campus", { p_id: c.id, p_university_id: id, p_name: name, p_sort_order: sort, p_is_active: active }), "保存しました")} />
          ))}
        </ul>
        <AddRow placeholder="キャンパス名（例: 本郷キャンパス）" onAdd={(name) => run(supabase.rpc("admin_save_campus", { p_id: orNull<string>(null), p_university_id: id, p_name: name, p_sort_order: (data.campuses.length + 1) * 10, p_is_active: true }), "キャンパスを追加しました")} />
      </AdminCard>

      <AdminCard title="受け渡し場所">
        <ul className="divide-y divide-border">
          {data.spots.map((s) => (
            <li key={s.id} className="py-2">
              <EditableRow name={s.name} active={s.is_active} sort={s.sort_order}
                extra={data.campuses.length > 0 ? `キャンパス: ${data.campuses.find((c) => c.id === s.campus_id)?.name ?? "全キャンパス"}` : undefined}
                onSave={(name, active, sort) => run(supabase.rpc("admin_save_spot", { p_id: s.id, p_university_id: id, p_campus_id: orNull(s.campus_id), p_name: name, p_description: orNull(s.description), p_sort_order: sort, p_is_active: active }), "保存しました")} />
            </li>
          ))}
        </ul>
        <AddSpot campuses={data.campuses} onAdd={(name, campusId) => run(supabase.rpc("admin_save_spot", { p_id: orNull<string>(null), p_university_id: id, p_campus_id: orNull(campusId), p_name: name, p_description: orNull<string>(null), p_sort_order: (data.spots.length + 1) * 10, p_is_active: true }), "場所を追加しました")} />
      </AdminCard>

      <AdminCard title="統合（重複したグループをまとめる）">
        <p className="mb-3 text-xs leading-relaxed text-muted">この大学の会員・出品・取引・ドメインをすべて別の大学へ移し、この大学を削除します。元に戻せません。</p>
        <MergeForm
          options={(dashboard.data?.universities ?? []).filter((x) => x.id !== id)}
          onMerge={async (target, targetName) => {
            if (!(await confirm({ title: `${u.name} を ${targetName} に統合しますか？`, message: "この操作は元に戻せません。", danger: true, confirmLabel: "統合する" }))) return;
            const { error } = await supabase.rpc("admin_merge_universities", { p_source: id, p_target: target });
            if (error) toast(errorMessage(error), "error");
            else {
              toast("統合しました");
              queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
              router.replace(`/admin/universities/${target}`);
            }
          }}
        />
      </AdminCard>
    </div>
  );
}

function BasicForm({ university: u, onSaved }: { university: Row<"universities">; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState(() => ({
    name: u.name,
    short_name: u.short_name ?? "",
    slug: u.slug,
    status: u.status,
    external_url: u.external_url ?? "",
    price_cap_percent: String(u.price_cap_percent),
    calil_system_id: u.calil_system_id ?? "",
    name_verified: u.name_verified,
    meetup_slots: JSON.stringify(u.meetup_slots, null, 2),
  }));
  const [saving, setSaving] = useState(false);

  async function save() {
    let slots: unknown;
    try {
      slots = JSON.parse(form.meetup_slots);
    } catch {
      toast("時間帯のJSONが正しくありません", "error");
      return;
    }
    setSaving(true);
    const { error } = await getSupabase().rpc("admin_save_university", {
      p_id: u.id,
      p_name: form.name.trim(),
      p_short_name: orNull(form.short_name.trim() || null),
      p_slug: form.slug.trim(),
      p_status: form.status,
      p_external_url: orNull(form.external_url.trim() || null),
      p_price_cap_percent: Number(form.price_cap_percent),
      p_meetup_slots: slots as never,
      p_calil_system_id: orNull(form.calil_system_id.trim() || null),
      p_name_verified: form.name_verified,
    });
    setSaving(false);
    if (error) toast(errorMessage(error, "保存できませんでした（入力値を確認してください）"), "error");
    else {
      toast("保存しました");
      onSaved();
    }
  }

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <AdminCard title="基本情報">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="正式名称" htmlFor="name"><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="略称" htmlFor="short"><Input id="short" value={form.short_name} onChange={(e) => set("short_name", e.target.value)} placeholder="例: 東大" /></Field>
        <Field label="スラッグ" htmlFor="slug"><Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></Field>
        <Field label="状態" htmlFor="status" hint="external: 別サービスへ案内 / closed: 新規登録停止">
          <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">active（稼働）</option>
            <option value="external">external（別サービスへ）</option>
            <option value="closed">closed（停止）</option>
          </Select>
        </Field>
        <Field label="案内先URL（externalのとき）" htmlFor="ext"><Input id="ext" value={form.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://" /></Field>
        <Field label="価格上限（定価の%）" htmlFor="cap"><Input id="cap" inputMode="numeric" value={form.price_cap_percent} onChange={(e) => set("price_cap_percent", e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="カーリル システムID" htmlFor="calil" hint="例: Univ_Titech。設定すると商品ページに図書館の蔵書状況を表示"><Input id="calil" value={form.calil_system_id} onChange={(e) => set("calil_system_id", e.target.value)} /></Field>
        <label className="flex items-center gap-2.5 self-end pb-3 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={form.name_verified} onChange={(e) => set("name_verified", e.target.checked)} />
          大学名を確認済み（トップページに掲載）
        </label>
      </div>
      <Field label="受け渡しの時間帯（JSON）" htmlFor="slots" className="mt-4" hint='例: [{"id":"lunch","label":"昼休み","hint":"12〜13時"}]。idは変更すると過去の候補表示に影響します'>
        <Textarea id="slots" value={form.meetup_slots} onChange={(e) => set("meetup_slots", e.target.value)} rows={8} className="font-mono text-xs" style={{ fontSize: 12 }} />
      </Field>
      <Button className="mt-4" loading={saving} onClick={save}>保存</Button>
    </AdminCard>
  );
}

function AddDomain({ onAdd }: { onAdd: (domain: string, sub: boolean) => void }) {
  const [domain, setDomain] = useState("");
  const [sub, setSub] = useState(true);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} placeholder="example.ac.jp" className="h-10 max-w-xs" />
      <label className="flex items-center gap-1.5 text-xs font-bold"><input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} />サブドメインも</label>
      <Button size="sm" icon={<Plus className="size-4" />} disabled={!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)} onClick={() => { onAdd(domain, sub); setDomain(""); }}>追加</Button>
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="h-10" maxLength={40} />
      <Button size="sm" className="h-10" icon={<Plus className="size-4" />} disabled={!name.trim()} onClick={() => { onAdd(name.trim()); setName(""); }}>追加</Button>
    </div>
  );
}

function AddSpot({ campuses, onAdd }: { campuses: Row<"campuses">[]; onAdd: (name: string, campusId: string | null) => void }) {
  const [name, setName] = useState("");
  const [campusId, setCampusId] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="場所の名前（例: 中央図書館前）" className="h-10 min-w-48 flex-1" maxLength={40} />
      {campuses.length > 0 && (
        <Select value={campusId} onChange={(e) => setCampusId(e.target.value)} className="h-10 w-44">
          <option value="">全キャンパス</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      <Button size="sm" className="h-10" icon={<Plus className="size-4" />} disabled={!name.trim()} onClick={() => { onAdd(name.trim(), campusId || null); setName(""); }}>追加</Button>
    </div>
  );
}

function EditableRow({ name: initialName, active: initialActive, sort: initialSort, extra, onSave }: { name: string; active: boolean; sort: number; extra?: string; onSave: (name: string, active: boolean, sort: number) => void }) {
  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [sort, setSort] = useState(String(initialSort));
  const dirty = name !== initialName || active !== initialActive || sort !== String(initialSort);
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 min-w-40 flex-1" style={{ fontSize: 14 }} maxLength={40} />
      <Input value={sort} onChange={(e) => setSort(e.target.value.replace(/[^\d-]/g, ""))} className="h-9 w-16 text-center" style={{ fontSize: 14 }} aria-label="並び順" />
      <label className="flex items-center gap-1.5 text-xs font-bold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />表示</label>
      {extra && <span className="text-xs text-muted">{extra}</span>}
      <Button size="sm" variant="secondary" className="h-9" disabled={!dirty || !name.trim()} onClick={() => onSave(name.trim(), active, Number(sort) || 0)}>保存</Button>
    </div>
  );
}

function MergeForm({ options, onMerge }: { options: { id: string; name: string }[]; onMerge: (target: string, name: string) => void }) {
  const [target, setTarget] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 max-w-sm">
        <option value="">統合先を選択</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
      <Button variant="danger" size="sm" className="h-10" disabled={!target} onClick={() => onMerge(target, options.find((o) => o.id === target)?.name ?? "")}>統合する</Button>
    </div>
  );
}
