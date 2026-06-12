import base64
from functools import lru_cache
from html import escape
from pathlib import Path


LOGO_PATH = Path(__file__).resolve().parent / "assets" / "kinora-logo.svg"


@lru_cache
def kinora_logo_data_uri() -> str:
    encoded = base64.b64encode(LOGO_PATH.read_bytes()).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def render_kinora_logo_img(*, width: int, style: str, alt: str = "Kinora") -> str:
    return (
        f"<img src=\"{kinora_logo_data_uri()}\" width=\"{width}\" "
        f"alt=\"{escape(alt, quote=True)}\" style=\"{escape(style, quote=True)}\">"
    )
