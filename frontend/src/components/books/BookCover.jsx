// Generated book cover: a 2:3 gradient chosen from the genre, with a spine shadow on the left.
// Books of the same genre always get the same colors. The class names are written out in full
// so Tailwind can find them.
const GRADIENTS = [
  "from-cover-1-from to-cover-1-to",
  "from-cover-2-from to-cover-2-to",
  "from-cover-3-from to-cover-3-to",
  "from-cover-4-from to-cover-4-to",
  "from-cover-5-from to-cover-5-to",
  "from-cover-6-from to-cover-6-to",
  "from-cover-7-from to-cover-7-to",
  "from-cover-8-from to-cover-8-to",
];

// Simple string hash. Lowercased, so "Sci-Fi" and "sci-fi" get the same cover.
function hashGenre(genre) {
  let hash = 0;
  for (const character of genre.toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export default function BookCover({ title, author, genre }) {
  const gradient = GRADIENTS[hashGenre(genre) % GRADIENTS.length];

  // aria-hidden: the card shows the title and author as text right below, so screen readers skip this
  return (
    <div
      aria-hidden="true"
      className={`relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-field bg-linear-to-br ${gradient} p-3 pl-6 text-on-cover shadow-md sm:p-4 sm:pl-7`}
    >
      {/* Spine: a dark fade and a thin light line on the left edge */}
      <div className="absolute inset-y-0 left-0 w-4 bg-linear-to-r from-ink/45 to-transparent" />
      <div className="absolute inset-y-0 left-4 w-px bg-on-cover/25" />

      <p className="line-clamp-4 text-base font-bold leading-tight sm:text-lg">{title}</p>
      <p className="truncate text-xs font-medium sm:text-sm">{author}</p>
    </div>
  );
}
