import io
import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException, status
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.branding import LOGO_PATH
from app.models.admission import Admission
from app.models.campaign import CampaignMovie
from app.models.cinema import Cinema, CinemaHall, CinemaLocation
from app.models.movie import Movie
from app.models.screening import Screening


GOLD = HexColor("#DFC56A")
GOLD_DIM = HexColor("#BE9F52")
DARK_BG = HexColor("#131A27")
HEADER_BG = HexColor("#1B2231")
CREAM = HexColor("#F5F0E8")
LOGO_WIDTH = 1024
LOGO_HEIGHT = 419
PDF_TEMPLATE_VERSION = "v3"


@dataclass(frozen=True, slots=True)
class _LogoPath:
    d: str
    fill: str
    translate_x: float
    translate_y: float


@dataclass(frozen=True, slots=True)
class AdmissionPdf:
    bytes: bytes
    relative_path: str
    generated: bool


class AdmissionPdfService:
    async def get_or_generate(
        self,
        session: AsyncSession,
        admission: Admission,
        storage_root: str,
    ) -> AdmissionPdf:
        expected_rel_path = _ticket_relative_path(admission)
        cached = Path(storage_root) / admission.pdf_path if admission.pdf_path else None
        if admission.pdf_path == expected_rel_path and cached and cached.exists():
            return AdmissionPdf(
                bytes=cached.read_bytes(),
                relative_path=admission.pdf_path,
                generated=False,
            )

        screening, movie, hall, location, cinema = await self._load_ticket_context(session, admission)
        pdf_bytes, rel_path = generate_and_persist(
            admission,
            storage_root,
            screening=screening,
            movie=movie,
            hall=hall,
            location=location,
            cinema=cinema,
        )
        admission.pdf_path = rel_path
        return AdmissionPdf(bytes=pdf_bytes, relative_path=rel_path, generated=True)

    async def get_or_generate_by_id(
        self,
        session: AsyncSession,
        admission_id: str | uuid.UUID,
        storage_root: str,
    ) -> AdmissionPdf:
        admission_uuid = admission_id if isinstance(admission_id, uuid.UUID) else uuid.UUID(str(admission_id))
        admission = await session.get(Admission, admission_uuid)
        if not admission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")
        return await self.get_or_generate(session, admission, storage_root)

    async def _load_ticket_context(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> tuple[object | None, Movie | None, CinemaHall | None, CinemaLocation | None, Cinema | None]:
        screening = None
        movie: Movie | None = None
        hall: CinemaHall | None = None
        location: CinemaLocation | None = None
        cinema: Cinema | None = None

        if admission.screening_id:
            result = await session.execute(
                select(
                    Screening.id,
                    Screening.movie_id,
                    Screening.hall_id,
                    Screening.starts_at,
                    Screening.ends_at,
                ).where(Screening.id == admission.screening_id)
            )
            row = result.one_or_none()
            if row:
                screening = SimpleNamespace(
                    id=row.id,
                    movie_id=row.movie_id,
                    hall_id=row.hall_id,
                    starts_at=row.starts_at,
                    ends_at=row.ends_at,
                )

        if screening and screening.movie_id:
            result = await session.execute(select(Movie).where(Movie.id == screening.movie_id))
            movie = result.scalar_one_or_none()
        elif admission.campaign_movie_id:
            result = await session.execute(
                select(Movie)
                .join(CampaignMovie, CampaignMovie.movie_id == Movie.id)
                .where(CampaignMovie.id == admission.campaign_movie_id)
            )
            movie = result.scalar_one_or_none()

        if screening and screening.hall_id:
            result = await session.execute(select(CinemaHall).where(CinemaHall.id == screening.hall_id))
            hall = result.scalar_one_or_none()

        if hall:
            result = await session.execute(select(CinemaLocation).where(CinemaLocation.id == hall.location_id))
            location = result.scalar_one_or_none()

        if location:
            result = await session.execute(select(Cinema).where(Cinema.id == location.cinema_id))
            cinema = result.scalar_one_or_none()

        return screening, movie, hall, location, cinema


def _draw_deco_line(c: canvas.Canvas, x1: float, y: float, x2: float, weight: float = 0.75) -> None:
    c.setStrokeColor(GOLD)
    c.setLineWidth(weight)
    c.line(x1, y, x2, y)


@lru_cache
def _logo_paths() -> tuple[_LogoPath, ...]:
    svg = LOGO_PATH.read_text(encoding="utf-8")
    paths: list[_LogoPath] = []
    for raw_attrs in re.findall(r"<path\s+([^>]*)/?>", svg):
        d_match = re.search(r'\sd="([^"]*)"', f" {raw_attrs}")
        if not d_match or not d_match.group(1).strip():
            continue
        fill_match = re.search(r'\sfill="([^"]*)"', f" {raw_attrs}")
        transform_match = re.search(
            r'\stransform="translate\(([-0-9.]+),([-0-9.]+)\)"',
            f" {raw_attrs}",
        )
        paths.append(
            _LogoPath(
                d=d_match.group(1),
                fill=fill_match.group(1) if fill_match else "#DFC56A",
                translate_x=float(transform_match.group(1)) if transform_match else 0.0,
                translate_y=float(transform_match.group(2)) if transform_match else 0.0,
            )
        )
    return tuple(paths)


def _draw_logo(c: canvas.Canvas, x: float, y: float, width: float) -> None:
    scale = width / LOGO_WIDTH

    def point(px: float, py: float, logo_path: _LogoPath) -> tuple[float, float]:
        translated_x = px + logo_path.translate_x
        translated_y = py + logo_path.translate_y
        return x + translated_x * scale, y + (LOGO_HEIGHT - translated_y) * scale

    for logo_path in _logo_paths():
        tokens = re.findall(r"[MCZ]|-?\d+(?:\.\d+)?", logo_path.d)
        path = c.beginPath()
        index = 0
        command = ""
        while index < len(tokens):
            token = tokens[index]
            if token in {"M", "C", "Z"}:
                command = token
                index += 1
                if command == "Z":
                    path.close()
                    command = ""
                continue
            if command == "M":
                px, py = point(float(tokens[index]), float(tokens[index + 1]), logo_path)
                path.moveTo(px, py)
                index += 2
            elif command == "C":
                p1 = point(float(tokens[index]), float(tokens[index + 1]), logo_path)
                p2 = point(float(tokens[index + 2]), float(tokens[index + 3]), logo_path)
                p3 = point(float(tokens[index + 4]), float(tokens[index + 5]), logo_path)
                path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                index += 6
            else:
                index += 1
        c.setFillColor(HexColor(logo_path.fill))
        c.drawPath(path, stroke=0, fill=1)


def _render_pdf(
    admission: Admission,
    screening: Screening | None = None,
    movie: Movie | None = None,
    hall: CinemaHall | None = None,
    location: CinemaLocation | None = None,
    cinema: Cinema | None = None,
) -> bytes:
    buf = io.BytesIO()
    page_w, page_h = A4

    c = canvas.Canvas(buf, pagesize=A4, pageCompression=0)
    c.setTitle(f"Kinora ticket {admission.id}")
    c.setAuthor("Kinora")
    c.setSubject(f"Admission status: {admission.status.value}")

    c.setFillColor(DARK_BG)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    header_h = page_h / 7
    header_y = page_h - header_h

    c.setFillColor(HEADER_BG)
    c.rect(0, header_y, page_w, header_h, fill=1, stroke=0)

    _draw_deco_line(c, 0, header_y, page_w, weight=1.5)

    logo_w = 170
    logo_h = logo_w * LOGO_HEIGHT / LOGO_WIDTH
    logo_x = (page_w - logo_w) / 2
    logo_y = header_y + (header_h - logo_h) / 2
    _draw_logo(c, logo_x, logo_y, logo_w)

    qr_zone_h = page_h / 3
    qr_zone_top = qr_zone_h

    _draw_deco_line(c, 15 * mm, qr_zone_top, page_w - 15 * mm, weight=1.0)
    _draw_deco_line(c, 15 * mm, qr_zone_top + 3, page_w - 15 * mm, weight=0.3)

    qr_token = admission.qr_token or str(admission.id)
    qr_size = min(qr_zone_h - 22 * mm, page_w - 60 * mm)

    qr_widget = QrCodeWidget(qr_token)
    bounds = qr_widget.getBounds()
    native_w = bounds[2] - bounds[0]
    native_h = bounds[3] - bounds[1]
    scale = qr_size / max(native_w, native_h)

    qr_x = (page_w - qr_size) / 2
    qr_y = (qr_zone_h - qr_size) / 2

    pad = 4 * mm
    c.setFillColor(CREAM)
    c.rect(qr_x - pad, qr_y - pad, qr_size + 2 * pad, qr_size + 2 * pad, fill=1, stroke=0)

    drawing = Drawing(qr_size, qr_size, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(qr_widget)
    renderPDF.draw(drawing, c, qr_x, qr_y)

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    c.rect(qr_x - pad, qr_y - pad, qr_size + 2 * pad, qr_size + 2 * pad, fill=0, stroke=1)

    info_top = header_y - 8 * mm
    info_bottom = qr_zone_top + 6 * mm

    rows: list[tuple[str, str]] = []
    if movie:
        rows.append(("Film", movie.title))
        if movie.original_title and movie.original_title != movie.title:
            rows.append(("Original title", movie.original_title))
        if movie.runtime_minutes:
            rows.append(("Runtime", f"{movie.runtime_minutes} min"))
    if screening:
        rows.append(("Date", screening.starts_at.strftime("%A, %d %B %Y")))
        rows.append(("Showtime", screening.starts_at.strftime("%H:%M")))
    if cinema:
        rows.append(("Cinema", cinema.name))
    if location:
        addr_parts = [p for p in [location.location_name, location.address_line1] if p]
        if addr_parts:
            rows.append(("Venue", ", ".join(addr_parts)))
    if hall:
        rows.append(("Hall", hall.name))
    rows.append(("Manual code", str(admission.id)))
    rows.append(("Tickets", str(admission.quantity)))
    rows.append(("Total", f"{admission.total_price_cents / 100:.2f} EUR"))
    rows.append(("Status", admission.status.value.replace("_", " ").title()))

    row_h = 9.5 * mm
    block_h = len(rows) * row_h
    section_h = info_top - info_bottom
    start_y = info_bottom + (section_h + block_h) / 2

    label_x = 22 * mm
    value_x = 68 * mm
    rule_l = label_x
    rule_r = page_w - 22 * mm

    for i, (label, value) in enumerate(rows):
        row_y = start_y - i * row_h

        c.setFont("Times-Bold", 8)
        c.setFillColor(GOLD)
        c.drawString(label_x, row_y, label.upper())

        c.setFont("Times-Roman", 11)
        c.setFillColor(CREAM)
        c.drawString(value_x, row_y, value)

        c.setStrokeColor(GOLD_DIM)
        c.setLineWidth(0.25)
        c.line(rule_l, row_y - 2 * mm, rule_r, row_y - 2 * mm)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


def generate_and_persist(
    admission: Admission,
    storage_root: str,
    screening: Screening | None = None,
    movie: Movie | None = None,
    hall: CinemaHall | None = None,
    location: CinemaLocation | None = None,
    cinema: Cinema | None = None,
) -> tuple[bytes, str]:
    pdf_bytes = _render_pdf(admission, screening, movie, hall, location, cinema)
    rel_path = _ticket_relative_path(admission)
    abs_path = Path(storage_root) / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(pdf_bytes)
    return pdf_bytes, rel_path


def _ticket_relative_path(admission: Admission) -> str:
    return f"admissions/{admission.id}-{PDF_TEMPLATE_VERSION}.pdf"
