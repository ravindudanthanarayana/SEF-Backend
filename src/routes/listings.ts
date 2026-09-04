import { Router } from "express";
import type { Prisma, Listing, Provider } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, attachUserIfPresent, requireAuth, requireProvider } from "../middleware/auth";
import { listingCreateSchema, listingUpdateSchema } from "../lib/validation";
import { effectiveStatus } from "../lib/listing-status";

const router = Router();

function serializeListing(listing: Listing & { provider: Provider }) {
  return {
    ...listing,
    originalPrice: Number(listing.originalPrice),
    sellingPrice: Number(listing.sellingPrice),
    status: effectiveStatus(listing),
    providerName: listing.provider.businessName,
    providerPhone: listing.provider.phone,
  };
}

router.get(
  "/",
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { q, category, location, type, sort, mine } = req.query as Record<string, string | undefined>;

    const where: Prisma.ListingWhereInput = {};

    if (mine === "true") {
      if (!req.user) throw new ApiError("You must be signed in to do this.", 401);
      const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
      if (!provider) throw new ApiError("Set up your provider profile first.", 403);
      where.providerId = provider.id;
    } else {
      where.status = { notIn: ["CLOSED", "REMOVED"] };
    }

    if (q) {
      where.OR = [
        { foodName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { provider: { businessName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (category) where.category = category;
    if (location) where.location = { contains: location, mode: "insensitive" };
    if (type === "SALE" || type === "DONATION") where.listingType = type;

    let orderBy: Prisma.ListingOrderByWithRelationInput = { createdAt: "desc" };
    if (sort === "price-asc") orderBy = { sellingPrice: "asc" };
    if (sort === "price-desc") orderBy = { sellingPrice: "desc" };
    if (sort === "pickup-soon") orderBy = { pickupEnd: "asc" };

    const listings = await prisma.listing.findMany({
      where,
      include: { provider: true },
      orderBy,
      take: 100,
    });

    let results = listings.map(serializeListing);
    if (mine !== "true") {
      results = results.filter((l) => l.status !== "EXPIRED");
    }

    res.json({ listings: results });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: { provider: true } });
    if (!listing) throw new ApiError("Listing not found", 404);
    res.json({ listing: serializeListing(listing) });
  }),
);

router.post(
  "/",
  requireAuth,
  requireProvider,
  asyncHandler(async (req, res) => {
    const parsed = listingCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid listing data", 400);
    const data = parsed.data;

    const listing = await prisma.listing.create({
      data: {
        providerId: req.provider!.id,
        foodName: data.foodName,
        category: data.category,
        quantity: data.quantity,
        quantityRemaining: data.quantity,
        originalPrice: data.originalPrice,
        sellingPrice: data.sellingPrice,
        listingType: data.listingType,
        location: data.location,
        pickupStart: data.pickupStart,
        pickupEnd: data.pickupEnd,
        description: data.description,
        imageUrl: data.imageUrl || null,
      },
      include: { provider: true },
    });

    res.status(201).json({ listing: serializeListing(listing) });
  }),
);

async function getOwnedListing(id: string, userId: string, role: string) {
  const listing = await prisma.listing.findUnique({ where: { id }, include: { provider: true } });
  if (!listing) throw new ApiError("Listing not found", 404);
  if (role !== "ADMIN" && listing.provider.userId !== userId) {
    throw new ApiError("You can only manage your own listings", 403);
  }
  return listing;
}

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await getOwnedListing(req.params.id, req.user!.id, req.user!.role);

    const parsed = listingUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid update", 400);
    const data = parsed.data;

    const nextOriginalPrice = data.originalPrice ?? Number(existing.originalPrice);
    const nextSellingPrice =
      existing.listingType === "DONATION" ? 0 : (data.sellingPrice ?? Number(existing.sellingPrice));
    if (existing.listingType === "SALE" && nextSellingPrice > nextOriginalPrice) {
      throw new ApiError("Selling price cannot exceed original price", 400);
    }

    let nextQuantity = existing.quantity;
    let nextRemaining = existing.quantityRemaining;
    if (data.quantity !== undefined) {
      const reservedOrDonated = existing.quantity - existing.quantityRemaining;
      if (data.quantity < reservedOrDonated) {
        throw new ApiError(
          `Quantity can't be less than the ${reservedOrDonated} portion(s) already reserved/donated`,
          400,
        );
      }
      nextQuantity = data.quantity;
      nextRemaining = data.quantity - reservedOrDonated;
    }

    if (data.pickupStart && data.pickupEnd && data.pickupEnd <= data.pickupStart) {
      throw new ApiError("Pickup end must be after pickup start", 400);
    }

    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        foodName: data.foodName,
        category: data.category,
        quantity: nextQuantity,
        quantityRemaining: nextRemaining,
        originalPrice: nextOriginalPrice,
        sellingPrice: nextSellingPrice,
        location: data.location,
        pickupStart: data.pickupStart,
        pickupEnd: data.pickupEnd,
        description: data.description,
        imageUrl: data.imageUrl || undefined,
        status: data.status,
      },
      include: { provider: true },
    });

    res.json({ listing: serializeListing(listing) });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await getOwnedListing(req.params.id, req.user!.id, req.user!.role);
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: { status: "CLOSED" },
      include: { provider: true },
    });
    res.json({ listing: serializeListing(listing) });
  }),
);

export default router;
