export const catalog = [
  {
    id: "aot-final",
    title: "Attack on Titan Final Season",
    category: "anime",
    format: "anime",
    totalParts: 87,
    studio: "MAPPA",
    year: 2013,
    description:
      "Humanity battles terrifying Titans in a struggle that uncovers political intrigue, betrayal, and the truth about freedom.",
    tags: ["dark", "action", "political"],
  },
  {
    id: "jjk-0",
    title: "Jujutsu Kaisen 0",
    category: "movie",
    format: "anime",
    totalParts: 1,
    studio: "MAPPA",
    year: 2021,
    description:
      "A theatrical prequel where curses erupt across Japan and a timid student learns to wield overwhelming power.",
    tags: ["shounen", "supernatural", "film"],
  },
  {
    id: "bleach-thousand",
    title: "Bleach: Thousand-Year Blood War",
    category: "anime",
    format: "anime",
    totalParts: 52,
    studio: "Pierrot",
    year: 2022,
    description:
      "Ichigo and the Soul Reapers face the Quincy empire in a stylish, high-stakes war that redefines their world.",
    tags: ["action", "shounen", "stylish"],
  },
  {
    id: "your-name",
    title: "Your Name",
    category: "movie",
    format: "anime",
    totalParts: 1,
    studio: "CoMix Wave Films",
    year: 2016,
    description:
      "Two teenagers swap bodies and chase fate across time with Makoto Shinkai's signature emotional punch.",
    tags: ["romance", "fantasy", "drama"],
  },
  {
    id: "vinland-saga",
    title: "Vinland Saga",
    category: "anime",
    format: "anime",
    totalParts: 48,
    studio: "MAPPA",
    year: 2019,
    description:
      "A revenge epic that grows into a story about pacifism, found family, and the cost of violence.",
    tags: ["historical", "drama", "character-study"],
  },
  {
    id: "one-piece",
    title: "One Piece",
    category: "anime",
    format: "anime",
    totalParts: 1100,
    studio: "Toei Animation",
    year: 1999,
    description:
      "Luffy's pirate adventure spans islands, friendships, and Devil Fruits in an endlessly inventive world.",
    tags: ["adventure", "pirates", "long-running"],
  },
  {
    id: "monster-manga",
    title: "Monster",
    category: "manga",
    format: "comic",
    totalParts: 162,
    author: "Naoki Urasawa",
    year: 1994,
    description:
      "A surgeon chases the consequences of a single choice through a slow-burn psychological thriller across Europe.",
    tags: ["thriller", "seinen", "crime"],
  },
  {
    id: "chainsaw-man",
    title: "Chainsaw Man",
    category: "manga",
    format: "comic",
    totalParts: 156,
    author: "Tatsuki Fujimoto",
    year: 2018,
    description:
      "Denji mows down devils while wrestling with absurd humor, tenderness, and horror in equal measure.",
    tags: ["action", "horror", "dark-comedy"],
  },
  {
    id: "solo-leveling",
    title: "Solo Leveling",
    category: "manhwa",
    format: "comic",
    totalParts: 201,
    author: "Chugong",
    year: 2016,
    description:
      "An underpowered hunter levels up into a force of nature inside a game-like world with stylish dungeon crawls.",
    tags: ["power-fantasy", "dungeon", "webtoon"],
  },
  {
    id: "tower-of-god",
    title: "Tower of God",
    category: "manhwa",
    format: "comic",
    totalParts: 550,
    author: "SIU",
    year: 2010,
    description:
      "Bam climbs a mysterious tower filled with tests of strength, loyalty, and morality in a sprawling saga.",
    tags: ["mystery", "power-structure", "ensemble"],
  },
];

export function findCatalogItem(id) {
  return catalog.find((item) => item.id === id);
}
