"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type Category = "rates" | "quotes" | "account";

export function FaqBrowser({
  items,
}: {
  items: { category: Category; question: string; body: string }[];
}) {
  const t = useTranslations("faqPage");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [open, setOpen] = useState(0);
  const categories: { id: Category | "all"; label: string }[] = [
    { id: "all", label: t("all") },
    { id: "rates", label: t("rates") },
    { id: "quotes", label: t("quotes") },
    { id: "account", label: t("account") },
  ];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!needle) return true;
      return `${item.question} ${item.body}`.toLowerCase().includes(needle);
    });
  }, [items, query, category]);

  function chooseCategory(next: Category | "all") {
    setCategory(next);
    setOpen(0);
  }

  return (
    <>
      <section className="page-banner">
        <div className="wrap">
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
          <label className="faq-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              placeholder={t("search")}
              aria-label={t("search")}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(0);
              }}
            />
          </label>
        </div>
      </section>
      <section className="section">
        <div className="wrap faq-layout">
          <aside className="faq-cats">
            <h2>{t("categories")}</h2>
            {categories.map((item) => (
              <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => chooseCategory(item.id)}>
                {item.label}
              </button>
            ))}
          </aside>
          <div className="faq-list">
            {visible.length === 0 ? (
              <div className="stack">
                <p>{t("empty")}</p>
                <div className="home-actions-row">
                  <button className="btn quiet" type="button" onClick={() => { setQuery(""); setCategory("all"); setOpen(0); }}>{t("clear")}</button>
                  <Link className="btn primary" href="/contact">{t("helpButton")}</Link>
                </div>
              </div>
            ) : visible.map((item, index) => {
              const expanded = open === index;
              return (
                <div className={expanded ? "faq-item open" : "faq-item"} key={item.question}>
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? -1 : index)}>
                    <span>{item.question}</span>
                    <span aria-hidden="true">{expanded ? "–" : "+"}</span>
                  </button>
                  {expanded ? <p>{item.body}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="wrap">
          <div className="faq-help">
            <h2>{t("help")}</h2>
            <Link className="btn primary" href="/contact">{t("helpButton")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
