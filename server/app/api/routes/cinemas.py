import uuid

from fastapi import Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.cinema import (
    CinemaHallCreate,
    CinemaHallRead,
    CinemaHallUpdate,
    CinemaLocationCreate,
    CinemaLocationRead,
    CinemaLocationUpdate,
    CinemaRead,
    CinemaUpdate,
    CinemaValidatorCreate,
    CinemaValidatorRead,
)
from app.schemas.ml import FilmScoreRead
from app.services.campaign_service import CampaignService
from app.services.cinema_service import CinemaService
from app.services.profile_service import ProfileService
from app.services.scoring_service import score_films_for_cinema
from app.services.tmdb_service import get_genre_map, get_popular_movies

router = APIRouter()


@router.get("", response_model=list[CinemaRead])
async def list_cinemas(session: AsyncSession = Depends(get_db)) -> list[CinemaRead]:
    """List active and inactive cinemas for discovery/admin views."""
    rows = await CinemaService().list_cinemas(session)
    return [CinemaRead.model_validate(row) for row in rows]


async def _require_cinema_admin(current_user: dict, session: AsyncSession) -> tuple[str, uuid.UUID]:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"cinema_admin"})
    cinema_id = await CampaignService().get_admin_cinema_id(session, user_id)
    if not cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No cinema membership found for this user",
        )
    return user_id, cinema_id


@router.get("/me", response_model=CinemaRead)
async def get_my_cinema(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaRead:
    """Return the cinema managed by the current cinema admin."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    row = await CinemaService().get_cinema(session, cinema_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema not found")
    return CinemaRead.model_validate(row)


@router.get("/{cinema_id}", response_model=CinemaRead)
async def get_cinema(cinema_id: str, session: AsyncSession = Depends(get_db)) -> CinemaRead:
    """Return one cinema by id."""
    row = await CinemaService().get_cinema(session, cinema_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema not found")
    return CinemaRead.model_validate(row)


@router.get("/{cinema_id}/halls", response_model=list[CinemaHallRead])
async def list_cinema_halls(cinema_id: str, session: AsyncSession = Depends(get_db)) -> list[CinemaHallRead]:
    """Return halls that belong to a cinema across its locations."""
    rows = await CinemaService().list_halls(session, cinema_id)
    return [CinemaHallRead.model_validate(row) for row in rows]


@router.get("/{cinema_id}/validators", response_model=list[CinemaValidatorRead])
async def list_cinema_validators(
    cinema_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[CinemaValidatorRead]:
    """List validators assigned to an owned cinema."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    rows = await CinemaService().list_validators(session, cinema_id=cinema_id)
    return [CinemaValidatorRead.model_validate(row) for row in rows]


@router.post("/{cinema_id}/validators/create", response_model=CinemaValidatorRead, status_code=status.HTTP_201_CREATED)
async def create_cinema_validator(
    cinema_id: uuid.UUID,
    payload: CinemaValidatorCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaValidatorRead:
    """Create a validator account and assign it to an owned cinema."""
    user_id, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().create_validator_account(
        session,
        cinema_id=cinema_id,
        granted_by_user_id=user_id,
        payload=payload,
    )
    return CinemaValidatorRead.model_validate(row)


@router.delete("/{cinema_id}/validators/{validator_user_id}", response_model=CinemaValidatorRead)
async def revoke_cinema_validator(
    cinema_id: uuid.UUID,
    validator_user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaValidatorRead:
    """Revoke validator access from an owned cinema."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().revoke_validator(
        session,
        cinema_id=cinema_id,
        validator_user_id=validator_user_id,
    )
    return CinemaValidatorRead.model_validate(row)


@router.patch("/{cinema_id}", response_model=CinemaRead)
async def update_cinema(
    cinema_id: uuid.UUID,
    payload: CinemaUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaRead:
    """Update cinema metadata for the owning cinema admin."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    svc = CinemaService()
    cinema = await svc.get_cinema_orm(session, cinema_id)
    if not cinema:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema not found")
    row = await svc.update_cinema(session, cinema, payload)
    return CinemaRead.model_validate(row)


@router.post("/{cinema_id}/logo", response_model=CinemaRead)
async def upload_cinema_logo(
    cinema_id: uuid.UUID,
    logo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaRead:
    """Upload or replace a cinema logo image."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    svc = CinemaService()
    cinema = await svc.get_cinema_orm(session, cinema_id)
    if not cinema:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema not found")
    row = await svc.store_logo(session, cinema=cinema, upload_file=logo)
    return CinemaRead.model_validate(row)


@router.get("/{cinema_id}/logo", response_class=FileResponse)
async def get_cinema_logo(
    cinema_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Return the uploaded cinema logo file when available."""
    path, media_type = await CinemaService().get_logo_file(session, cinema_id)
    return FileResponse(path=path, media_type=media_type, filename=path.name)


@router.get("/{cinema_id}/locations", response_model=list[CinemaLocationRead])
async def list_cinema_locations(
    cinema_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> list[CinemaLocationRead]:
    """Return locations for a cinema."""
    rows = await CinemaService().list_locations(session, cinema_id)
    return [CinemaLocationRead.model_validate(row) for row in rows]


@router.post("/{cinema_id}/locations", response_model=CinemaLocationRead, status_code=status.HTTP_201_CREATED)
async def create_cinema_location(
    cinema_id: uuid.UUID,
    payload: CinemaLocationCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaLocationRead:
    """Create a new cinema location for the owning cinema admin."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().create_location(session, cinema_id=cinema_id, payload=payload)
    return CinemaLocationRead.model_validate(row)


@router.patch("/{cinema_id}/locations/{location_id}", response_model=CinemaLocationRead)
async def update_cinema_location(
    cinema_id: uuid.UUID,
    location_id: uuid.UUID,
    payload: CinemaLocationUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaLocationRead:
    """Update an owned cinema location."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().update_location(
        session,
        cinema_id=cinema_id,
        location_id=location_id,
        payload=payload,
    )
    return CinemaLocationRead.model_validate(row)


@router.delete("/{cinema_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cinema_location(
    cinema_id: uuid.UUID,
    location_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete an owned cinema location when not blocked by existing usage."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    await CinemaService().delete_location(session, cinema_id=cinema_id, location_id=location_id)


@router.post(
    "/{cinema_id}/locations/{location_id}/halls",
    response_model=CinemaHallRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_cinema_hall(
    cinema_id: uuid.UUID,
    location_id: uuid.UUID,
    payload: CinemaHallCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaHallRead:
    """Create a hall under an owned cinema location."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().create_hall(
        session,
        cinema_id=cinema_id,
        location_id=location_id,
        payload=payload,
    )
    return CinemaHallRead.model_validate(row)


@router.patch("/{cinema_id}/locations/{location_id}/halls/{hall_id}", response_model=CinemaHallRead)
async def update_cinema_hall(
    cinema_id: uuid.UUID,
    location_id: uuid.UUID,
    hall_id: uuid.UUID,
    payload: CinemaHallUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CinemaHallRead:
    """Update a hall under an owned cinema location."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    row = await CinemaService().update_hall(
        session,
        cinema_id=cinema_id,
        location_id=location_id,
        hall_id=hall_id,
        payload=payload,
    )
    return CinemaHallRead.model_validate(row)


@router.delete("/{cinema_id}/locations/{location_id}/halls/{hall_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cinema_hall(
    cinema_id: uuid.UUID,
    location_id: uuid.UUID,
    hall_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a hall under an owned cinema location when not blocked by existing usage."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    await CinemaService().delete_hall(
        session,
        cinema_id=cinema_id,
        location_id=location_id,
        hall_id=hall_id,
    )


# ---------------------------------------------------------------------------
# ML recommendations
# ---------------------------------------------------------------------------

@router.get("/{cinema_id}/recommendations", response_model=list[FilmScoreRead])
async def get_cinema_recommendations(
    cinema_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[FilmScoreRead]:
    """Return top-4 ML-scored film recommendations for a cinema (cinema_admin only)."""
    _, owned_cinema_id = await _require_cinema_admin(current_user, session)
    if owned_cinema_id != cinema_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cinema does not belong to your account")

    try:
        tmdb_films = await get_popular_movies()
        genre_map = await get_genre_map()
    except Exception:
        tmdb_films = []
        genre_map = {}
    scored = await score_films_for_cinema(session, cinema_id, tmdb_films, genre_map=genre_map)
    return scored[:4]
