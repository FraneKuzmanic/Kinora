type TmdbImageSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "original";

const TMDB_IMAGE_HOST = "image.tmdb.org";
const TMDB_IMAGE_PATH_PREFIX = "/t/p/";

export function tmdbImageUrl(
  url: string | null | undefined,
  size: TmdbImageSize,
) {
  if (!url) {
    return "";
  }

  try {
    const imageUrl = new URL(url);

    if (
      imageUrl.hostname !== TMDB_IMAGE_HOST ||
      !imageUrl.pathname.startsWith(TMDB_IMAGE_PATH_PREFIX)
    ) {
      return url;
    }

    const pathParts = imageUrl.pathname.split("/");
    pathParts[3] = size;
    imageUrl.pathname = pathParts.join("/");
    return imageUrl.toString();
  } catch {
    return url;
  }
}
