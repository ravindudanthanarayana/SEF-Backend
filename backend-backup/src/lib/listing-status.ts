import type { ListingStatus } from "@prisma/client";

const ENDING_SOON_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function effectiveStatus(listing: {
  status: ListingStatus;
  quantityRemaining: number;
  pickupEnd: Date;
}): ListingStatus {
  if (listing.status === "CLOSED" || listing.status === "REMOVED") {
    return listing.status;
  }
  if (listing.pickupEnd.getTime() < Date.now()) {
    return "EXPIRED";
  }
  if (listing.quantityRemaining <= 0) {
    return "SOLD_OUT";
  }
  if (listing.pickupEnd.getTime() - Date.now() < ENDING_SOON_WINDOW_MS) {
    return "ENDING_SOON";
  }
  return "AVAILABLE";
}
