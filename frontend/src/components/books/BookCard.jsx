// One book in the grid, with edit and delete buttons.
import BookCover from "./BookCover.jsx";
import StatusBadge from "./StatusBadge.jsx";
import Badge from "../ui/Badge.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import Icon from "../ui/Icon.jsx";
import { formatPrice } from "../../lib/format.js";

// Icon button for the card actions: 44px touch target, visible focus ring
const ACTION =
  "flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink focus-ring";

// onEdit / onDelete are called with the book and the clicked button (so focus can return to it)
export default function BookCard({ book, onEdit, onDelete }) {
  return (
    <article className="group flex h-full flex-col rounded-card border border-line bg-card p-3 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <BookCover title={book.title} author={book.author} genre={book.genre} />

      <h2 className="mt-3 line-clamp-2 font-semibold leading-snug text-ink">{book.title}</h2>
      <p className="truncate text-sm text-muted">{book.author}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" className="max-w-full truncate">
          {book.genre}
        </Badge>
        <StatusBadge status={book.status} />
      </div>

      <p className="mt-auto pt-3 text-lg font-bold text-ink">{formatPrice(book.price)}</p>

      {/* Always visible on touch screens. Where hovering exists they appear on card hover or keyboard focus
          (the space is reserved, so nothing jumps). */}
      <div className="-mb-1 mt-1 flex justify-end gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        <button type="button" onClick={(event) => onEdit(book, event.currentTarget)} aria-label={`Edit ${book.title}`} className={ACTION}>
          <Icon name="edit" />
        </button>
        <button type="button" onClick={(event) => onDelete(book, event.currentTarget)} aria-label={`Delete ${book.title}`} className={ACTION}>
          <Icon name="trash" />
        </button>
      </div>
    </article>
  );
}

// Gray placeholder with the same shape, shown while books load
export function BookCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-card border border-line bg-card p-3 shadow-sm">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-3 h-6 w-1/3" />
    </div>
  );
}
