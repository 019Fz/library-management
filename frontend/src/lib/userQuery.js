// URL state of the admin Users page (?q=&role=&sort=&order=&page=), built with createListQuery.
import { createListQuery, oneOf } from "./listQuery.js";

export const USER_PAGE_SIZE = 10;

export const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
];

// Options of the sort dropdown; "value" is "<sort>:<order>"
export const USER_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "name:asc", label: "Name A-Z" },
  { value: "name:desc", label: "Name Z-A" },
  { value: "email:asc", label: "Email A-Z" },
  { value: "email:desc", label: "Email Z-A" },
  { value: "books:desc", label: "Most books" },
  { value: "books:asc", label: "Fewest books" },
];

export const userListQuery = createListQuery({
  pageSize: USER_PAGE_SIZE,
  filters: { q: null, role: oneOf(["user", "admin"]) },
  sorts: ["createdAt", "name", "email", "books"],
});
export const useUserQuery = userListQuery.useListQuery;
