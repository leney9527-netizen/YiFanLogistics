"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function AdminEditor({ section, role }: { section: string; role: string }) {
  const t = useTranslations("admin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? t("saved") : data.error?.code ?? "request_failed");
    if (response.ok) window.location.reload();
  }

  if (section === "import") {
    return (
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        const response = await fetch("/api/admin/preview-import", { method: "POST", body: form });
        const data = await response.json();
        setBusy(false);
        setMessage(response.ok ? `${data.errorCount} / ${data.batchId}` : "request_failed");
      }}>
        <a className="btn quiet" href="/api/admin/template">{t("template")}</a>
        <input name="file" type="file" accept=".xlsx" required />
        <button className="btn primary" disabled={busy}>{t("preview")}</button>
        <p>{message}</p>
      </form>
    );
  }

  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      const action = String(form.get("action") || section);
      void send(action, payload);
    }}>
      <input name="action" type="hidden" value={actionFor(section)} />
      {section === "ports" ? <PortFields /> : null}
      {section === "carriers" ? <CarrierFields /> : null}
      {section === "rates" ? <RateFields role={role} /> : null}
      {section === "fx" ? <FxFields /> : null}
      {section === "inquiries" ? <InquiryFields /> : null}
      {section === "staff" && role === "admin" ? <StaffFields /> : null}
      {section === "settings" && role === "admin" ? <SettingsFields /> : null}
      <button className="btn primary" disabled={busy} aria-busy={busy}>{t("save")}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

function actionFor(section: string) {
  if (section === "ports") return "save-port";
  if (section === "carriers") return "save-carrier";
  if (section === "rates") return "save-rate";
  if (section === "fx") return "save-fx";
  if (section === "inquiries") return "update-inquiry";
  if (section === "staff") return "save-staff";
  if (section === "settings") return "save-settings";
  return "noop";
}

function PortFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Code</span><input name="code" required /></label>
      <label className="field"><span>中文</span><input name="nameZh" required /></label>
      <label className="field"><span>English</span><input name="nameEn" required /></label>
      <label className="field"><span>Français</span><input name="nameFr" required /></label>
      <label className="field"><span>Timezone</span><input name="timezone" placeholder="Asia/Shanghai" required /></label>
      <label className="field"><span>Kind</span><select name="kind"><option value="origin">origin</option><option value="destination">destination</option><option value="both">both</option></select></label>
      <label className="field"><span>Country</span><input name="country" defaultValue="CN" required /></label>
    </div>
  );
}

function CarrierFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Code</span><input name="code" required /></label>
      <label className="field"><span>Name</span><input name="name" required /></label>
    </div>
  );
}

function RateFields({ role }: { role: string }) {
  return (
    <div className="form-grid">
      <label className="field"><span>Route id</span><input name="routeId" required /></label>
      <label className="field"><span>Carrier id</span><input name="carrierId" required /></label>
      <label className="field"><span>Service</span><select name="serviceType"><option value="direct">direct</option><option value="transshipment">transshipment</option></select></label>
      <label className="field"><span>Currency</span><input name="currency" defaultValue="USD" /></label>
      <label className="field"><span>Valid from</span><input name="validFrom" type="date" required /></label>
      <label className="field"><span>Valid to</span><input name="validTo" type="date" required /></label>
      <label className="field"><span>Sell 20GP</span><input name="sell20" /></label>
      <label className="field"><span>Sell 40GP</span><input name="sell40" /></label>
      <label className="field"><span>Sell 40HQ</span><input name="sell40hq" /></label>
      <label className="field"><span>Cost 40HQ</span><input name="cost40hq" /></label>
      {role === "admin" ? <label className="field"><span>Publish id</span><input name="publishId" /></label> : null}
    </div>
  );
}

function FxFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Base</span><input name="base" defaultValue="USD" required /></label>
      <label className="field"><span>Quote</span><input name="quote" defaultValue="CNY" required /></label>
      <label className="field"><span>Rate</span><input name="rate" required /></label>
      <label className="field"><span>Source</span><input name="source" required /></label>
    </div>
  );
}

function InquiryFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Inquiry id</span><input name="inquiryId" required /></label>
      <label className="field"><span>Status</span>
        <select name="status"><option value="new">new</option><option value="contacted">contacted</option><option value="quoted">quoted</option><option value="won">won</option><option value="closed">closed</option></select>
      </label>
    </div>
  );
}

function StaffFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <label className="field"><span>Password</span><input name="password" type="password" required /></label>
      <label className="field"><span>Role</span><select name="role"><option value="sales">sales</option><option value="admin">admin</option></select></label>
    </div>
  );
}

function SettingsFields() {
  return (
    <div className="form-grid">
      <label className="field"><span>Phone</span><input name="phone" /></label>
      <label className="field"><span>Email</span><input name="email" /></label>
      <label className="field"><span>WhatsApp</span><input name="whatsapp" /></label>
      <label className="check"><input type="checkbox" name="requireLogin" />Require login</label>
    </div>
  );
}
