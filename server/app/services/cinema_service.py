import json
import uuid
import mimetypes
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from asyncpg import InterfaceError as AsyncpgInterfaceError
from asyncpg.exceptions import PostgresConnectionError
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.cinema import (
    Cinema,
    CinemaHall,
    CinemaLocation,
    CinemaValidatorPermission,
)
from app.models.geography import City, Country
from app.models.profile import Profile, UserRole
from app.schemas.cinema import (
    CinemaHallCreate,
    CinemaHallUpdate,
    CinemaLocationCreate,
    CinemaLocationUpdate,
    CinemaValidatorCreate,
    CinemaUpdate,
)


_ALLOWED_LOGO_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


class CinemaService:
    """Read and management operations for cinema catalog data."""

    async def list_cinemas(self, session: AsyncSession) -> list[dict]:
        result = await self._execute_with_retry(session, lambda: session.execute(select(Cinema).order_by(Cinema.name.asc())))
        return [self._cinema_to_dict(row) for row in result.scalars().all()]

    async def get_cinema(self, session: AsyncSession, cinema_id: str | UUID) -> dict | None:
        cinema = await self._get_with_retry(session, Cinema, cinema_id)
        return self._cinema_to_dict(cinema) if cinema else None

    async def get_cinema_orm(self, session: AsyncSession, cinema_id: str | UUID) -> Cinema | None:
        return await self._get_with_retry(session, Cinema, cinema_id)

    async def update_cinema(
        self,
        session: AsyncSession,
        cinema: Cinema,
        payload: CinemaUpdate,
    ) -> dict:
        updates = payload.model_dump(exclude_unset=True)
        if "name" in updates and updates["name"] is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cinema name cannot be null")

        for field, value in updates.items():
            setattr(cinema, field, value)

        cinema.updated_at = datetime.now(UTC)
        session.add(cinema)
        await session.commit()
        return self._cinema_to_dict(cinema)

    async def list_locations(self, session: AsyncSession, cinema_id: str | UUID) -> list[dict]:
        statement = (
            select(CinemaLocation, City.name.label("city_name"))
            .outerjoin(City, City.id == CinemaLocation.city_id)
            .where(CinemaLocation.cinema_id == cinema_id)
            .order_by(CinemaLocation.created_at.asc(), CinemaLocation.id.asc())
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return [self._location_to_dict(row[0], row.city_name) for row in result.all()]

    async def create_location(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        payload: CinemaLocationCreate,
    ) -> dict:
        city_id = await self._resolve_location_city_id(
            session,
            city_id=payload.city_id,
            city_name=payload.city_name,
            city_name_provided=payload.city_name is not None,
        )
        now = datetime.now(UTC)
        location = CinemaLocation(
            id=uuid.uuid4(),
            cinema_id=cinema_id,
            city_id=city_id,
            location_name=payload.location_name,
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            postal_code=payload.postal_code,
            lat=payload.lat,
            lon=payload.lon,
            timezone=payload.timezone,
            is_active=payload.is_active,
            created_at=now,
            updated_at=now,
        )
        city_name = await self._get_city_name(session, location.city_id)
        session.add(location)
        await session.commit()
        return self._location_to_dict(location, city_name)

    async def update_location(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
        payload: CinemaLocationUpdate,
    ) -> dict:
        location = await self.get_location_orm(session, cinema_id=cinema_id, location_id=location_id)
        if not location:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema location not found")

        updates = payload.model_dump(exclude_unset=True)
        if "city_name" in updates:
            updates["city_id"] = await self._resolve_location_city_id(
                session,
                city_id=updates.get("city_id"),
                city_name=updates.pop("city_name"),
                city_name_provided=True,
            )
        elif "city_id" in updates:
            await self._ensure_city_exists(session, updates.get("city_id"))

        if "timezone" in updates and updates["timezone"] is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Timezone cannot be null")

        for field, value in updates.items():
            setattr(location, field, value)

        location.updated_at = datetime.now(UTC)
        city_name = await self._get_city_name(session, location.city_id)
        session.add(location)
        await session.commit()
        return self._location_to_dict(location, city_name)

    async def delete_location(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
    ) -> None:
        location = await self.get_location_orm(session, cinema_id=cinema_id, location_id=location_id)
        if not location:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema location not found")

        try:
            await session.delete(location)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cinema location cannot be deleted because it is still in use",
            ) from exc

    async def list_halls(self, session: AsyncSession, cinema_id: str | UUID) -> list[dict]:
        statement = (
            select(CinemaHall)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .where(CinemaLocation.cinema_id == cinema_id)
            .order_by(CinemaHall.name.asc())
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return [self._hall_to_dict(row) for row in result.scalars().all()]

    async def create_hall(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
        payload: CinemaHallCreate,
    ) -> dict:
        location = await self.get_location_orm(session, cinema_id=cinema_id, location_id=location_id)
        if not location:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema location not found")

        now = datetime.now(UTC)
        hall = CinemaHall(
            id=uuid.uuid4(),
            location_id=location_id,
            name=payload.name,
            capacity=payload.capacity,
            allow_private_booking=payload.allow_private_booking,
            created_at=now,
            updated_at=now,
        )
        session.add(hall)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cinema hall could not be created with the provided data",
            ) from exc
        return self._hall_to_dict(hall)

    async def update_hall(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
        hall_id: UUID,
        payload: CinemaHallUpdate,
    ) -> dict:
        hall = await self.get_hall_orm(
            session,
            cinema_id=cinema_id,
            location_id=location_id,
            hall_id=hall_id,
        )
        if not hall:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema hall not found")

        updates = payload.model_dump(exclude_unset=True)
        if "name" in updates and updates["name"] is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Hall name cannot be null")

        for field, value in updates.items():
            setattr(hall, field, value)

        hall.updated_at = datetime.now(UTC)
        session.add(hall)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cinema hall could not be updated with the provided data",
            ) from exc
        return self._hall_to_dict(hall)

    async def delete_hall(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
        hall_id: UUID,
    ) -> None:
        hall = await self.get_hall_orm(
            session,
            cinema_id=cinema_id,
            location_id=location_id,
            hall_id=hall_id,
        )
        if not hall:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema hall not found")

        try:
            await session.delete(hall)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cinema hall cannot be deleted because it is still in use",
            ) from exc

    async def store_logo(
        self,
        session: AsyncSession,
        *,
        cinema: Cinema,
        upload_file: UploadFile,
    ) -> dict:
        content_type = (upload_file.content_type or "").lower()
        if content_type not in _ALLOWED_LOGO_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Cinema logo must be a JPG, PNG, WEBP, or SVG image",
            )

        contents = await upload_file.read()
        if not contents:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cinema logo file is empty")
        if len(contents) > settings.cinema_logo_max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Cinema logo file exceeds the maximum allowed size",
            )

        extension = self._logo_extension(upload_file.filename, content_type)
        relative_path = f"cinemas/{cinema.id}/logo{extension}"
        abs_path = self._absolute_storage_path(settings.cinema_logo_storage_path, relative_path)
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_bytes(contents)

        previous_path = cinema.logo_path
        cinema.logo_path = relative_path
        cinema.updated_at = datetime.now(UTC)
        session.add(cinema)
        await session.commit()

        if previous_path and previous_path != relative_path:
            previous_abs_path = self._absolute_storage_path(settings.cinema_logo_storage_path, previous_path)
            if previous_abs_path.exists():
                previous_abs_path.unlink()

        return self._cinema_to_dict(cinema)

    async def get_logo_file(
        self,
        session: AsyncSession,
        cinema_id: str | UUID,
    ) -> tuple[Path, str]:
        cinema = await self.get_cinema_orm(session, cinema_id)
        if not cinema:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema not found")
        if not cinema.logo_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema logo not found")

        abs_path = self._absolute_storage_path(settings.cinema_logo_storage_path, cinema.logo_path)
        if not abs_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cinema logo not found")

        media_type = mimetypes.guess_type(abs_path.name)[0] or "application/octet-stream"
        return abs_path, media_type

    async def get_location_orm(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
    ) -> CinemaLocation | None:
        statement = select(CinemaLocation).where(
            CinemaLocation.id == location_id,
            CinemaLocation.cinema_id == cinema_id,
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return result.scalar_one_or_none()

    async def get_hall_orm(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        location_id: UUID,
        hall_id: UUID,
    ) -> CinemaHall | None:
        statement = (
            select(CinemaHall)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .where(
                CinemaHall.id == hall_id,
                CinemaHall.location_id == location_id,
                CinemaLocation.cinema_id == cinema_id,
            )
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return result.scalar_one_or_none()

    async def list_validators(self, session: AsyncSession, *, cinema_id: UUID) -> list[dict]:
        statement = (
            select(CinemaValidatorPermission, Profile.display_name)
            .join(Profile, Profile.user_id == CinemaValidatorPermission.validator_user_id)
            .where(CinemaValidatorPermission.cinema_id == cinema_id)
            .order_by(CinemaValidatorPermission.granted_at.desc(), CinemaValidatorPermission.id.desc())
        )
        rows = (await self._execute_with_retry(session, lambda: session.execute(statement))).all()
        validator_ids = [row[0].validator_user_id for row in rows]
        email_map = await self._get_user_emails(session, validator_ids)
        return [self._validator_to_dict(row[0], row[1], email_map.get(row[0].validator_user_id)) for row in rows]

    async def create_validator_account(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        granted_by_user_id: str,
        payload: CinemaValidatorCreate,
    ) -> dict:
        email = payload.email.strip().lower()
        await self._ensure_city_exists(session, payload.home_city_id)

        existing_user = await self._find_auth_user_by_email(session, email)
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with that email already exists")

        user_id = uuid.uuid4()
        now = datetime.now(UTC)
        app_meta = {"provider": "email", "providers": ["email"]}
        user_meta = {"email_verified": True}
        identity_data = {
            "sub": str(user_id),
            "email": email,
            "email_verified": True,
            "phone_verified": False,
        }

        try:
            await session.execute(
                text(
                    """
                    insert into auth.users (
                        instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at,
                        invited_at, confirmation_token, confirmation_sent_at,
                        recovery_token, recovery_sent_at,
                        email_change_token_new, email_change, email_change_sent_at,
                        last_sign_in_at,
                        raw_app_meta_data, raw_user_meta_data,
                        is_super_admin, created_at, updated_at,
                        phone, phone_confirmed_at,
                        phone_change, phone_change_token, phone_change_sent_at,
                        email_change_token_current, email_change_confirm_status,
                        banned_until, reauthentication_token, reauthentication_sent_at,
                        is_sso_user, deleted_at, is_anonymous
                    ) values (
                        '00000000-0000-0000-0000-000000000000'::uuid, :user_id, 'authenticated', 'authenticated',
                        :email, crypt(:password, gen_salt('bf')),
                        :now,
                        null, '', null,
                        '', null,
                        '', '', null,
                        null,
                        cast(:app_meta as jsonb), cast(:user_meta as jsonb),
                        null, :now, :now,
                        null, null,
                        '', '', null,
                        '', 0,
                        null, '', null,
                        false, null, false
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "email": email,
                    "password": payload.password,
                    "now": now,
                    "app_meta": json.dumps(app_meta),
                    "user_meta": json.dumps(user_meta),
                },
            )
            await session.execute(
                text(
                    """
                    insert into auth.identities (
                        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
                    ) values (
                        gen_random_uuid(), :user_id, cast(:identity_data as jsonb), 'email', :provider_id, null, :now, :now
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "identity_data": json.dumps(identity_data),
                    "provider_id": str(user_id),
                    "now": now,
                },
            )
            session.add(
                Profile(
                    user_id=user_id,
                    role=UserRole.validator,
                    display_name=payload.display_name,
                    home_city_id=payload.home_city_id,
                )
            )
            await session.flush()
            permission = CinemaValidatorPermission(
                id=uuid.uuid4(),
                cinema_id=cinema_id,
                validator_user_id=user_id,
                granted_by_user_id=uuid.UUID(granted_by_user_id),
                granted_at=now,
                revoked_at=None,
            )
            session.add(permission)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Validator account could not be created with the provided data",
            ) from exc

        return self._validator_to_dict(permission, payload.display_name, email)

    async def revoke_validator(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        validator_user_id: UUID,
    ) -> dict:
        permission = await self._get_validator_permission(
            session,
            cinema_id=cinema_id,
            validator_user_id=validator_user_id,
        )
        if not permission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Validator permission not found")

        if permission.revoked_at is None:
            permission.revoked_at = datetime.now(UTC)
            session.add(permission)
            await session.commit()

        profile = await session.get(Profile, validator_user_id)
        email_map = await self._get_user_emails(session, [validator_user_id])
        return self._validator_to_dict(
            permission,
            profile.display_name if profile else None,
            email_map.get(validator_user_id),
        )

    async def has_active_validator_permission(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        validator_user_id: UUID,
    ) -> bool:
        permission = await self._get_validator_permission(
            session,
            cinema_id=cinema_id,
            validator_user_id=validator_user_id,
        )
        return permission is not None and permission.revoked_at is None

    async def _ensure_city_exists(self, session: AsyncSession, city_id: UUID | None) -> None:
        if city_id is None:
            return
        city = await self._get_with_retry(session, City, city_id)
        if not city:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    async def _resolve_location_city_id(
        self,
        session: AsyncSession,
        *,
        city_id: UUID | None,
        city_name: str | None,
        city_name_provided: bool,
    ) -> UUID | None:
        if city_name_provided:
            name = city_name.strip() if city_name else ""
            if not name:
                return None
            return await self._resolve_or_create_croatian_city(session, name)

        await self._ensure_city_exists(session, city_id)
        return city_id

    async def _resolve_or_create_croatian_city(self, session: AsyncSession, city_name: str) -> UUID:
        country = await self._get_or_create_croatia(session)
        normalized_name = city_name.casefold()
        statement = (
            select(City)
            .where(
                City.country_id == country.id,
                func.lower(City.name) == normalized_name,
            )
            .limit(1)
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        city = result.scalar_one_or_none()
        if city:
            return city.id

        city = City(
            id=uuid.uuid4(),
            country_id=country.id,
            name=city_name,
            created_at=datetime.now(UTC),
        )
        session.add(city)
        await session.flush()
        return city.id

    async def _get_or_create_croatia(self, session: AsyncSession) -> Country:
        statement = select(Country).where(func.lower(Country.iso_code) == "hr").limit(1)
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        country = result.scalar_one_or_none()
        if country:
            return country

        country = Country(
            id=uuid.uuid4(),
            iso_code="HR",
            name="Croatia",
            created_at=datetime.now(UTC),
        )
        session.add(country)
        await session.flush()
        return country

    async def _get_validator_permission(
        self,
        session: AsyncSession,
        *,
        cinema_id: UUID,
        validator_user_id: UUID,
    ) -> CinemaValidatorPermission | None:
        statement = select(CinemaValidatorPermission).where(
            CinemaValidatorPermission.cinema_id == cinema_id,
            CinemaValidatorPermission.validator_user_id == validator_user_id,
        )
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return result.scalar_one_or_none()

    async def _get_user_emails(
        self,
        session: AsyncSession,
        user_ids: list[UUID],
    ) -> dict[UUID, str]:
        if not user_ids:
            return {}
        user_id_values = [str(user_id) for user_id in user_ids]
        result = await self._execute_with_retry(
            session,
            lambda: session.execute(
                text(
                    """
                    select id, email
                    from auth.users
                    where id = any(cast(:user_ids as uuid[]))
                    """
                ),
                {"user_ids": user_id_values},
            ),
        )
        return {row.id: row.email for row in result}

    async def _find_auth_user_by_email(self, session: AsyncSession, email: str) -> tuple[UUID, str] | None:
        result = await self._execute_with_retry(
            session,
            lambda: session.execute(
                text(
                    """
                    select id, email
                    from auth.users
                    where lower(email) = lower(:email)
                    limit 1
                    """
                ),
                {"email": email},
            ),
        )
        row = result.first()
        if not row:
            return None
        return row.id, row.email

    async def _get_city_name(self, session: AsyncSession, city_id: UUID | None) -> str | None:
        if city_id is None:
            return None
        city = await self._get_with_retry(session, City, city_id)
        return city.name if city else None

    async def _execute_with_retry(self, session: AsyncSession, operation):
        for attempt in range(2):
            try:
                return await operation()
            except (DBAPIError, PostgresConnectionError, AsyncpgInterfaceError, OSError) as exc:
                if not self._is_retryable_disconnect(exc) or attempt == 1:
                    raise
                await session.close()

    async def _get_with_retry(self, session: AsyncSession, model, identity):
        return await self._execute_with_retry(session, lambda: session.get(model, identity))

    def _is_retryable_disconnect(self, exc: Exception) -> bool:
        if isinstance(exc, (PostgresConnectionError, AsyncpgInterfaceError, ConnectionResetError)):
            return True
        if isinstance(exc, DBAPIError) and getattr(exc, "connection_invalidated", False):
            return True
        message = str(exc).lower()
        return (
            "connection was closed in the middle of operation" in message
            or "connectiondoesnotexisterror" in message
            or "forcibly closed by the remote host" in message
        )

    def _cinema_to_dict(self, cinema: Cinema) -> dict:
        return {
            "id": cinema.id,
            "name": cinema.name,
            "description": cinema.description,
            "website": cinema.website,
            "email": cinema.email,
            "phone": cinema.phone,
            "logo_url": self._logo_url(cinema),
            "is_active": cinema.is_active,
            "created_at": cinema.created_at,
            "updated_at": cinema.updated_at,
        }

    def _location_to_dict(self, location: CinemaLocation, city_name: str | None) -> dict:
        return {
            "id": location.id,
            "cinema_id": location.cinema_id,
            "city_id": location.city_id,
            "city_name": city_name,
            "location_name": location.location_name,
            "address_line1": location.address_line1,
            "address_line2": location.address_line2,
            "postal_code": location.postal_code,
            "lat": float(location.lat) if location.lat is not None else None,
            "lon": float(location.lon) if location.lon is not None else None,
            "timezone": location.timezone,
            "is_active": location.is_active,
            "created_at": location.created_at,
            "updated_at": location.updated_at,
        }

    def _hall_to_dict(self, hall: CinemaHall) -> dict:
        return {
            "id": hall.id,
            "location_id": hall.location_id,
            "name": hall.name,
            "capacity": hall.capacity,
            "allow_private_booking": hall.allow_private_booking,
            "created_at": hall.created_at,
            "updated_at": hall.updated_at,
        }

    def _validator_to_dict(
        self,
        permission: CinemaValidatorPermission,
        display_name: str | None,
        email: str | None,
    ) -> dict:
        return {
            "validator_user_id": permission.validator_user_id,
            "display_name": display_name,
            "email": email,
            "granted_at": permission.granted_at,
            "revoked_at": permission.revoked_at,
            "is_active": permission.revoked_at is None,
        }

    def _logo_url(self, cinema: Cinema) -> str | None:
        if not cinema.logo_path:
            return None
        base_url = settings.api_public_url.rstrip("/")
        api_prefix = settings.api_v1_prefix.strip("/")
        return f"{base_url}/{api_prefix}/cinemas/{cinema.id}/logo"

    def _logo_extension(self, filename: str | None, content_type: str) -> str:
        suffix = Path(filename or "").suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
            return ".jpg" if suffix == ".jpeg" else suffix
        return _ALLOWED_LOGO_CONTENT_TYPES[content_type]

    def _absolute_storage_path(self, storage_root: str, relative_path: str) -> Path:
        root = Path(storage_root).resolve()
        abs_path = (root / relative_path).resolve()
        if not str(abs_path).startswith(str(root)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cinema logo path")
        return abs_path

