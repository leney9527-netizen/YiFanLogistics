import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { readQuote } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import { formatDate, formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/types";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function SavedQuotePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await getActor();
  if (!actor) {
    redirect({ href: `/login?next=/${locale}/account/quotes/${id}`, locale });
    return null;
  }
  const quote = await readQuote(actor, id);
  if (!quote) notFound();
  const t = await getTranslations();
  const lang = locale as Locale;
  const snapshot = quote.snapshot;
  return (
    <article className="section">
      <div className="wrap stack">
        <p className="meta">{t("quote.number")}</p>
        <h1 className="page-title" style={{ fontSize: 44 }}>{quote.quote_number}</h1>
        <p>{t("quote.generated", { date: formatDate(snapshot.generatedAt, lang) })}</p>
        {quote.needsRevalidation ? <p className="alert info">{t("quote.revalidation")}</p> : null}
        <p>{snapshot.card.origin.name[lang]} → {snapshot.card.destination.name[lang]} · {snapshot.card.carrierName}</p>
        {snapshot.calculation.subtotals.map((item) => (
          <p key={item.currency}>{snapshot.calculation.totalKind === "known_subtotal" ? t("quote.knownSubtotal") : t("quote.listedTotal")} {formatMoney(item.amount, item.currency, lang)}</p>
        ))}
        <p className="meta">{t("quote.notAllIn")}</p>
        <a className="btn quiet no-print" href={`/api/quotes/${quote.id}/pdf`}>{t("quote.pdf")}</a>
      </div>
    </article>
  );
}
