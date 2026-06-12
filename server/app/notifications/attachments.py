from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EmailAttachment:
    filename: str
    content: str
    content_type: str | None = None
