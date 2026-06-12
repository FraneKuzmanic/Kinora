import { apiFetch } from "@/lib/api/client";

export type CinemaRead = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CinemaLocationRead = {
  id: string;
  cinema_id: string;
  city_id: string | null;
  city_name: string | null;
  location_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CinemaHallRead = {
  id: string;
  location_id: string;
  name: string;
  capacity: number;
  allow_private_booking: boolean;
  created_at: string;
  updated_at: string;
};

export type CinemaUpdate = {
  name?: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
};

export type CinemaLocationCreate = {
  city_name?: string;
  location_name?: string;
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  timezone: string;
  is_active?: boolean;
};

export type CinemaLocationUpdate = Partial<CinemaLocationCreate>;

export type CinemaHallCreate = {
  name: string;
  capacity: number;
  allow_private_booking?: boolean;
};

export type CinemaHallUpdate = Partial<CinemaHallCreate>;

export type CinemaValidatorCreate = {
  email: string;
  password: string;
  display_name?: string;
  home_city_id?: string;
};

export type CinemaValidatorRead = {
  validator_user_id: string;
  display_name: string | null;
  email: string | null;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
};

export function listCinemas() {
  return apiFetch<CinemaRead[]>("/cinemas", {
    method: "GET",
  });
}

export function getMyCinema(token: string) {
  return apiFetch<CinemaRead>("/cinemas/me", {
    method: "GET",
    token,
  });
}

export function updateCinema(
  cinemaId: string,
  payload: CinemaUpdate,
  token: string,
) {
  return apiFetch<CinemaRead>(`/cinemas/${encodeURIComponent(cinemaId)}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function uploadCinemaLogo(
  cinemaId: string,
  file: File,
  token: string,
) {
  const body = new FormData();
  body.append("logo", file);

  return apiFetch<CinemaRead>(`/cinemas/${encodeURIComponent(cinemaId)}/logo`, {
    method: "POST",
    token,
    body,
  });
}

export function listCinemaLocations(cinemaId: string) {
  return apiFetch<CinemaLocationRead[]>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations`,
    {
      method: "GET",
    },
  );
}

export function createCinemaLocation(
  cinemaId: string,
  payload: CinemaLocationCreate,
  token: string,
) {
  return apiFetch<CinemaLocationRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function updateCinemaLocation(
  cinemaId: string,
  locationId: string,
  payload: CinemaLocationUpdate,
  token: string,
) {
  return apiFetch<CinemaLocationRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations/${encodeURIComponent(locationId)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function deleteCinemaLocation(
  cinemaId: string,
  locationId: string,
  token: string,
) {
  return apiFetch<void>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations/${encodeURIComponent(locationId)}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function listCinemaHalls(cinemaId: string) {
  return apiFetch<CinemaHallRead[]>(
    `/cinemas/${encodeURIComponent(cinemaId)}/halls`,
    {
      method: "GET",
    },
  );
}

export function createCinemaHall(
  cinemaId: string,
  locationId: string,
  payload: CinemaHallCreate,
  token: string,
) {
  return apiFetch<CinemaHallRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations/${encodeURIComponent(locationId)}/halls`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function updateCinemaHall(
  cinemaId: string,
  locationId: string,
  hallId: string,
  payload: CinemaHallUpdate,
  token: string,
) {
  return apiFetch<CinemaHallRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations/${encodeURIComponent(locationId)}/halls/${encodeURIComponent(hallId)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function deleteCinemaHall(
  cinemaId: string,
  locationId: string,
  hallId: string,
  token: string,
) {
  return apiFetch<void>(
    `/cinemas/${encodeURIComponent(cinemaId)}/locations/${encodeURIComponent(locationId)}/halls/${encodeURIComponent(hallId)}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function listCinemaValidators(cinemaId: string, token: string) {
  return apiFetch<CinemaValidatorRead[]>(
    `/cinemas/${encodeURIComponent(cinemaId)}/validators`,
    {
      method: "GET",
      token,
    },
  );
}

export function createCinemaValidator(
  cinemaId: string,
  payload: CinemaValidatorCreate,
  token: string,
) {
  return apiFetch<CinemaValidatorRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/validators/create`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function revokeCinemaValidator(
  cinemaId: string,
  validatorUserId: string,
  token: string,
) {
  return apiFetch<CinemaValidatorRead>(
    `/cinemas/${encodeURIComponent(cinemaId)}/validators/${encodeURIComponent(validatorUserId)}`,
    {
      method: "DELETE",
      token,
    },
  );
}
