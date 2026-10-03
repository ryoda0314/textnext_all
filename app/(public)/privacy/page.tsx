import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { PRIVACY_TEXT } from "@/lib/legal";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return <LegalDocument text={PRIVACY_TEXT} />;
}
