import { Router } from "express";
import { getJournal } from "../controllers/journalController";

export const journalRoutes = Router();

journalRoutes.get("/journal", getJournal);
