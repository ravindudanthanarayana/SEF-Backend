import { Router } from "express";
import { asyncHandler } from "../middleware/auth";
import { getImpactStats } from "../lib/stats";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const stats = await getImpactStats();
    res.json(stats);
  }),
);

export default router;
