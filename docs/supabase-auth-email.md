# Supabase Auth Email Sender

Kinora password reset and signup confirmation emails are sent by the FastAPI
backend through Resend. Supabase Auth still generates and verifies the secure
action links; Kinora owns the email sender and template.

The frontend must not call `supabase.auth.resetPasswordForEmail(...)` or
`supabase.auth.signUp(...)` for these email flows, because those use
Supabase's hosted email sender unless Custom SMTP is configured in the
Supabase dashboard.

## Sender

- From email: `noreply@kinora.live`
- From name: `Kinora`
- Provider: Resend API

## Prerequisites

1. Verify `kinora.live` in Resend.
2. Add the Resend DNS records for SPF, DKIM, and DMARC.
3. Set `RESEND_API_KEY` in `server/.env`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.
5. Confirm the Supabase Auth redirect allowlist includes:
   - `http://localhost:5173/reset-password`
   - `https://kinora.live/reset-password`
   - `https://kinora.live/login`
   - `https://kinora.live/register`

## Signup Confirmation Emails

The register page calls `POST /api/v1/auth/signup`. FastAPI uses the
Supabase service-role client to generate a `signup` action link, then sends
that link through Resend using the Kinora confirmation template.

Supabase still owns token generation, expiry, and account confirmation when
the user clicks the link.

## Optional Supabase Hosted Auth Emails

Use `scripts/configure_supabase_auth_email.mjs --apply` with a
`SUPABASE_ACCESS_TOKEN` to configure Supabase Auth Custom SMTP and the
Kinora signup confirmation template for any remaining Supabase-hosted Auth
emails.

This script is optional for the Kinora register page because signup delivery is
now handled by FastAPI and Resend directly.

## Backend Config

```env
RESEND_API_KEY=...
PASSWORD_RESET_EMAIL_FROM="Kinora <noreply@kinora.live>"
SIGNUP_CONFIRMATION_EMAIL_FROM="Kinora <noreply@kinora.live>"
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
CLIENT_URL=http://localhost:5173
```

Use `CLIENT_URL=https://kinora.live` in production so generated auth links
return to the production app.

## Verification

1. Open `/register`.
2. Register with a real test account email.
3. Confirm the received email is from `Kinora <noreply@kinora.live>`.
4. Confirm the email is Kinora-branded and not the default Supabase
   "Confirm your signup" template.
5. Click the confirmation link and sign in after the account is confirmed.
6. Open `/forgot-password` and repeat the sender/link check for password reset.
7. Check Resend and Supabase Auth logs if delivery fails.

## Notes

- Do not replace Supabase Auth recovery tokens with app-generated tokens.
- Password reset uses a generic public response to avoid account enumeration;
  signup returns a conflict if the email already exists.
- Supabase still handles token generation, expiry, and verification.
- The Supabase template script is only needed for flows that still use
  Supabase-hosted email delivery.
