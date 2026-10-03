import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "さがす" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
