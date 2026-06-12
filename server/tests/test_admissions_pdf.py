import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.models.admission import Admission, AdmissionStatus, AdmissionType, LossDecision
from app.services import admission_pdf_service

BUYER_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()
ADMISSION_ID = uuid.uuid4()
URL = f"/api/v1/admissions/{ADMISSION_ID}/ticket.pdf"
PDF_REL_PATH = f"admissions/{ADMISSION_ID}-v3.pdf"


def _make_admission(buyer_id=BUYER_ID, pdf_path=None):
    a = MagicMock(spec=Admission)
    a.id = ADMISSION_ID
    a.buyer_user_id = buyer_id
    a.order_id = uuid.uuid4()
    a.type = AdmissionType.screening_ticket
    a.status = AdmissionStatus.active
    a.quantity = 2
    a.unit_price_cents = 1000
    a.total_price_cents = 2000
    a.qr_token = "TEST-QR-TOKEN"
    a.loss_decision = LossDecision.pending
    a.loss_decided_at = None
    a.qr_generated_at = None
    a.pdf_path = pdf_path
    a.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    a.screening_id = None
    a.campaign_movie_id = None
    return a


def _db_override(admission):
    async def _get_db():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = admission
        session.execute = AsyncMock(return_value=result)
        session.commit = AsyncMock()
        yield session
    return _get_db


def _make_client(user_id, admission):
    app.dependency_overrides[get_current_user] = lambda: {"id": str(user_id)}
    app.dependency_overrides[get_db] = _db_override(admission)
    return TestClient(app)


def _clear():
    app.dependency_overrides.clear()


def test_forbidden_wrong_user():
    client = _make_client(OTHER_ID, _make_admission())
    try:
        resp = client.get(URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN
    finally:
        _clear()


def test_not_found():
    client = _make_client(BUYER_ID, None)
    try:
        resp = client.get(URL)
        assert resp.status_code == 404
    finally:
        _clear()


def test_pdf_generated_and_returned(tmp_path):
    client = _make_client(BUYER_ID, _make_admission())
    try:
        with patch("app.api.routes.admissions.settings") as mock_settings:
            mock_settings.pdf_storage_path = str(tmp_path)
            resp = client.get(URL)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:4] == b"%PDF"
        assert (tmp_path / PDF_REL_PATH).exists()
        assert str(ADMISSION_ID).encode() in resp.content
        assert b"Active" in resp.content
        assert b"KINORA" not in resp.content
    finally:
        _clear()


def test_pdf_served_from_cache(tmp_path):
    cached = tmp_path / PDF_REL_PATH
    cached.parent.mkdir(parents=True)
    cached.write_bytes(b"%PDF-1.4 cached")

    client = _make_client(BUYER_ID, _make_admission(pdf_path=PDF_REL_PATH))
    try:
        with patch("app.api.routes.admissions.settings") as mock_settings:
            mock_settings.pdf_storage_path = str(tmp_path)
            resp = client.get(URL)
        assert resp.status_code == 200
        assert resp.content == b"%PDF-1.4 cached"
    finally:
        _clear()


def test_missing_cached_pdf_regenerates_and_updates_path(tmp_path):
    admission = _make_admission(pdf_path=f"admissions/{ADMISSION_ID}.pdf")
    client = _make_client(BUYER_ID, admission)
    try:
        with patch("app.api.routes.admissions.settings") as mock_settings:
            mock_settings.pdf_storage_path = str(tmp_path)
            resp = client.get(URL)
        assert resp.status_code == 200
        assert resp.content[:4] == b"%PDF"
        assert admission.pdf_path == PDF_REL_PATH
        assert (tmp_path / PDF_REL_PATH).exists()
    finally:
        _clear()


def test_pdf_generation_uses_qr_token(tmp_path):
    admission = _make_admission()
    seen_tokens = []
    original_qr = admission_pdf_service.QrCodeWidget

    def _recording_qr(value):
        seen_tokens.append(value)
        return original_qr(value)

    with patch("app.services.admission_pdf_service.QrCodeWidget", _recording_qr):
        pdf_bytes, rel_path = admission_pdf_service.generate_and_persist(
            admission,
            str(tmp_path),
        )

    assert seen_tokens == ["TEST-QR-TOKEN"]
    assert pdf_bytes[:4] == b"%PDF"
    assert rel_path == PDF_REL_PATH
    assert str(ADMISSION_ID).encode() in pdf_bytes
    assert b"Active" in pdf_bytes
    assert b"KINORA" not in pdf_bytes
