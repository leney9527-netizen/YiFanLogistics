"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

export function InquiryForm({
  ports,
  containers,
  defaults,
  variant = "full",
}: {
  ports: { code: string; name: string; kind: string }[];
  containers: { code: string; name: string }[];
  defaults: { origin: string; destination: string; container: string; quantity: string; date: string };
  variant?: "full" | "contact";
}) {
  const t = useTranslations("inquiry");
  const search = useTranslations("search");
  const errors = useTranslations("errors");
  const contact = useTranslations("contactPage");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const form = new FormData(event.currentTarget);
    form.set("locale", locale);
    const response = await fetch("/api/inquiries", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(errors((data.error?.code ?? "request_failed") as "request_failed"));
      return;
    }
    setState("success");
    setMessage(t("success", { number: data.number }));
    event.currentTarget.reset();
  }

  const origins = ports.filter((port) => port.kind !== "destination");
  const destinations = ports.filter((port) => port.kind !== "origin");
  const originSelect = (
    <label className="field"><span>{search("origin")}</span>
      <select name="origin" defaultValue={defaults.origin} required>
        <option value="">{search("choose")}</option>
        {origins.map((port) => <option key={port.code} value={port.code}>{port.name}</option>)}
      </select>
    </label>
  );
  const destinationSelect = (
    <label className="field"><span>{search("destination")}</span>
      <select name="destination" defaultValue={defaults.destination} required>
        <option value="">{search("choose")}</option>
        {destinations.map((port) => <option key={port.code} value={port.code}>{port.name}</option>)}
      </select>
    </label>
  );

  return (
    <form className={variant === "contact" ? "contact-form" : "stack"} onSubmit={onSubmit} aria-busy={state === "loading"}>
      {variant === "contact" ? (
        <div className="contact-fields">
          <label className="field"><span>{t("contactName")}</span><input name="contactName" required /></label>
          <label className="field"><span>{contact("company")}</span><input name="company" /></label>
          <label className="field"><span>{contact("phone")}</span><input name="phone" autoComplete="tel" /></label>
          <label className="field"><span>{search("readyDate")}</span><input name="readyDate" type="date" defaultValue={defaults.date} /></label>
          {originSelect}
          {destinationSelect}
          <label className="field contact-wide"><span>{contact("cargo")}</span><textarea name="cargo" required /></label>
          <div className="contact-wide contact-more">
            <label className="field"><span>{t("whatsapp")}</span><input name="whatsapp" /></label>
            <label className="field"><span>{search("container")}</span>
              <select name="container" defaultValue={defaults.container}>{containers.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select>
            </label>
            <label className="field"><span>{search("quantity")}</span><input name="quantity" defaultValue={defaults.quantity || "1"} required /></label>
            <label className="field"><span>{t("pieces")}</span><input name="pieces" inputMode="numeric" /></label>
            <label className="field"><span>{t("weight")}</span><input name="weight" inputMode="decimal" /></label>
            <label className="field"><span>{t("volume")}</span><input name="volume" inputMode="decimal" /></label>
            <label className="field contact-wide"><span>{t("special")}</span><input name="special" /></label>
            <label className="field contact-wide"><span>{t("address")}</span><input name="address" /></label>
          </div>
        </div>
      ) : (
      <div className="form-grid">
        <label className="field span-2"><span>{t("contactName")}</span><input name="contactName" required /></label>
        <label className="field span-2"><span>{t("company")}</span><input name="company" /></label>
        <label className="field span-2"><span>{t("phone")}</span><input name="phone" autoComplete="tel" /></label>
        <label className="field span-2"><span>{t("whatsapp")}</span><input name="whatsapp" /></label>
        {originSelect}
        {destinationSelect}
        <label className="field span-1"><span>{search("container")}</span>
          <select name="container" defaultValue={defaults.container}>{containers.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select>
        </label>
        <label className="field span-1"><span>{search("quantity")}</span><input name="quantity" defaultValue={defaults.quantity || "1"} required /></label>
        <label className="field span-2"><span>{search("readyDate")}</span><input name="readyDate" type="date" defaultValue={defaults.date} /></label>
        <label className="field span-2"><span>{t("cargo")}</span><input name="cargo" required /></label>
        <label className="field span-1"><span>{t("pieces")}</span><input name="pieces" inputMode="numeric" /></label>
        <label className="field span-1"><span>{t("weight")}</span><input name="weight" inputMode="decimal" /></label>
        <label className="field span-2"><span>{t("volume")}</span><input name="volume" inputMode="decimal" /></label>
        <label className="field span-2"><span>{t("special")}</span><input name="special" /></label>
        <label className="field span-2"><span>{t("address")}</span><input name="address" /></label>
      </div>
      )}
      <div className="checks">
        <label className="check"><input type="checkbox" name="trucking" />{t("trucking")}</label>
        <label className="check"><input type="checkbox" name="exportCustoms" />{t("exportCustoms")}</label>
        <label className="check"><input type="checkbox" name="destCustoms" />{t("destCustoms")}</label>
        <label className="check"><input type="checkbox" name="delivery" />{t("delivery")}</label>
      </div>
      <label className="field"><span>{t("notes")}</span><textarea name="notes" /></label>
      <label className="field"><span>{t("files")}</span><input name="files" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" /><span>{t("fileHint")}</span></label>
      {message ? <p className={state === "error" ? "alert error" : "alert ok"} role="status">{message}</p> : null}
      <button className="btn primary" disabled={state === "loading"} aria-busy={state === "loading"}>{state === "loading" ? (variant === "contact" ? contact("sending") : search("loading")) : (variant === "contact" ? contact("submit") : t("submit"))}</button>
    </form>
  );
}
