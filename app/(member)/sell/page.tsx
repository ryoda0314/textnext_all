import type { Metadata } from "next";
import { ItemFormClient } from "@/components/sell/item-form-client";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "出品する" };

export default function SellPage() {
  return (
    <>
      <PageHeader title="教科書を出品" back="/" />
      <ItemFormClient />
    </>
  );
}
