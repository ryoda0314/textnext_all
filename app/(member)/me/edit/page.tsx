"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { contextKey, useMember } from "@/components/session";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { orNull } from "@/lib/cn";
import { GRADES, LIMITS } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { ImageError, uploadAvatar } from "@/lib/images";
import { getSupabase } from "@/lib/supabase/client";

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const { profile, university, userId } = useMember();
  const [nickname, setNickname] = useState(profile.nickname);
  const [faculty, setFaculty] = useState(profile.faculty ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [grade, setGrade] = useState(profile.grade ?? "");
  const [campusId, setCampusId] = useState(profile.campus_id ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: suggestions } = useQuery({
    queryKey: ["affiliation-suggestions"],
    queryFn: async () => {
      const { data } = await getSupabase().rpc("affiliation_suggestions");
      return (data as unknown as { faculties: string[] }) ?? { faculties: [] };
    },
  });

  async function changeAvatar(file: File) {
    setUploading(true);
    try {
      setAvatarPath(await uploadAvatar(file, userId));
    } catch (e) {
      toast(e instanceof ImageError ? e.message : "画像をアップロードできませんでした", "error");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    const previousAvatar = profile.avatar_path;
    const { error } = await getSupabase()
      .from("profiles")
      .update({
        nickname: nickname.trim(),
        faculty: faculty.trim(),
        department: orNull(department.trim() || null),
        grade: orNull(grade || null),
        campus_id: orNull(campusId || null),
        bio: orNull(bio.trim() || null),
        avatar_path: avatarPath,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast(/profiles_nickname_unique|duplicate/.test(error.message) ? "このニックネームはすでに使われています" : errorMessage(error), "error");
      return;
    }
    if (previousAvatar && previousAvatar !== avatarPath) {
      getSupabase().storage.from("avatars").remove([previousAvatar]).catch(() => undefined);
    }
    await queryClient.invalidateQueries({ queryKey: contextKey });
    toast("プロフィールを更新しました");
    router.replace("/me");
  }

  const valid = nickname.trim().length >= LIMITS.nicknameMin && nickname.trim().length <= LIMITS.nicknameMax && faculty.trim().length > 0;

  return (
    <div>
      <PageHeader title="プロフィールを編集" back="/me" />
      <div className="mx-auto max-w-lg space-y-6 px-4 pb-10 pt-6 lg:px-0">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full" aria-label="プロフィール画像を変更">
            <Avatar path={avatarPath} name={nickname} seed={userId} size={96} />
            <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-4 border-bg bg-primary text-primary-fg">
              <Camera className="size-4" />
            </span>
          </button>
          {uploading && <p className="text-xs text-muted">アップロード中…</p>}
          {avatarPath && (
            <button type="button" className="text-xs font-bold text-muted underline" onClick={() => setAvatarPath(null)}>
              画像を外す
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) changeAvatar(f); e.target.value = ""; }} />
        </div>

        <Field label="ニックネーム" htmlFor="nickname" required counter={{ value: nickname.trim().length, max: LIMITS.nicknameMax }}>
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={LIMITS.nicknameMax} />
        </Field>
        <Field label="学部・研究科" htmlFor="faculty" required>
          <Input id="faculty" list="faculty-options" value={faculty} onChange={(e) => setFaculty(e.target.value)} maxLength={LIMITS.affiliationMax} />
          <datalist id="faculty-options">{suggestions?.faculties.map((f) => <option key={f} value={f} />)}</datalist>
        </Field>
        <Field label="学科・専攻" htmlFor="department">
          <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={LIMITS.affiliationMax} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="学年" htmlFor="grade">
            <Select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">未設定</option>
              {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
          </Field>
          {university.campuses.length > 0 && (
            <Field label="よく使うキャンパス" htmlFor="campus">
              <Select id="campus" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
                <option value="">未設定</option>
                {university.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <Field label="自己紹介" htmlFor="bio" counter={{ value: bio.length, max: LIMITS.bioMax }}>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bioMax} rows={3} placeholder="例: 工学部2年です。平日の昼休みなら図書館前で受け渡しできます。" />
        </Field>
        <Button size="lg" className="w-full" disabled={!valid || uploading} loading={saving} onClick={save}>保存する</Button>
      </div>
    </div>
  );
}
