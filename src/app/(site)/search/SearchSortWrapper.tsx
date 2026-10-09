import { Suspense } from "react";
import SearchSort from "./SearchSort";

export default function SearchSortWrapper() {
  return (
    <Suspense fallback={<div className="h-10 w-32" />}>
      <SearchSort />
    </Suspense>
  );
}
