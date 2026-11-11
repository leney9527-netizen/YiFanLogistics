"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

export function ResultSort({ sort }: { sort: string }) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="field home-sort">
      <span>{t("sort")}</span>
      <select
        aria-label={t("sort")}
        value={sort}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", event.target.value);
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <option value="price">{t("price")}</option>
        <option value="transit">{t("transit")}</option>
      </select>
    </label>
  );
}
