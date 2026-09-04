import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, requireAuth, requireRole } from "../middleware/auth";
import { effectiveStatus } from "../lib/listing-status";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users: users.map((u) => ({ ...u, password: undefined })) });
  }),
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      throw new ApiError("You cannot remove your own admin account.", 400);
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new ApiError("User not found", 404);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

router.get(
  "/providers",
  asyncHandler(async (_req, res) => {
    const providers = await prisma.provider.findMany({
      include: { user: true, _count: { select: { listings: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ providers: providers.map((p) => ({ ...p, user: { ...p.user, password: undefined } })) });
  }),
);

router.get(
  "/listings",
  asyncHandler(async (_req, res) => {
    const listings = await prisma.listing.findMany({
      include: { provider: true, _count: { select: { reports: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      listings: listings.map((l) => ({
        ...l,
        originalPrice: Number(l.originalPrice),
        sellingPrice: Number(l.sellingPrice),
        status: effectiveStatus(l),
        providerName: l.provider.businessName,
        reportCount: l._count.reports,
      })),
    });
  }),
);

router.delete(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) throw new ApiError("Listing not found", 404);
    const updated = await prisma.listing.update({ where: { id: req.params.id }, data: { status: "REMOVED" } });
    res.json({ listing: updated });
  }),
);

router.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      include: { listing: { include: { provider: true } }, reporter: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reports: reports.map((r) => ({ ...r, reporter: { ...r.reporter, password: undefined } })) });
  }),
);

const reportUpdateSchema = z.object({ id: z.string().min(1), status: z.enum(["REVIEWED", "DISMISSED"]) });

router.put(
  "/reports",
  asyncHandler(async (req, res) => {
    const parsed = reportUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError("Invalid report update", 400);
    const report = await prisma.report.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
    res.json({ report });
  }),
);

export default router;
