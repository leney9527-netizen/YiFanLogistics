import { InquiryForm } from "@/components/inquiry-form";
import { loadSearchOptions } from "@/lib/server/freight";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/types";

export const instant = false;

export default async function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const t = await getTranslations("inquiry");
  const lang = locale as Locale;
  const options = await loadSearchOptions();
  const ports = (options?.ports ?? []).map((port) => ({ code: port.code, name: port.name[lang], kind: port.kind }));
  const containers = (options?.containers ?? []).map((item) => ({ code: item.code, name: item.name[lang] }));
  return (
    <section className="section">
      <div className="wrap narrow" style={{ width: "min(860px, 100%)" }}>
        <h1 className="page-title" style={{ fontSize: 48 }}>{t("title")}</h1>
        <p className="lede">{t("lede")}</p>
        <InquiryForm
          ports={ports}
          containers={containers}
          defaults={{ origin: one("origin"), destination: one("destination"), container: one("container") || "40HQ", quantity: one("quantity") || "1", date: one("date") }}
        />
      </div>
    </section>
  );
}
