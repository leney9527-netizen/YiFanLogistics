import { defaultTerms } from "@/content/defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/types";

export const instant = false;

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meta");
  const lang = locale as Locale;
  return (
    <section className="section">
      <div className="wrap prose">
        <h1 className="page-title" style={{ fontSize: 48 }}>{t("terms")}</h1>
        {defaultTerms.map((item) => (
          <article key={item.title.en}>
            <h2>{item.title[lang]}</h2>
            <p>{item.body[lang]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
