import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler, requireAuth } from "../middleware/auth";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = await prisma.provider.findUnique({ where: { userId: req.user!.id } });
    res.json({ provider });
  }),
);

export default router;
