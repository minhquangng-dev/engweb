import express, { Request, Response } from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

import authRoutes from "./routes/auth.routes";

app.use("/api/auth", authRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export default app;

import meRoutes from "./routes/me.routes";

app.use("/api/me", meRoutes);

import placementRoutes from "./routes/placement.routes";

app.use("/api/placement", placementRoutes);

import adminRoutes from "./routes/admin.routes";
app.use("/api/admin", adminRoutes);

import requestRoutes from "./routes/request.routes";
app.use("/api/requests", requestRoutes);

import publicRoutes from "./routes/public.routes";
app.use("/api/public", publicRoutes);