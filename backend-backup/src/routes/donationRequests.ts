import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, requireAuth } from "../middleware/auth";
import { donationRequestCreateSchema } from "../lib/validation";
import type { DonationRequest, Listing, Provider } from "@prisma/client";

const router = Router();

function serialize(request: DonationRequest & { listing: Listing & { provider: Provider } }) {
  return {
    ...request,
    listing: {
      ...request.listing,
      originalPrice: Number(request.listing.originalPrice),
      sellingPrice: Number(request.listing.sellingPrice),
      providerName: request.listing.provider.businessName,
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

    const requests = await prisma.donationRequest.findMany({
      where,
      include: { listing: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ donationRequests: requests.map(serialize) });
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = donationRequestCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid donation request", 400);
    const { listingId, name, phone, quantity, reason } = parsed.data;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new ApiError("Listing not found", 404);
    if (listing.listingType !== "DONATION") {
      throw new ApiError("This listing is for sale. Use a reservation instead.", 400);
    }
    if (listing.pickupEnd.getTime() < Date.now()) {
      throw new ApiError("The pickup window for this listing has already ended.", 400);
    }
    if (listing.quantityRemaining < quantity) {
      throw new ApiError(`Only ${listing.quantityRemaining} portion(s) remaining.`, 400);
    }
    if (listing.status === "CLOSED" || listing.status === "REMOVED") {
      throw new ApiError("This listing is no longer accepting requests.", 400);
    }

    const donationRequest = await prisma.donationRequest.create({
      data: { listingId, userId: req.user!.id, name, phone, quantity, reason },
      include: { listing: { include: { provider: true } } },
    });

    res.status(201).json({ donationRequest: serialize(donationRequest) });
  }),
);

const updateSchema = z.object({ status: z.enum(["ACCEPTED", "REJECTED", "COLLECTED", "CANCELLED"]) });

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid status", 400);
    const nextStatus = parsed.data.status;

    const request = await prisma.donationRequest.findUnique({
      where: { id: req.params.id },
      include: { listing: { include: { provider: true } } },
    });
    if (!request) throw new ApiError("Donation request not found", 404);

    const isOwner = request.userId === req.user!.id;
    const isProvider = request.listing.provider.userId === req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    if (nextStatus === "CANCELLED") {
      if (!isOwner && !isAdmin) throw new ApiError("Only the requester can cancel this request", 403);
    } else if (!isProvider && !isAdmin) {
      throw new ApiError("Only the provider can accept, reject, or complete this request", 403);
    }
    if (request.status !== "PENDING" && nextStatus !== "COLLECTED") {
      throw new ApiError(`Request is already ${request.status.toLowerCase()}`, 400);
    }
    if (nextStatus === "COLLECTED" && request.status !== "ACCEPTED") {
      throw new ApiError("Only accepted requests can be marked as collected", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (nextStatus === "ACCEPTED") {
        const result = await tx.listing.updateMany({
          where: {
            id: request.listingId,
            status: { notIn: ["CLOSED", "REMOVED"] },
            quantityRemaining: { gte: request.quantity },
          },
          data: { quantityRemaining: { decrement: request.quantity } },
        });
        if (result.count === 0) {
          throw new ApiError("Not enough portions remaining to accept this request.", 409);
        }
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: request.listingId } });
        if (listing.quantityRemaining === 0) {
          await tx.listing.update({ where: { id: request.listingId }, data: { status: "SOLD_OUT" } });
        }
      }
      return tx.donationRequest.update({
        where: { id: req.params.id },
        data: { status: nextStatus },
        include: { listing: { include: { provider: true } } },
      });
    });

    res.json({ donationRequest: serialize(updated) });
  }),
);

export default router;
