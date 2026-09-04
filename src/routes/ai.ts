import { Router } from "express";
import { prisma } from "../lib/prisma";
import { askFoodAssistant } from "../lib/gemini";
import { chatMessageSchema } from "../lib/validation";
import { effectiveStatus } from "../lib/listing-status";

const router = Router();

router.post("/chat", async (req, res) => {
  const parsed = chatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
    return;
  }

  try {
    const activeListings = await prisma.listing.findMany({
      where: { status: { notIn: ["CLOSED", "REMOVED"] }, pickupEnd: { gt: new Date() } },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const listingContext = activeListings
      .map((l) => {
        const status = effectiveStatus(l);
        const price = l.listingType === "DONATION" ? "FREE" : `Rs. ${Number(l.sellingPrice)}`;
        return `- ${l.foodName} (${l.category}) by ${l.provider.businessName} in ${l.location}: ${l.listingType}, ${price}, ${l.quantityRemaining} portion(s) left, status ${status}`;
      })
      .join("\n");

    const reply = await askFoodAssistant(parsed.data.message, parsed.data.history, listingContext);
    res.json({ message: reply });
  } catch (error) {
    console.error("AI chat error:", error);
    res.json({
      message:
        "Sorry, the RiceShare AI Assistant is temporarily unavailable. In the meantime: browse food on the Find Food page, tap Reserve Food for sale listings (pay at pickup) or Request Donation for free listings.",
      fallback: true,
    });
  }
});

export default router;
