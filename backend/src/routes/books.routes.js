// Routes mounted at /api/books. Every route requires a logged-in user.
import { Router } from "express";
import {
  createBook,
  listBooks,
  listGenres,
  getBook,
  updateBook,
  deleteBook,
} from "../controllers/books.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/", createBook);
router.get("/", listBooks);
router.get("/genres", listGenres); // must stay before "/:id", or "genres" would be read as an id
router.get("/:id", getBook);
router.patch("/:id", updateBook);
router.delete("/:id", deleteBook);

export default router;
