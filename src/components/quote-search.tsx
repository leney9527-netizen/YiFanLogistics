"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

function Pending() {
  const t = useTranslations("search");
  const status = useFormStatus();
  if (!status.pending) return null;
  return (
    <div className="stack" role="status" aria-live="polite" style={{ marginTop: 14 }}>
      <span className="meta">{t("loading")}</span>
      <div className="skeleton" style={{ height: 18, width: 220 }} />
      <div className="skeleton" style={{ height: 84 }} />
    </div>
  );
}

function Submit() {
  const t = useTranslations("search");
  const status = useFormStatus();
  return (
    <button className="btn primary home-submit" type="submit" aria-busy={status.pending} disabled={status.pending}>
      {status.pending ? t("loading") : t("submit")}
    </button>
  );
}

export function QuoteSearch({
  action,
  ports,
  containers,
  values,
}: {
  action: string;
  ports: { code: string; name: string; kind: string }[];
  containers: { code: string; name: string }[];
  values: { origin: string; destination: string; container: string; quantity: string; date: string; sort: string };
}) {
  const t = useTranslations("search");
  const home = useTranslations("home");
  const origins = ports.filter((port) => port.kind === "origin" || port.kind === "both");
  const destinations = ports.filter((port) => port.kind === "destination" || port.kind === "both");
  return (
    <form id="quote" className="home-workbench" action={action} method="get">
      <h2>{home("workbench")}</h2>
      <input type="hidden" name="sort" value={values.sort || "price"} />
      <div className="home-form">
        <label className="field port">
          <span>{t("origin")}</span>
          <select id="origin-port" name="origin" defaultValue={values.origin} required>
            <option value="">{t("choose")}</option>
            {origins.map((port) => <option key={port.code} value={port.code}>{port.name}</option>)}
          </select>
        </label>
        <label className="field port">
          <span>{t("destination")}</span>
          <select name="destination" defaultValue={values.destination} required>
            <option value="">{t("choose")}</option>
            {destinations.map((port) => <option key={port.code} value={port.code}>{port.name}</option>)}
          </select>
        </label>
        <label className="field box">
          <span>{t("container")}</span>
          <select name="container" defaultValue={values.container} required>
            {containers.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select>
        </label>
        <label className="field qty">
          <span>{t("quantity")}</span>
          <input name="quantity" inputMode="numeric" min={1} max={40} defaultValue={values.quantity || "1"} required />
        </label>
        <label className="field date">
          <span>{t("readyDate")}</span>
          <input name="date" type="date" defaultValue={values.date} required />
        </label>
        <div className="submit"><Submit /></div>
      </div>
      <Pending />
    </form>
  );
}
