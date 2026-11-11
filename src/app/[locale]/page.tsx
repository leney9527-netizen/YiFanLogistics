import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroQuoteButton } from "@/components/hero-cta";
import { QuoteSearch } from "@/components/quote-search";
import { ResultSort } from "@/components/result-sort";
import { Link } from "@/i18n/navigation";
import { loadSearchOptions, searchPublicRates, type RateCard } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import { formatDate, formatMoney, formatPortTime } from "@/lib/format";
import type { Locale } from "@/lib/types";
import { parseIsoDate, parseQuantity, todayIso } from "@/lib/validation";

export const instant = false;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function Skeleton() {
  return (
    <div className="section">
      <div className="wrap stack">
        <div className="skeleton" style={{ height: 28, width: 220 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    </div>
  );
}

async function HomeContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations();
  const lang = locale as Locale;
  const options = await loadSearchOptions();
  const values = {
    origin: one(query.origin),
    destination: one(query.destination),
    container: one(query.container) || options?.containers[0]?.code || "40HQ",
    quantity: one(query.quantity) || "1",
    date: one(query.date) || todayIso(),
    sort: one(query.sort) === "transit" ? "transit" : "price",
  };
  const ports = (options?.ports ?? []).map((port) => ({ code: port.code, name: port.name[lang], kind: port.kind }));
  const containers = (options?.containers ?? [{ id: "", code: "40HQ", name: { zh: "40HQ", en: "40HQ", fr: "40HQ" } }]).map((item) => ({
    code: item.code,
    name: item.name[lang],
  }));
  const searched = Boolean(values.origin && values.destination && parseIsoDate(values.date) && parseQuantity(values.quantity));
  let result: Awaited<ReturnType<typeof searchPublicRates>> | null = null;
  if (searched && options) {
    result = await searchPublicRates({
      originCode: values.origin,
      destinationCode: values.destination,
      containerCode: values.container,
      readyDate: values.date,
      sort: values.sort as "price" | "transit",
      actor: await getActor(),
    });
  }
  const inquiryHref = `/inquiry?origin=${encodeURIComponent(values.origin)}&destination=${encodeURIComponent(values.destination)}&container=${encodeURIComponent(values.container)}&quantity=${encodeURIComponent(values.quantity)}&date=${encodeURIComponent(values.date)}`;
  const originName = ports.find((port) => port.code === values.origin)?.name ?? values.origin;
  const destinationName = ports.find((port) => port.code === values.destination)?.name ?? values.destination;
  const retryHref = `/${locale}?${new URLSearchParams({ origin: values.origin, destination: values.destination, container: values.container, quantity: values.quantity, date: values.date, sort: values.sort }).toString()}`;

  return (
    <>
      <section className="home-hero">
        <img className="home-hero-bg" src="/images/port-hero.webp" width={1600} height={1060} alt={t("home.photoAlt")} />
        <div className="wrap home-hero-copy">
          <h1>{t("home.heroTitle")}</h1>
          <p className="lede">{t("home.heroLede")}</p>
          <div className="home-actions">
            <HeroQuoteButton label={t("home.findRates")} />
            <Link className="btn home-secondary" href="/inquiry">{t("home.requestQuote")}</Link>
          </div>
        </div>
      </section>
      <section className="home-stage">
        <div className="wrap">
          <QuoteSearch action={`/${locale}`} ports={ports} containers={containers} values={values} />
          {!searched ? <p className="home-hint">{t("results.prompt")}</p> : null}
          {searched && (!options || (result && !result.ok && result.error !== "login_required")) ? (
            <div className="home-actions-row" style={{ marginTop: 10 }}>
              <p className="home-hint" style={{ margin: 0 }}>{t("results.unavailable")}</p>
              <a className="btn quiet" href={searched ? retryHref : `/${locale}`}>{t("results.retry")}</a>
              <Link className="btn quiet" href="/contact">{t("results.contact")}</Link>
            </div>
          ) : null}
          {searched ? (
            <div className="home-results" id="results">
              {result && !result.ok && result.error === "login_required" ? (
                <div className="home-actions-row">
                  <p className="home-hint" style={{ margin: 0 }}>{t("results.loginRequired")}</p>
                  <Link className="btn primary" href={`/login?next=/${locale}`}>{t("nav.login")}</Link>
                </div>
              ) : null}
              {result?.ok && result.demo ? <p className="alert info">{t("results.demo")}</p> : null}
              {result?.ok && result.cards.length === 0 ? (
                <div className="stack">
                  <h2>{t("results.empty")}</h2>
                  <p className="meta">{t("results.emptyBody")}</p>
                  <div className="home-actions-row">
                    <a className="btn quiet" href="#quote">{t("results.adjust")}</a>
                    <Link className="btn primary" href={inquiryHref}>{t("results.inquiry")}</Link>
                  </div>
                </div>
              ) : null}
              {result?.ok && result.cards.length > 0 ? (
                <>
                  <div className="home-result-head">
                    <div>
                      <h2>{t("results.title")}</h2>
                      <p className="meta">{t("results.summary", { origin: originName, destination: destinationName, container: values.container, quantity: values.quantity, date: values.date })}</p>
                    </div>
                    <ResultSort sort={values.sort} />
                  </div>
                  <RateViews cards={result.cards} locale={lang} quantity={values.quantity} date={values.date} />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <section className="section home-shortcuts-section">
        <div className="wrap">
          <nav className="home-shortcuts" aria-label={t("home.servicesTitle")}>
            <a href="#quote"><IconBoxes />{t("home.shortQuote")}</a>
            <a href={searched ? "#results" : "#quote"}><IconScale />{t("home.shortCompare")}</a>
            <Link href="/inquiry"><IconPerson />{t("home.shortInquiry")}</Link>
          </nav>
        </div>
      </section>
    </>
  );
}

function IconBoxes() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h6v6H4zM14 8h6v6h-6zM9 14h6v6H9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconScale() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v16M7 20h10M12 7l-5 6h4M12 7l5 6h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 19c1.2-3 3.2-4.2 6-4.2S16.8 16 18 19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

async function RateViews({ cards, locale, quantity, date }: { cards: RateCard[]; locale: Locale; quantity: string; date: string }) {
  const t = await getTranslations("results");
  return (
    <>
      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>{t("title")}</th>
              <th className="num">20GP</th>
              <th className="num">40GP</th>
              <th className="num">40HQ</th>
              <th>{t("transit")}</th>
              <th>{t("cutoff")}</th>
              <th>{t("etd")}</th>
              <th>{t("validity")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>
                  <strong>{card.carrierName}</strong>
                  <div className="meta">{card.serviceType === "direct" ? t("direct") : t("transshipment")}</div>
                </td>
                {["20GP", "40GP", "40HQ"].map((code) => (
                  <td key={code} className={code === card.selectedCode ? "num selected price" : "num price"}>
                    {card.prices[code] ? formatMoney(card.prices[code] as string, card.currency, locale) : "—"}
                  </td>
                ))}
                <td>{card.transitDaysMin == null ? "—" : `${t("days", { count: card.transitDaysMin })} · ${card.transitIsConfirmed ? t("confirmed") : t("reference")}`}</td>
                <td>{card.cutoffAt ? `${formatPortTime(card.cutoffAt, card.origin.timezone, locale)} · ${card.cutoffIsConfirmed ? t("confirmed") : t("reference")}` : "—"}</td>
                <td>{card.etdAt ? `${formatPortTime(card.etdAt, card.origin.timezone, locale)} · ${card.etdIsConfirmed ? t("confirmed") : t("reference")}` : "—"}</td>
                <td>{formatDate(card.validTo, locale)}</td>
                <td><a className="btn quiet" href={`/${locale}/quotes/${card.id}?container=${card.selectedCode}&quantity=${quantity}&date=${date}`}>{t("view")}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {cards.map((card) => (
          <article className="rate-card" key={card.id}>
            <h3>{card.carrierName}</h3>
            <div className="tag">{card.serviceType === "direct" ? t("direct") : t("transshipment")}</div>
            <p className="price"><span className="meta">{t("selected")} {card.selectedCode} </span>
              <strong>{card.selectedSellAmount ? formatMoney(card.selectedSellAmount, card.currency, locale) : "—"}</strong>
            </p>
            <p className="meta">{card.transitDaysMin == null ? null : t("days", { count: card.transitDaysMin })} · {card.transitIsConfirmed ? t("confirmed") : t("reference")}</p>
            <details>
              <summary>{t("expand")}</summary>
              {["20GP", "40GP", "40HQ"].map((code) => (
                <div key={code} className="meta">{code}: {card.prices[code] ? formatMoney(card.prices[code] as string, card.currency, locale) : "—"}</div>
              ))}
            </details>
            <a className="btn primary" href={`/${locale}/quotes/${card.id}?container=${card.selectedCode}&quantity=${quantity}&date=${date}`}>{t("view")}</a>
          </article>
        ))}
      </div>
    </>
  );
}

export default function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Skeleton />}>
      <HomeContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
