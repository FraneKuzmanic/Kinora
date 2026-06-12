from html import escape

from app.branding import render_kinora_logo_img


BRAND_NAVY = "#131A27"
BRAND_PANEL = "#1B2231"
BRAND_GOLD = "#DFC56A"
BRAND_WHITE = "#FFFFFF"


def render_status_page(
    *,
    title: str,
    eyebrow: str,
    message: str,
    rows: list[tuple[str, object | None]] | None = None,
    action_label: str | None = None,
    action_url: str | None = None,
    form_action: str | None = None,
    form_button: str | None = None,
) -> str:
    logo = render_kinora_logo_img(
        width=178,
        style="display:block;width:min(178px,52vw);height:auto;margin:0 auto 18px;",
    )
    detail_rows = "".join(
        (
            "<div class=\"detail-row\">"
            f"<span>{escape(label)}</span>"
            f"<strong>{escape(str(value))}</strong>"
            "</div>"
        )
        for label, value in rows or []
        if value is not None and value != ""
    )
    details = f"<div class=\"details\">{detail_rows}</div>" if detail_rows else ""
    action = (
        f"<a class=\"button\" href=\"{escape(action_url or '', quote=True)}\">"
        f"{escape(action_label or 'Continue')}</a>"
        if action_url
        else ""
    )
    form = (
        f"<form method=\"post\" action=\"{escape(form_action or '', quote=True)}\">"
        f"<button class=\"button\" type=\"submit\">{escape(form_button or 'Submit')}</button>"
        "</form>"
        if form_action
        else ""
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)}</title>
    <style>
      :root {{
        color-scheme: dark;
        --navy: {BRAND_NAVY};
        --panel: {BRAND_PANEL};
        --gold: {BRAND_GOLD};
        --white: {BRAND_WHITE};
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px;
        background: var(--navy);
        color: var(--white);
        font-family: Arial, Helvetica, sans-serif;
      }}
      main {{
        width: min(100%, 620px);
        background: var(--panel);
        border: 1px solid #2C3548;
        border-radius: 8px;
        padding: 34px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
      }}
      .eyebrow {{
        color: var(--gold);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
      }}
      h1 {{
        margin: 14px 0 12px;
        font-size: clamp(28px, 6vw, 42px);
        line-height: 1.1;
      }}
      p {{
        margin: 0;
        color: #D8DEEA;
        font-size: 16px;
        line-height: 1.65;
      }}
      .details {{
        margin-top: 26px;
        border-top: 1px solid #2C3548;
      }}
      .detail-row {{
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 14px 0;
        border-bottom: 1px solid #2C3548;
      }}
      .detail-row span {{
        color: #AAB2C3;
        font-size: 13px;
      }}
      .detail-row strong {{
        color: var(--white);
        font-size: 14px;
        text-align: right;
        overflow-wrap: anywhere;
      }}
      .button {{
        display: inline-block;
        margin-top: 28px;
        border: 0;
        border-radius: 6px;
        background: var(--gold);
        color: var(--navy);
        padding: 13px 18px;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }}
      @media (max-width: 520px) {{
        main {{ padding: 26px; }}
        .detail-row {{ display: block; }}
        .detail-row strong {{
          display: block;
          margin-top: 6px;
          text-align: left;
        }}
      }}
    </style>
  </head>
  <body>
    <main>
      {logo}
      <div class="eyebrow">{escape(eyebrow)}</div>
      <h1>{escape(title)}</h1>
      <p>{escape(message)}</p>
      {details}
      {action}
      {form}
    </main>
  </body>
</html>"""
