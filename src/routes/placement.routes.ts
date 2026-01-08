import { Router } from "express";
import { startPlacement, nextQuestion } 
from "../controllers/placement.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/start", authMiddleware, startPlacement);
router.post("/next", authMiddleware, nextQuestion);

export default router;
