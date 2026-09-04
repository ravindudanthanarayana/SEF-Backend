import { prisma } from "./prisma";

export async function getImpactStats() {
  const [reservations, donationRequests, providerCount] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: { in: ["CONFIRMED", "COLLECTED"] } },
      include: { listing: true },
    }),
    prisma.donationRequest.findMany({
      where: { status: { in: ["ACCEPTED", "COLLECTED"] } },
    }),
    prisma.provider.count(),
  ]);

  const mealsSold = reservations.reduce((sum, r) => sum + r.quantity, 0);
  const mealsDonated = donationRequests.reduce((sum, d) => sum + d.quantity, 0);
  const moneySaved = reservations.reduce(
    (sum, r) => sum + (Number(r.listing.originalPrice) - Number(r.listing.sellingPrice)) * r.quantity,
    0,
  );

  return {
    mealsRescued: mealsSold + mealsDonated,
    mealsDonated,
    moneySaved: Math.round(moneySaved),
    foodProviders: providerCount,
  };
}
