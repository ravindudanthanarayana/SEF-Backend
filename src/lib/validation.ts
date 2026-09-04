import { z } from "zod";
import { CATEGORIES } from "./constants";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export const providerRegisterSchema = registerSchema.extend({
  businessName: z.string().trim().min(2, "Business name is required").max(120),
  businessType: z.string().trim().min(2, "Business type is required").max(60),
  location: z.string().trim().min(2, "Location is required").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const listingCreateSchema = z
  .object({
    foodName: z.string().trim().min(2, "Food name must be at least 2 characters").max(100),
    category: z.enum(CATEGORIES, { message: "Please choose a valid category" }),
    quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
    listingType: z.enum(["SALE", "DONATION"]),
    originalPrice: z.coerce.number().min(0, "Price cannot be negative"),
    sellingPrice: z.coerce.number().min(0, "Price cannot be negative"),
    location: z.string().trim().min(2, "Location is required").max(100),
    pickupStart: z.coerce.date(),
    pickupEnd: z.coerce.date(),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(1000, "Description must be under 1000 characters"),
    imageUrl: z.string().trim().url().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.pickupEnd <= data.pickupStart) {
      ctx.addIssue({ code: "custom", path: ["pickupEnd"], message: "Pickup end must be after pickup start" });
    }
    if (data.pickupEnd < new Date()) {
      ctx.addIssue({ code: "custom", path: ["pickupEnd"], message: "Pickup end must be in the future" });
    }
    if (data.listingType === "SALE") {
      if (data.sellingPrice > data.originalPrice) {
        ctx.addIssue({ code: "custom", path: ["sellingPrice"], message: "Selling price cannot exceed original price" });
      }
      if (data.originalPrice <= 0) {
        ctx.addIssue({ code: "custom", path: ["originalPrice"], message: "Original price must be greater than 0 for a sale listing" });
      }
    }
  })
  .transform((data) => ({
    ...data,
    sellingPrice: data.listingType === "DONATION" ? 0 : data.sellingPrice,
  }));

export const listingUpdateSchema = z.object({
  foodName: z.string().trim().min(2).max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  originalPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  location: z.string().trim().min(2).max(100).optional(),
  pickupStart: z.coerce.date().optional(),
  pickupEnd: z.coerce.date().optional(),
  description: z.string().trim().min(10).max(1000).optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["AVAILABLE", "ENDING_SOON", "SOLD_OUT", "EXPIRED", "CLOSED", "REMOVED"]).optional(),
});

export const reservationCreateSchema = z.object({
  listingId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required").max(80),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
});

export const donationRequestCreateSchema = z.object({
  listingId: z.string().min(1),
  name: z.string().trim().min(2, "Name / organization is required").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  reason: z.string().trim().min(5, "Please tell us a bit about your request").max(500),
});

export const reportCreateSchema = z.object({
  listingId: z.string().min(1),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(500),
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
});
