import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { asyncHandler, requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { registerSchema, providerRegisterSchema, loginSchema } from "../lib/validation";

const router = Router();

function serializeUser(user: { id: string; name: string; email: string; role: string; createdAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

// Customer registration
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid details", 400);

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new ApiError("An account with this email already exists.", 400);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await hashPassword(parsed.data.password),
        role: "CUSTOMER",
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ token, user: serializeUser(user) });
  }),
);

// Provider registration (creates user + provider profile together)
router.post(
  "/provider-register",
  asyncHandler(async (req, res) => {
    const parsed = providerRegisterSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid details", 400);

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new ApiError("An account with this email already exists.", 400);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await hashPassword(parsed.data.password),
        role: "PROVIDER",
        provider: {
          create: {
            businessName: parsed.data.businessName,
            businessType: parsed.data.businessType,
            location: parsed.data.location,
            phone: parsed.data.phone,
          },
        },
      },
      include: { provider: true },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ token, user: serializeUser(user), provider: user.provider });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid login", 400);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) throw new ApiError("Incorrect email or password.", 401);

    const valid = await verifyPassword(parsed.data.password, user.password);
    if (!valid) throw new ApiError("Incorrect email or password.", 401);

    const provider = await prisma.provider.findUnique({ where: { userId: user.id } });
    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: serializeUser(user), provider });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = await prisma.provider.findUnique({ where: { userId: req.user!.id } });
    res.json({ user: serializeUser(req.user!), provider });
  }),
);

export default router;
