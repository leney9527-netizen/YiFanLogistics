import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { quoteCalculation } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import { formatDate, formatMoney, formatPortTime } from "@/lib/format";
import type { Locale } from "@/lib/types";
import { parseIsoDate, parseOptionalPositive, parseQuantity, todayIso } from "@/lib/validation";
import { SaveQuoteButton } from "@/components/save-quote";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; rateId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, rateId } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const quantity = parseQuantity(one("quantity")) ?? 1;
  const readyDate = parseIsoDate(one("date")) ?? todayIso();
  const distance = parseOptionalPositive(one("distance"), 5000);
  const trucks = parseOptionalPositive(one("trucks"), 40);
  const container = one("container") || "40HQ";
  const lang = locale as Locale;
  const t = await getTranslations();
  const actor = await getActor();
  const result = await quoteCalculation({
    rateId,
    containerCode: container,
    quantity,
    readyDate,
    distanceKm: distance === "invalid" ? null : distance,
    truckCount: trucks === "invalid" || trucks == null ? null : Math.round(trucks),
    actor,
  });
  if (!result.ok) {
    if (result.error === "login_required") return <section className="section"><div className="wrap"><p className="alert info">{t("results.loginRequired")}</p></div></section>;
    if (result.error === "unavailable") return <section className="section"><div className="wrap"><p className="alert error">{t("results.unavailable")}</p></div></section>;
    notFound();
  }
  const { card, calculation } = result;
  const priced = calculation.lines.filter((line) => line.status === "priced" || line.status === "included");
  const open = calculation.lines.filter((line) => line.status === "unconfirmed" || line.status === "not_offered");
  return (
    <article className="section">
      <div className="wrap stack">
        <p className="meta">{card.origin.name[lang]} → {card.destination.name[lang]}</p>
        <h1 className="page-title" style={{ fontSize: 48 }}>{card.carrierName}</h1>
        <p>{card.serviceType === "direct" ? t("results.direct") : t("results.transshipment")} · {t("quote.quantity", { count: quantity })}</p>
        <p className="meta">{t("quote.valid", { from: formatDate(card.validFrom, lang), to: formatDate(card.validTo, lang) })}</p>
        <section>
          <h2>{t("quote.schedule")}</h2>
          <p>{t("results.transit")}: {card.transitDaysMin ?? "—"} · {card.transitIsConfirmed ? t("results.confirmed") : t("results.reference")}</p>
          <p>{t("results.cutoff")}: {card.cutoffAt ? formatPortTime(card.cutoffAt, card.origin.timezone, lang) : "—"} · {card.cutoffIsConfirmed ? t("results.confirmed") : t("results.reference")}</p>
          <p>{t("results.etd")}: {card.etdAt ? formatPortTime(card.etdAt, card.origin.timezone, lang) : "—"} · {card.etdIsConfirmed ? t("results.confirmed") : t("results.reference")}</p>
        </section>
        <form className="panel no-print" action={`/${locale}/quotes/${rateId}`} method="get">
          <input type="hidden" name="container" value={container} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="date" value={readyDate} />
          <div className="form-grid">
            <label className="field span-2"><span>{t("quote.distance")}</span><input name="distance" defaultValue={one("distance")} inputMode="decimal" /></label>
            <label className="field span-2"><span>{t("quote.trucks")}</span><input name="trucks" defaultValue={one("trucks")} inputMode="numeric" /></label>
            <div className="span-2"><button className="btn quiet" type="submit">{t("quote.recalculate")}</button></div>
          </div>
        </form>
        <section>
          <h2>{t("quote.charges")}</h2>
          <div className="lines">
            {priced.map((line) => (
              <div className="line" key={line.code}>
                <div>{line.name[lang]}<div className="meta">{line.status === "included" ? t("quote.included") : t(`units.${line.billingUnit ?? "per_container"}`)}</div></div>
                <div />
                <div className="amount">{line.amount && line.currency ? formatMoney(line.amount, line.currency, lang) : t("quote.included")}</div>
              </div>
            ))}
          </div>
          {calculation.subtotals.map((item) => (
            <div className="total" key={item.currency}>
              <span>{calculation.totalKind === "known_subtotal" ? t("quote.knownSubtotal") : t("quote.listedTotal")}</span>
              <span>{formatMoney(item.amount, item.currency, lang)}</span>
            </div>
          ))}
          <p className="meta">{t("quote.notAllIn")}</p>
        </section>
        <section>
          <h2>{t("quote.excluded")}</h2>
          {open.map((line) => (
            <p key={line.code}>{line.name[lang]} · {t(`fees.${line.reason ?? "not_configured"}`)}</p>
          ))}
        </section>
        <section>
          <h2>{t("quote.reference")}</h2>
          {calculation.reference.total ? <p>{formatMoney(calculation.reference.total, calculation.reference.currency, lang)}</p> : null}
          {calculation.reference.ratesUsed.map((rate) => (
            <p className="meta" key={`${rate.base}${rate.quote}${rate.effectiveAt}`}>
              {t("quote.fxLine", { base: rate.base, quote: rate.quote, rate: rate.rate, source: rate.source, updated: formatDate(rate.effectiveAt, lang) })}
            </p>
          ))}
          {calculation.reference.missingCurrencies.map((currency) => <p key={currency}>{t("quote.fxMissing", { currency })}</p>)}
        </section>
        <div className="no-print">
          {actor ? <SaveQuoteButton rateId={rateId} containerCode={container} quantity={quantity} readyDate={readyDate} distanceKm={one("distance")} truckCount={one("trucks")} locale={lang} /> : <a className="btn primary" href={`/${locale}/login?next=/${locale}/quotes/${rateId}`}>{t("quote.loginToSave")}</a>}
        </div>
        <p className="meta">{t("quote.snapshot")}</p>
      </div>
    </article>
  );
}
