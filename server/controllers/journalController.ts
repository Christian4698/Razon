import type { Request, Response } from "express";
import { razonJournalService } from "../services/razonJournalService";
import { sendJson } from "../utils/http";

export function getJournal(_req: Request, res: Response) {
  return sendJson(res, {
    mode: "demo" as const,
    entries: razonJournalService.listEntries(),
    tradeProposals: razonJournalService.listTradeProposals(),
    decisionSummary: razonJournalService.getDecisionSummary(),
  });
}
