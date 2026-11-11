"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SaveQuoteButton(props: {
  rateId: string;
  containerCode: string;
  quantity: number;
  readyDate: string;
  distanceKm: string;
  truckCount: string;
  locale: string;
}) {
  const t = useTranslations("quote");
  const errors = useTranslations("errors");
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function save() {
    setState("loading");
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rateId: props.rateId,
        containerCode: props.containerCode,
        quantity: props.quantity,
        readyDate: props.readyDate,
        distanceKm: props.distanceKm,
        truckCount: props.truckCount,
        locale: props.locale,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(errors("request_failed"));
      return;
    }
    setState("success");
    setMessage(t("saved", { number: data.number }));
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn primary" type="button" onClick={() => void save()} disabled={state === "loading"} aria-busy={state === "loading"}>
          {state === "loading" ? t("saving") : t("save")}
        </button>
        <button className="btn quiet" type="button" onClick={() => window.print()}>{t("print")}</button>
      </div>
      {message ? <p className={state === "error" ? "alert error" : "alert ok"} role="status">{message}</p> : null}
    </div>
  );
}
