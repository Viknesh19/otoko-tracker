const API_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query Search($search: String, $type: MediaType, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: $type, sort: [POPULARITY_DESC]) {
        id
        title { romaji english native }
        type
        format
        episodes
        chapters
        status
        description(asHtml: false)
        genres
        countryOfOrigin
        startDate { year }
        coverImage { large }
      }
    }
  }
`;

const DETAILS_QUERY = `
  query Details($id: Int) {
    Media(id: $id) {
      id
      title { romaji english native }
      type
      format
      episodes
      chapters
      status
      description(asHtml: false)
      genres
      countryOfOrigin
      startDate { year }
      coverImage { large }
    }
  }
`;

async function postGraphQL(query, variables) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AniList request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    const message = payload.errors.map((err) => err.message).join(", ");
    throw new Error(message || "AniList returned an error");
  }

  return payload.data;
}

function normalizeMedia(media) {
  if (!media) return null;

  const title = media.title?.english || media.title?.romaji || media.title?.native || "Untitled";
  const type = media.type === "ANIME" ? "anime" : "comic";
  const category = media.type === "ANIME"
    ? media.format === "MOVIE" ? "movie" : "anime"
    : media.countryOfOrigin === "KR" ? "manhwa" : "manga";

  const totalParts = media.type === "ANIME" ? media.episodes : media.chapters;
  const tags = media.genres?.slice(0, 6) ?? [];
  const description = (media.description || "").replace(/<[^>]+>/g, "").trim();

  return {
    id: String(media.id),
    title,
    category,
    format: type,
    totalParts: totalParts ?? 0,
    year: media.startDate?.year ?? "",
    description,
    tags,
    coverImage: media.coverImage?.large,
  };
}

export async function searchAniList(filters) {
  const { query, category } = filters;
  const mappedTypes = category === "all"
    ? ["ANIME", "MANGA"]
    : [category === "anime" ? "ANIME" : "MANGA"];

  const results = [];
  const searchTerm = query?.trim() || undefined;

  for (const type of mappedTypes) {
    const data = await postGraphQL(SEARCH_QUERY, {
      search: searchTerm,
      type,
      page: 1,
      perPage: 12,
    });

    const media = data?.Page?.media ?? [];
    media.map(normalizeMedia).filter(Boolean).forEach((item) => results.push(item));
  }

  if (category === "manhwa") {
    return results.filter((item) => item.category === "manhwa");
  }
  if (category === "manga") {
    return results.filter((item) => item.category === "manga");
  }

  return results;
}

export async function fetchAniListDetails(id) {
  const data = await postGraphQL(DETAILS_QUERY, { id: Number(id) });
  return normalizeMedia(data?.Media);
}
