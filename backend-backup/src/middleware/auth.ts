import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/jwt";
import { ApiError } from "../lib/api-error";
import type { Role, User, Provider } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      provider?: Provider;
    }
  }
}

export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError("You must be signed in to do this.", 401);

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new ApiError("You must be signed in to do this.", 401);

    req.user = user;
    next();
  } catch {
    next(new ApiError("You must be signed in to do this.", 401));
  }
}

export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError("You must be signed in to do this.", 401));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError("You don't have permission to do this.", 403));
    }
    next();
  };
}

export async function requireProvider(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError("You must be signed in to do this.", 401);
    if (req.user.role !== "PROVIDER" && req.user.role !== "ADMIN") {
      throw new ApiError("You don't have permission to do this.", 403);
    }
    const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
    if (!provider) throw new ApiError("Set up your provider profile first.", 403);
    req.provider = provider;
    next();
  } catch (err) {
    next(err);
  }
}
