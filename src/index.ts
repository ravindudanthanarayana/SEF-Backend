import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error-handler";
import authRoutes from "./routes/auth";
import listingsRoutes from "./routes/listings";
import reservationsRoutes from "./routes/reservations";
import donationRequestsRoutes from "./routes/donationRequests";
import providersRoutes from "./routes/providers";
import reportsRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";
import aiRoutes from "./routes/ai";
import statsRoutes from "./routes/stats";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/donation-requests", donationRequestsRoutes);
app.use("/api/providers", providersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/stats", statsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`RiceShare backend listening on http://localhost:${port}`);
});
