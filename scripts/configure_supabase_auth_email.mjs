#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SENDER_EMAIL = "noreply@kinora.live";
const DEFAULT_SENDER_NAME = "Kinora";
const DEFAULT_SITE_URL = "http://localhost:5173";
const DEFAULT_RESET_URL = "http://localhost:5173/reset-password";
const DEFAULT_LOGIN_URL = "http://localhost:5173/login";
const DEFAULT_REGISTER_URL = "http://localhost:5173/register";
const DEFAULT_PRODUCTION_SITE_URL = "https://kinora.live";
const DEFAULT_PRODUCTION_RESET_URL = "https://kinora.live/reset-password";
const DEFAULT_PRODUCTION_LOGIN_URL = "https://kinora.live/login";
const DEFAULT_PRODUCTION_REGISTER_URL = "https://kinora.live/register";

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const entries = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function loadEnv() {
  return {
    ...parseEnvFile(resolve(".env")),
    ...parseEnvFile(resolve("server/.env")),
    ...parseEnvFile(resolve("client/.env")),
    ...process.env,
  };
}

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(env, key, fallback) {
  const value = env[key]?.trim();
  return value || fallback;
}

function deriveProjectRef(env) {
  const explicit = env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) {
    return explicit;
  }

  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  if (!url) {
    return "";
  }

  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".supabase.co")
      ? hostname.replace(".supabase.co", "")
      : "";
  } catch {
    return "";
  }
}

function uniqueCsv(values) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).join(",");
}

function buildAuthEmailTemplate({ title, intro, ctaLabel, ctaUrl, note }) {
  return `
<div style="background:#131a27;color:#ffffff;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:520px;margin:0 auto;border:1px solid #dfc56a;padding:28px">
    <p style="color:#dfc56a;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">
      Kinora
    </p>
    <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">${title}</h1>
    <p style="color:#c8ceda;font-size:15px;line-height:1.6;margin:0 0 24px">
      ${intro}
    </p>
    <p style="margin:0 0 24px">
      <a href="${ctaUrl}" style="display:inline-block;border:1px solid #dfc56a;color:#131a27;background:#dfc56a;padding:14px 20px;text-decoration:none;font-weight:700">
        ${ctaLabel}
      </a>
    </p>
    <p style="color:#7a8499;font-size:13px;line-height:1.5;margin:0">
      ${note}
    </p>
  </div>
</div>
`.trim();
}

function buildConfirmationTemplate() {
  return buildAuthEmailTemplate({
    title: "Confirm your Kinora account",
    intro: "Welcome to Kinora. Confirm your email address to finish creating your account.",
    ctaLabel: "Confirm email",
    ctaUrl: "{{ .ConfirmationURL }}",
    note: "If you did not create a Kinora account, you can ignore this email.",
  });
}

function buildRecoveryTemplate() {
  return buildAuthEmailTemplate({
    title: "Reset your Kinora password",
    intro: "We received a request to reset the password for your Kinora account.",
    ctaLabel: "Reset password",
    ctaUrl: "{{ .ConfirmationURL }}",
    note: "If you did not request this, you can ignore this email.",
  });
}

function redactedPayload(payload) {
  return {
    ...payload,
    smtp_pass: payload.smtp_pass ? "[redacted]" : "",
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldApply = args.has("--apply");
  const env = loadEnv();

  const accessToken = env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = deriveProjectRef(env);
  const smtpPass =
    env.SUPABASE_AUTH_SMTP_PASS?.trim() || env.RESEND_API_KEY?.trim();
  const siteUrl = optional(
    env,
    "SUPABASE_AUTH_SITE_URL",
    optional(env, "CLIENT_URL", optional(env, "VITE_SHARE_BASE_URL", DEFAULT_SITE_URL)),
  );
  const productionResetUrl =
    env.SUPABASE_AUTH_PRODUCTION_RESET_URL?.trim() ||
    DEFAULT_PRODUCTION_RESET_URL;
  const productionLoginUrl =
    env.SUPABASE_AUTH_PRODUCTION_LOGIN_URL?.trim() ||
    DEFAULT_PRODUCTION_LOGIN_URL;
  const productionRegisterUrl =
    env.SUPABASE_AUTH_PRODUCTION_REGISTER_URL?.trim() ||
    DEFAULT_PRODUCTION_REGISTER_URL;
  const extraRedirectUrls = (env.SUPABASE_AUTH_EXTRA_REDIRECT_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = {
    external_email_enabled: true,
    site_url: siteUrl,
    uri_allow_list: uniqueCsv([
      DEFAULT_SITE_URL,
      DEFAULT_RESET_URL,
      DEFAULT_LOGIN_URL,
      DEFAULT_REGISTER_URL,
      DEFAULT_PRODUCTION_SITE_URL,
      `${siteUrl.replace(/\/$/, "")}/reset-password`,
      `${siteUrl.replace(/\/$/, "")}/login`,
      `${siteUrl.replace(/\/$/, "")}/register`,
      productionResetUrl ?? "",
      productionLoginUrl ?? "",
      productionRegisterUrl ?? "",
      ...extraRedirectUrls,
    ]),
    smtp_admin_email: optional(
      env,
      "SUPABASE_AUTH_SMTP_SENDER_EMAIL",
      DEFAULT_SENDER_EMAIL,
    ),
    smtp_host: optional(env, "SUPABASE_AUTH_SMTP_HOST", "smtp.resend.com"),
    smtp_port: optional(env, "SUPABASE_AUTH_SMTP_PORT", "465"),
    smtp_user: optional(env, "SUPABASE_AUTH_SMTP_USER", "resend"),
    smtp_pass: smtpPass ?? "",
    smtp_sender_name: optional(
      env,
      "SUPABASE_AUTH_SMTP_SENDER_NAME",
      DEFAULT_SENDER_NAME,
    ),
    mailer_subjects_confirmation: "Confirm your Kinora account",
    mailer_templates_confirmation_content: buildConfirmationTemplate(),
    mailer_subjects_recovery: "Reset your Kinora password",
    mailer_templates_recovery_content: buildRecoveryTemplate(),
  };

  if (!shouldApply) {
    console.log("Dry run. Re-run with --apply to patch Supabase Auth config.");
    console.log(JSON.stringify(redactedPayload(payload), null, 2));
    return;
  }

  if (!projectRef) {
    throw new Error(
      "Missing SUPABASE_PROJECT_REF, and it could not be derived from SUPABASE_URL.",
    );
  }
  if (!accessToken) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN.");
  }
  if (!payload.smtp_pass) {
    throw new Error(
      "Missing SUPABASE_AUTH_SMTP_PASS or RESEND_API_KEY for Resend SMTP.",
    );
  }
  if (
    payload.site_url === DEFAULT_SITE_URL &&
    env.SUPABASE_AUTH_ALLOW_LOCAL_SITE_URL !== "true"
  ) {
    throw new Error(
      "SUPABASE_AUTH_SITE_URL is still http://localhost:5173. Set it to the production app URL, or set SUPABASE_AUTH_ALLOW_LOCAL_SITE_URL=true for a local/dev Supabase project.",
    );
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase Auth config update failed: ${response.status} ${body}`);
  }

  console.log(
    `Supabase Auth email config updated for project ${projectRef}. Sender: ${payload.smtp_sender_name} <${payload.smtp_admin_email}>`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
