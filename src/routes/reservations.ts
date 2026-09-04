import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, requireAuth } from "../middleware/auth";
import { reservationCreateSchema } from "../lib/validation";
import { z } from "zod";
import type { Reservation, Listing, Provider } from "@prisma/client";

const router = Router();

function serialize(reservation: Reservation & { listing: Listing & { provider: Provider } }) {
  return {
    ...reservation,
    totalAmount: Number(reservation.totalAmount),
    listing: {
      ...reservation.listing,
      originalPrice: Number(reservation.listing.originalPrice),
      sellingPrice: Number(reservation.listing.sellingPrice),
      providerName: reservation.listing.provider.businessName,
    },
  };
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const scope = req.query.scope as string | undefined;
    const where =
      scope === "provider"
        ? { listing: { provider: { userId: req.user!.id } } }
        : { userId: req.user!.id };

    const reservations = await prisma.reservation.findMany({
      where,
      include: { listing: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reservations: reservations.map(serialize) });
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = reservationCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid reservation", 400);
    const { listingId, name, phone, quantity } = parsed.data;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new ApiError("Listing not found", 404);
    if (listing.listingType !== "SALE") {
      throw new ApiError("This listing is a donation. Use a donation request instead.", 400);
    }
    if (listing.pickupEnd.getTime() < Date.now()) {
      throw new ApiError("The pickup window for this listing has already ended.", 400);
    }
    if (listing.quantityRemaining < quantity) {
      throw new ApiError(`Only ${listing.quantityRemaining} portion(s) remaining.`, 400);
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.listing.updateMany({
        where: {
          id: listingId,
          listingType: "SALE",
          status: { notIn: ["CLOSED", "REMOVED"] },
          pickupEnd: { gt: new Date() },
          quantityRemaining: { gte: quantity },
        },
        data: { quantityRemaining: { decrement: quantity } },
      });

      if (updateResult.count === 0) {
        throw new ApiError(
          "This listing is no longer available in that quantity. Please refresh and try again.",
          409,
        );
      }

      const updatedListing = await tx.listing.findUniqueOrThrow({ where: { id: listingId } });
      if (updatedListing.quantityRemaining === 0) {
        await tx.listing.update({ where: { id: listingId }, data: { status: "SOLD_OUT" } });
      }

      return tx.reservation.create({
        data: {
          listingId,
          userId: req.user!.id,
          name,
          phone,
          quantity,
          totalAmount: Number(listing.sellingPrice) * quantity,
          status: "CONFIRMED",
        },
        include: { listing: { include: { provider: true } } },
      });
    });

    res.status(201).json({ reservation: serialize(reservation) });
  }),
);

const updateSchema = z.object({ status: z.enum(["COLLECTED", "CANCELLED"]) });

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid status", 400);

    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { listing: { include: { provider: true } } },
    });
    if (!reservation) throw new ApiError("Reservation not found", 404);

    const isOwner = reservation.userId === req.user!.id;
    const isProvider = reservation.listing.provider.userId === req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    if (!isOwner && !isProvider && !isAdmin) {
      throw new ApiError("You don't have permission to update this reservation", 403);
    }
    if (parsed.data.status === "COLLECTED" && !isProvider && !isAdmin) {
      throw new ApiError("Only the provider can mark a reservation as collected", 403);
    }
    if (reservation.status === "COLLECTED" || reservation.status === "CANCELLED") {
      throw new ApiError(`Reservation is already ${reservation.status.toLowerCase()}`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === "CANCELLED") {
        await tx.listing.update({
          where: { id: reservation.listingId },
          data: {
            quantityRemaining: { increment: reservation.quantity },
            status: reservation.listing.status === "SOLD_OUT" ? "AVAILABLE" : undefined,
          },
        });
      }
      return tx.reservation.update({
        where: { id: req.params.id },
        data: { status: parsed.data.status },
        include: { listing: { include: { provider: true } } },
      });
    });

    res.json({ reservation: serialize(updated) });
  }),
);

export default router;
