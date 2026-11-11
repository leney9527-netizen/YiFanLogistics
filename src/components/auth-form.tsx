"use client";

import { CaptchaField } from "@/components/captcha-field";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

const memory = new Map<string, string>();

function useMemory(key: string) {
  const [value, setValue] = useState(() => memory.get(key) ?? "");
  return {
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      memory.set(key, event.target.value);
      setValue(event.target.value);
    },
  };
}

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath: string }) {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const email = useMemory(`${mode}-email`);
  const password = useMemory(`${mode}-password`);
  const confirm = useMemory(`${mode}-confirm`);
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [code, setCode] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("loading");
    const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
        challengeId: form.get("challengeId"),
        answer: form.get("answer"),
        locale,
        next: nextPath,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setState("error");
      setCode(data.error?.code ?? "request_failed");
      return;
    }
    memory.delete(`${mode}-password`);
    memory.delete(`${mode}-confirm`);
    setState("success");
    window.location.assign(data.next || `/${locale}/account`);
  }

  const errorText = code && errors.has(code as "credentials") ? errors(code as "credentials") : code ? errors("request_failed") : "";

  return (
    <form className="stack auth-card" onSubmit={onSubmit} aria-busy={state === "loading"}>
      <h1 className="page-title" style={{ fontSize: 40 }}>{mode === "login" ? t("loginTitle") : t("registerTitle")}</h1>
      <label className="field">
        <span>{t("email")}</span>
        <input name="email" type="email" autoComplete="username" required value={email.value} onChange={email.onChange} />
      </label>
      <label className="field">
        <span>{t("password")}</span>
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password.value} onChange={password.onChange} />
      </label>
      {mode === "register" ? (
        <label className="field">
          <span>{t("confirmPassword")}</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" required value={confirm.value} onChange={confirm.onChange} />
        </label>
      ) : null}
      <p className="meta">{t("passwordHint")}</p>
      <CaptchaField purpose={mode} />
      {state === "error" ? <p className="alert error" role="alert">{errorText}</p> : null}
      <button className="btn primary" type="submit" disabled={state === "loading"} aria-busy={state === "loading"}>
        {state === "loading" ? t("working") : mode === "login" ? t("submitLogin") : t("submitRegister")}
      </button>
      {mode === "login" ? <a href={`/${locale}/register`}>{t("noAccount")}</a> : <a href={`/${locale}/login`}>{t("hasAccount")}</a>}
      <div>
        <h2 style={{ fontSize: 20 }}>{t("recoveryTitle")}</h2>
        <p className="meta">{t("recoveryBody")}</p>
      </div>
    </form>
  );
}
