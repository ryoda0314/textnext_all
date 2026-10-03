import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { TERMS_TEXT } from "@/lib/legal";

export const metadata: Metadata = { title: "利用規約" };

export default function TermsPage() {
  return <LegalDocument text={TERMS_TEXT} />;
}
