// URL state of the books page (?q=&genre=&status=&sort=&order=&page=) and of the admin "All books"
// page (the same plus ?userId=). Both are built with createListQuery (see listQuery.js).
import { createListQuery, oneOf, positiveInt } from "./listQuery.js";
import { STATUS_LABELS } from "./format.js";

export const PAGE_SIZE = 12;

const SORTS = ["createdAt", "title", "price"];
const BOOK_FILTERS = { q: null, genre: null, status: oneOf(Object.keys(STATUS_LABELS)) };

// Options of the sort dropdown; "value" is "<sort>:<order>"
export const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "title:asc", label: "Title A-Z" },
  { value: "title:desc", label: "Title Z-A" },
  { value: "price:asc", label: "Price low to high" },
  { value: "price:desc", label: "Price high to low" },
];

export const bookListQuery = createListQuery({ pageSize: PAGE_SIZE, filters: BOOK_FILTERS, sorts: SORTS });
export const useBookQuery = bookListQuery.useListQuery;

// Admin: all users' books, optionally only one owner's (userId)
export const adminBookListQuery = createListQuery({
  pageSize: PAGE_SIZE,
  filters: { ...BOOK_FILTERS, userId: positiveInt },
  sorts: SORTS,
});
export const useAdminBookQuery = adminBookListQuery.useListQuery;
