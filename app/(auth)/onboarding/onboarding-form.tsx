"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { GRADES, LIMITS, TERMS_VERSION } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { orNull } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import type { MyContext } from "@/lib/types";

type Suggestions = { faculties: string[]; departments: { faculty: string; department: string }[] };

export function OnboardingForm({ ctx }: { ctx: MyContext }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const verdict = ctx.signup;
  const university = ctx.university;
  const isNewGroup = Boolean(verdict?.ok && verdict.kind === "member" && verdict.university.is_new);
  const universityName = university?.name ?? (verdict?.ok && verdict.kind === "member" ? verdict.university.name : "");
  const nameUnverified = isNewGroup || (university ? !university.name_verified : false);

  const [nickname, setNickname] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [campusId, setCampusId] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [nicknameCheck, setNicknameCheck] = useState<{ value: string; free: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: suggestions } = useQuery({
    queryKey: ["affiliation-suggestions"],
    queryFn: async () => {
      const { data } = await getSupabase().rpc("affiliation_suggestions");
      return (data as unknown as Suggestions) ?? { faculties: [], departments: [] };
    },
    enabled: Boolean(verdict?.ok),
  });

  useEffect(() => {
    const value = nickname.trim();
    if (value.length < LIMITS.nicknameMin) return;
    const timer = window.setTimeout(async () => {
      const { data } = await getSupabase().rpc("is_nickname_available", { p_nickname: value });
      setNicknameCheck({ value, free: Boolean(data) });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [nickname]);
  const nicknameFree = nicknameCheck && nicknameCheck.value === nickname.trim() ? nicknameCheck.free : null;

  const departments = useMemo(
    () => (suggestions?.departments ?? []).filter((d) => !faculty || d.faculty === faculty.trim()).map((d) => d.department),
    [suggestions, faculty],
  );

  if (verdict?.ok && verdict.kind === "admin" && !university) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">管理者アカウント</h1>
        <p className="text-sm leading-relaxed text-muted">このアカウントは運営用です。出品や取引は大学のメールアドレスで登録したアカウントで行ってください。</p>
        <ButtonLink href="/admin" size="lg" className="w-full">管理画面へ</ButtonLink>
        <SignOutButton className="w-full" />
      </div>
    );
  }

  if (!verdict?.ok) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">登録を完了できません</h1>
        <Notice tone="danger">{verdict?.message ?? "このメールアドレスの大学は現在利用できません。"}</Notice>
        <SignOutButton className="w-full" />
      </div>
    );
  }

  const valid =
    nickname.trim().length >= LIMITS.nicknameMin &&
    nickname.trim().length <= LIMITS.nicknameMax &&
    nicknameFree !== false &&
    faculty.trim().length > 0 &&
    grade !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await getSupabase().rpc("complete_profile", {
      p_nickname: nickname.trim(),
      p_faculty: faculty.trim(),
      p_department: orNull(department.trim() || null),
      p_grade: grade,
      p_campus_id: orNull(campusId || null),
      p_terms_version: TERMS_VERSION,
      p_university_name: officialName.trim() || undefined,
    });
    if (rpcError) {
      setSaving(false);
      setError(errorMessage(rpcError));
      return;
    }
    toast("ようこそ TextNext へ！");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <p className="text-xs text-success">メール認証が完了しました</p>
        <h1 className="mt-1 text-2xl font-bold">プロフィールを作成</h1>
        <div className="mt-4 border-y border-border py-3">
          <p className="text-xs text-muted">参加するマーケット</p>
          <p className="mt-0.5 truncate font-semibold">{universityName}</p>
        </div>
        {isNewGroup && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            この大学で最初の登録です。友達を誘うと、教科書が見つかりやすくなります。
          </p>
        )}
      </div>

      <Field
        label="ニックネーム"
        htmlFor="nickname"
        required
        counter={{ value: nickname.trim().length, max: LIMITS.nicknameMax }}
        error={nicknameFree === false ? "このニックネームはすでに使われています" : undefined}
        hint="取引相手に表示されます。本名である必要はありません"
      >
        <div className="relative">
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={LIMITS.nicknameMax} autoComplete="nickname" />
          {nicknameFree && <CheckCircle2 className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-success" />}
        </div>
      </Field>

      <Field label="学部・研究科" htmlFor="faculty" required hint="同じ学部の人の出品がホームに表示されます">
        <Input id="faculty" list="faculty-options" value={faculty} onChange={(e) => setFaculty(e.target.value)} maxLength={LIMITS.affiliationMax} placeholder="例: 工学部" />
        <datalist id="faculty-options">
          {suggestions?.faculties.map((f) => <option key={f} value={f} />)}
        </datalist>
      </Field>

      <Field label="学科・専攻" htmlFor="department">
        <Input id="department" list="department-options" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={LIMITS.affiliationMax} placeholder="例: 機械工学科（任意）" />
        <datalist id="department-options">
          {departments.map((d) => <option key={d} value={d} />)}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="学年" htmlFor="grade" required>
          <Select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="" disabled>選択</option>
            {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
        </Field>
        {university && university.campuses.length > 0 && (
          <Field label="よく使うキャンパス" htmlFor="campus">
            <Select id="campus" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              <option value="">未設定</option>
              {university.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {nameUnverified && (
        <Field label="大学の正式名称" htmlFor="official-name" hint="運営が確認してから表示名に反映します（任意）">
          <Input id="official-name" value={officialName} onChange={(e) => setOfficialName(e.target.value)} placeholder="例: 〇〇大学" maxLength={40} />
        </Field>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      <Button type="submit" size="lg" className="w-full" disabled={!valid} loading={saving}>
        はじめる
      </Button>
      <p className="text-center text-xs text-muted">登録時に同意した利用規約・プライバシーポリシーが適用されます</p>
    </form>
  );
}
