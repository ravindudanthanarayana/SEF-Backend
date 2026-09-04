import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, requireAuth } from "../middleware/auth";
import { reportCreateSchema } from "../lib/validation";

const router = Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = reportCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid report", 400);
    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
    if (!listing) throw new ApiError("Listing not found", 404);

    const report = await prisma.report.create({ data: { ...parsed.data, reportedBy: req.user!.id } });
    res.status(201).json({ report });
  }),
);

export default router;
