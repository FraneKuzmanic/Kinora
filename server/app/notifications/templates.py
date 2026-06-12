from dataclasses import dataclass
from html import escape

from app.notifications.types import NotificationTemplate


BRAND_NAVY = "#131A27"
BRAND_PANEL = "#1B2231"
BRAND_GOLD = "#DFC56A"
BRAND_WHITE = "#FFFFFF"


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    text: str
    html: str


def _format_money(amount_cents: int | str, currency: str | None) -> str:
    amount = int(amount_cents) / 100
    code = (currency or "EUR").upper()
    return f"{amount:.2f} {code}"


def _row(label: str, value: object | None) -> tuple[str, str] | None:
    if value is None or value == "":
        return None
    return (label, str(value))


def _render_layout(
    *,
    title: str,
    intro: str,
    rows: list[tuple[str, str] | None],
    cta_url: str | None = None,
    cta_label: str = "Open Kinora",
    note: str | None = None,
) -> str:
    detail_rows = "".join(
        (
            "<tr>"
            "<td style=\"padding:10px 0;color:#AAB2C3;font-size:13px;\">"
            f"{escape(label)}</td>"
            "<td style=\"padding:10px 0;color:#FFFFFF;font-size:14px;"
            "font-weight:600;text-align:right;word-break:break-word;\">"
            f"{escape(value)}</td>"
            "</tr>"
        )
        for row in rows
        if row is not None
        for label, value in [row]
    )
    details = (
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" "
        "style=\"border-collapse:collapse;margin-top:24px;border-top:1px solid #2C3548;\">"
        f"{detail_rows}"
        "</table>"
        if detail_rows
        else ""
    )
    cta = (
        "<div style=\"margin-top:28px;\">"
        f"<a href=\"{escape(cta_url or '', quote=True)}\" "
        "style=\"display:inline-block;background:#DFC56A;color:#131A27;"
        "font-weight:700;text-decoration:none;padding:13px 18px;border-radius:6px;"
        "font-size:14px;\">"
        f"{escape(cta_label)}</a>"
        "</div>"
        if cta_url
        else ""
    )
    note_html = (
        "<p style=\"margin:24px 0 0;color:#C7CEDD;font-size:14px;line-height:1.6;\">"
        f"{escape(note)}</p>"
        if note
        else ""
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)}</title>
  </head>
  <body style="margin:0;background:{BRAND_NAVY};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="background:{BRAND_NAVY};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="max-width:620px;background:{BRAND_PANEL};border:1px solid #2C3548;
            border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 20px;border-bottom:1px solid #2C3548;">
                <h1 style="margin:0;color:{BRAND_WHITE};font-size:26px;
                  line-height:1.25;font-weight:700;">{escape(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 30px;">
                <p style="margin:0;color:{BRAND_WHITE};font-size:16px;line-height:1.65;">
                  {escape(intro)}
                </p>
                {details}
                {note_html}
                {cta}
              </td>
            </tr>
          </table>
          <p style="max-width:620px;margin:16px auto 0;color:#AAB2C3;font-size:12px;
            line-height:1.5;">This automated email was sent by Kinora.</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _message(
    *,
    subject: str,
    title: str,
    intro: str,
    rows: list[tuple[str, str] | None],
    cta_url: str | None = None,
    cta_label: str = "Open Kinora",
    note: str | None = None,
    text_extra: str | None = None,
) -> EmailMessage:
    text_rows = "\n".join(f"{label}: {value}" for row in rows if row for label, value in [row])
    text_parts = [intro]
    if text_rows:
        text_parts.append(text_rows)
    if note:
        text_parts.append(note)
    if cta_url:
        text_parts.append(f"{cta_label}: {cta_url}")
    if text_extra:
        text_parts.append(text_extra)
    return EmailMessage(
        subject=subject,
        text="\n\n".join(text_parts),
        html=_render_layout(
            title=title,
            intro=intro,
            rows=rows,
            cta_url=cta_url,
            cta_label=cta_label,
            note=note,
        ),
    )


def render_email_content(template_key: NotificationTemplate | str, payload: dict) -> tuple[str, str]:
    message = render_email_message(template_key, payload)
    return message.subject, message.text


def render_email_message(template_key: NotificationTemplate | str, payload: dict) -> EmailMessage:
    raw_key = template_key.value if isinstance(template_key, NotificationTemplate) else str(template_key)

    # Keep compatibility with older seeded outbox rows that predate the new pipeline.
    if raw_key == "campaign_voting_opened":
        title = "Campaign voting is open"
        campaign_title = payload.get("campaign_title", payload.get("campaign_id", "campaign"))
        return _message(
            subject=title,
            title=title,
            intro=f"Voting is now open for {campaign_title}.",
            rows=[_row("Campaign", campaign_title)],
            cta_url=payload.get("campaign_url"),
            cta_label="Vote now",
        )

    if raw_key == "campaign_resolved":
        title = "Campaign resolved"
        campaign_title = payload.get("campaign_title", payload.get("campaign_id", "campaign"))
        return _message(
            subject=title,
            title=title,
            intro=f"{campaign_title} has been resolved.",
            rows=[
                _row("Campaign", campaign_title),
                _row("Winning movie", payload.get("movie_title")),
            ],
        )

    key = NotificationTemplate(raw_key)

    if key is NotificationTemplate.private_booking_submitted_audience:
        return _message(
            subject="Private booking request received",
            title="Private booking request received",
            intro="We received your private booking request. A cinema admin will review it and send an offer or reject the request.",
            rows=[
                _row("Booking reference", payload["booking_id"]),
                _row("Group size", payload["group_size"]),
                _row("Notes", payload.get("notes")),
            ],
            cta_url=payload.get("cancel_url"),
            cta_label="Manage request",
        )

    if key is NotificationTemplate.private_booking_submitted_cinema:
        return _message(
            subject="New private booking request",
            title="New private booking request",
            intro="A new audience private booking request is ready for review.",
            rows=[
                _row("Booking reference", payload["booking_id"]),
                _row("Cinema", payload["cinema_id"]),
                _row("Group size", payload["group_size"]),
            ],
        )

    if key is NotificationTemplate.private_booking_reviewed_audience:
        quoted = (
            _format_money(payload["quoted_price_cents"], payload.get("currency"))
            if payload.get("quoted_price_cents") is not None
            else None
        )
        is_offered = payload["status"] == "offered"
        title = "Private booking offer" if is_offered else "Private booking response"
        intro = (
            "The cinema sent an offer for your private booking. Review the details and accept it in Kinora if it works for you."
            if is_offered
            else "The cinema reviewed your private booking request and cannot host it this time."
        )
        return _message(
            subject=title,
            title=title,
            intro=intro,
            rows=[
                _row("Booking reference", payload["booking_id"]),
                _row("Response", "Offer sent" if is_offered else "Rejected"),
                _row("Offered start", payload.get("offered_start_at") if is_offered else None),
                _row("Offered end", payload.get("offered_end_at") if is_offered else None),
                _row("Offered price", quoted if is_offered else None),
                _row("Cinema message", payload.get("cinema_response_message")),
            ],
            cta_url=payload.get("booking_url") if is_offered else None,
            cta_label="Review offer",
        )

    if key is NotificationTemplate.payment_succeeded:
        description = payload.get("description") or "Kinora purchase"
        amount = _format_money(payload["amount_cents"], payload.get("currency"))
        ticket_note = "Your ticket PDF is attached to this email." if payload.get("admission_id") else None
        refund_note = (
            "If your selected campaign movie does not win, you can request a refund here "
            "after voting ends."
            if payload.get("refund_url")
            else None
        )
        note = " ".join(note for note in [ticket_note, refund_note] if note) or None
        return _message(
            subject="Your Kinora receipt",
            title="Your Kinora receipt",
            intro=f"Thanks for your purchase. Your payment for {description} was received.",
            rows=[
                _row("Total paid", amount),
                _row("Quantity", payload.get("quantity")),
                _row("Order reference", payload["order_id"]),
                _row("Payment reference", payload["payment_id"]),
            ],
            cta_url=payload.get("refund_url"),
            cta_label="Request refund",
            note=note,
        )

    if key is NotificationTemplate.payment_failed:
        return _message(
            subject="Payment failed",
            title="Payment failed",
            intro="We could not complete your Kinora payment.",
            rows=[
                _row("Order reference", payload["order_id"]),
                _row("Reason", payload.get("reason")),
            ],
        )

    if key is NotificationTemplate.refund_succeeded:
        return _message(
            subject="Refund processed",
            title="Refund processed",
            intro="Your Kinora refund has been processed.",
            rows=[
                _row("Refund reference", payload["refund_id"]),
                _row("Payment reference", payload["payment_id"]),
                _row("Refund amount", _format_money(payload["amount_cents"], payload.get("currency"))),
            ],
        )

    if key is NotificationTemplate.refund_failed:
        return _message(
            subject="Refund failed",
            title="Refund failed",
            intro="We could not process your Kinora refund.",
            rows=[
                _row("Refund reference", payload["refund_id"]),
                _row("Payment reference", payload["payment_id"]),
                _row("Reason", payload.get("reason")),
            ],
        )

    if key is NotificationTemplate.screening_confirmed:
        return _message(
            subject="Screening confirmed",
            title="Screening confirmed",
            intro="A campaign screening has been confirmed.",
            rows=[
                _row("Campaign", payload["campaign_id"]),
                _row("Movie", payload.get("movie_title")),
                _row("Starts at", payload.get("slot_starts_at")),
                _row("Ends at", payload.get("slot_ends_at")),
            ],
        )

    if key is NotificationTemplate.movie_request_arrived_in_campaign:
        movie_title = payload["requested_movie_title"]
        return _message(
            subject=f"{movie_title} is now in a campaign",
            title="Your movie request is in a campaign",
            intro=(
                f"Hi {payload['requested_by_name']}, {movie_title} is now part of "
                f"\"{payload['campaign_title']}\"."
            ),
            rows=[
                _row("Requested movie", movie_title),
                _row("Campaign", payload["campaign_title"]),
            ],
            cta_url=payload["campaign_url"],
            cta_label="View campaign",
        )

    return _message(
        subject="Screening cancelled",
        title="Screening cancelled",
        intro="A campaign screening has been cancelled.",
        rows=[
            _row("Campaign", payload["campaign_id"]),
            _row("Reason", payload.get("reason")),
        ],
    )
