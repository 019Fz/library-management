// Routes mounted at /api/ai. Every route needs a logged-in user and counts towards the rate limit.
import { Router } from "express";
import { askQuestion, listExamples } from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.use(authenticate, aiRateLimit);

router.post("/query", askQuestion);
router.get("/examples", listExamples);

export default router;
