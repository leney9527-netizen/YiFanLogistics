"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const LOCALES = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
] as const;

export function LanguageSelect() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);

  return (
    <label className="lang">
      <Globe />
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          setPending(true);
          const query = search.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { locale: next });
          if (document.cookie.includes("sb-")) {
            void fetch("/api/account/profile", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ locale: next }),
            });
          }
        }}
      >
        {LOCALES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
    </label>
  );
}

function Globe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.8 2.5 15.2 0 18M12 3c-2.5 2.8-2.5 15.2 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
