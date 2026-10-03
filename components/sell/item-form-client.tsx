"use client";

import dynamic from "next/dynamic";
import { PageSpinner } from "@/components/ui/spinner";

/** The sell form restores drafts from localStorage, so it renders on the client only. */
export const ItemFormClient = dynamic(() => import("./item-form").then((m) => m.ItemForm), {
  ssr: false,
  loading: () => <PageSpinner />,
});
