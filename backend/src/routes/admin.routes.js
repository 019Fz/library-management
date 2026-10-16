// Routes mounted at /api/admin. Admins only: authenticate gives 401, requireAdmin gives 403.
import { Router } from "express";
import {
  getStats,
  listUsers,
  updateUserRole,
  deleteUser,
  listAllGenres,
  listAdminBooks,
  getAdminBook,
  updateAdminBook,
  deleteAdminBook,
} from "../controllers/admin.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/stats", getStats);

router.get("/users", listUsers);
router.patch("/users/:id", updateUserRole);
router.delete("/users/:id", deleteUser);

router.get("/genres", listAllGenres);

// Fixed paths come before "/:id" routes
router.get("/books", listAdminBooks);
router.get("/books/:id", getAdminBook);
router.patch("/books/:id", updateAdminBook);
router.delete("/books/:id", deleteAdminBook);

export default router;
