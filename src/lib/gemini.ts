import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are the RiceShare Food Assistant.

RiceShare connects restaurants, hotels, bakeries, cafes, supermarkets and event
organizers with people and community organizations in Sri Lanka. Providers can
list surplus food for discounted sale ("Reserve & Pay at Pickup", no online
payment) or free donation. Customers and community organizations can search,
reserve, and request food.

Keep every answer under 80 words. Never write more than 4 list items.

How RiceShare works:
- Providers list surplus food as either SALE (discounted price, customer taps
  "Reserve Food" and pays cash at pickup) or DONATION (free, customer taps
  "Request Donation" and the provider accepts or rejects the request).
- Customers browse the "Find Food" page, filter by category/location/type, and
  view details before reserving or requesting.
- Providers manage everything from their dashboard: Add Food, My Listings,
  Reservations, Donation Requests, and Impact stats.
- There is no online payment for sales; customers pay when they pick up the food.

Answer questions specifically about RiceShare: how to reserve, how donations
work, how to list/sell/donate food, and simple advice on selling vs donating
(e.g. sell if the food is still valuable and quantities are large; donate if
pickup time is short or it fits a charity's needs). Keep responses short,
friendly and practical (2-5 sentences, use short lists when helpful). Do not
invent RiceShare features that are not described above. If asked something
unrelated to RiceShare or food sharing, politely explain you can only help
with RiceShare questions.`;

type ChatHistoryItem = { role: "user" | "model"; text: string };

let client: GoogleGenAI | null = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function askFoodAssistant(
  message: string,
  history: ChatHistoryItem[] = [],
  listingContext?: string,
) {
  const ai = getClient();
  if (!ai) {
    throw new Error("AI assistant is not configured. Missing GEMINI_API_KEY.");
  }

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  const systemInstruction = listingContext
    ? `${SYSTEM_INSTRUCTION}\n\nCurrent live listings on RiceShare (use this only if relevant to the question, and don't dump the whole list unless asked):\n${listingContext}`
    : SYSTEM_INSTRUCTION;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents,
    config: {
      systemInstruction,
      maxOutputTokens: 1024,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(25000),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("The AI assistant did not return a response.");
  }
  return text.trim();
}
