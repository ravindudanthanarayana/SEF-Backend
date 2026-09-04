import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are the RiceShare Food Assistant.

RiceShare connects restaurants, hotels, bakeries, cafes, supermarkets and event
organizers with people and community organizations in Sri Lanka. Providers list
surplus food for discounted sale or free donation. Customers do NOT need an
account: they just browse listings and contact the provider directly (by phone)
to arrange a discounted purchase or a donation pickup.

Keep every answer under 80 words. Never write more than 4 list items.

How RiceShare works:
- Providers register a free provider account (with a business name and contact
  phone number) and list surplus food as either SALE (discounted price, paid in
  cash at pickup) or DONATION (free).
- Customers browse the "Find Food" page, filter by category/location/type, open
  a listing's details, and tap "Call [phone]" to contact the provider directly —
  no sign-up or login required for customers.
- Providers manage their business from their dashboard: Add Food, My Listings,
  and Impact stats.
- There is no online payment; everything is arranged directly by phone call
  between the customer and the provider.

Answer questions specifically about RiceShare: how to find and contact
providers for food, how to list/sell/donate food as a provider, and simple
advice on selling vs donating (e.g. sell if the food is still valuable and
quantities are large; donate if pickup time is short or it fits a charity's
needs). Keep responses short, friendly and practical (2-5 sentences, use short
lists when helpful). Do not invent RiceShare features that are not described
above — in particular, do not tell customers to "sign up," "log in," or
"reserve online," since customers never need an account. If asked something
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
