"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

export function AccountForms({ actor }: { actor: { displayName: string | null; companyName: string | null; phone: string | null; whatsapp: string | null; locale: string } }) {
  const t = useTranslations();
  const locale = useLocale();
  const [profileState, setProfileState] = useState("");
  const [passwordState, setPasswordState] = useState("");

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        companyName: form.get("companyName"),
        phone: form.get("phone"),
        whatsapp: form.get("whatsapp"),
        locale: form.get("locale"),
      }),
    });
    setProfileState(response.ok ? t("account.saved") : t("errors.request_failed"));
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
        revokeOthers: form.get("revokeOthers") === "on",
      }),
    });
    const data = await response.json();
    setPasswordState(response.ok ? t("account.saved") : t(`errors.${data.error?.code ?? "request_failed"}`));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign(`/${locale}`);
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={saveProfile}>
        <h2>{t("account.profile")}</h2>
        <label className="field"><span>{t("account.displayName")}</span><input name="displayName" defaultValue={actor.displayName ?? ""} /></label>
        <label className="field"><span>{t("account.company")}</span><input name="companyName" defaultValue={actor.companyName ?? ""} /></label>
        <label className="field"><span>{t("account.phone")}</span><input name="phone" defaultValue={actor.phone ?? ""} /></label>
        <label className="field"><span>{t("account.whatsapp")}</span><input name="whatsapp" defaultValue={actor.whatsapp ?? ""} /></label>
        <label className="field"><span>{t("account.language")}</span>
          <select name="locale" defaultValue={actor.locale}>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        <button className="btn primary" type="submit">{t("account.save")}</button>
        {profileState ? <p role="status">{profileState}</p> : null}
      </form>
      <form className="stack" onSubmit={savePassword}>
        <h2>{t("account.password")}</h2>
        <label className="field"><span>{t("auth.currentPassword")}</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="field"><span>{t("auth.newPassword")}</span><input name="newPassword" type="password" autoComplete="new-password" required /></label>
        <label className="check"><input type="checkbox" name="revokeOthers" defaultChecked />{t("auth.revokeOthers")}</label>
        <button className="btn primary" type="submit">{t("account.save")}</button>
        {passwordState ? <p role="status">{passwordState}</p> : null}
      </form>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn quiet" type="button" onClick={() => void logout()}>{t("auth.logout")}</button>
        <button className="btn quiet" type="button" onClick={() => void fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revokeOnly: true }) })}>{t("auth.revoke")}</button>
      </div>
    </div>
  );
}
