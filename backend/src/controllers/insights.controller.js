// Insights for the logged-in user. The user always comes from the token (authenticate), never from the request.
import { userInsights, recommendationsFor } from "../lib/insightQueries.js";

export async function getMyInsights(req, res) {
  res.json(await userInsights(req.user.id, "you"));
}

export async function getRecommendations(req, res) {
  res.json({ recommendations: await recommendationsFor(req.user.id) });
}
