"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function CaptchaField({ purpose }: { purpose: "login" | "register" }) {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [image, setImage] = useState("");
  const [id, setId] = useState("");
  const [failed, setFailed] = useState(false);

  async function refresh() {
    setFailed(false);
    const response = await fetch("/api/auth/captcha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ purpose }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFailed(true);
      setImage("");
      setId("");
      return;
    }
    setImage(data.image);
    setId(data.challengeId);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [purpose]);

  return (
    <div className="field">
      <span>{t("captcha")}</span>
      <div className="captcha-row">
        {image ? <img src={image} alt={t("captchaAlt")} /> : <div className="skeleton" style={{ width: 188, height: 68 }} />}
        <button className="btn quiet" type="button" onClick={() => void refresh()}>{t("refresh")}</button>
      </div>
      <input name="challengeId" type="hidden" value={id} />
      <input name="answer" autoComplete="off" spellCheck={false} required aria-label={t("captcha")} />
      {failed ? <p className="alert error">{errors("unavailable")}</p> : null}
    </div>
  );
}
