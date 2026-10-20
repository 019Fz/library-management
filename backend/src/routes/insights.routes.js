// Routes mounted at /api/insights. Any logged-in user; each user only ever gets their own insights.
import { Router } from "express";
import { getMyInsights, getRecommendations } from "../controllers/insights.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/me", getMyInsights);
router.get("/recommendations", getRecommendations);

export default router;
