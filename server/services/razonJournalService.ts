import { randomUUID } from "crypto";
import type {
  RazonJournalDecisionSummary,
  RazonJournalEntry,
  RazonMarketInput,
  RazonSignalDecision,
  RazonSignalOutput,
} from "../types/razon";

const entries: RazonJournalEntry[] = [];
const MAX_ENTRIES = 100;

const decisions: Array<{
  title: RazonJournalDecisionSummary["title"];
  decision: RazonSignalDecision;
}> = [
  { title: "Why BUY", decision: "BUY" },
  { title: "Why SELL", decision: "SELL" },
  { title: "Why WAIT", decision: "WAIT" },
];

export const razonJournalService = {
  recordDecision(input: RazonMarketInput, output: RazonSignalOutput): RazonJournalEntry {
    const entry: RazonJournalEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      input,
      decision: output.decision ?? output.signal,
      confidence: output.confidence,
      reasons: output.reasons,
    };

    entries.unshift(entry);

    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }

    return entry;
  },

  listEntries(): RazonJournalEntry[] {
    return [...entries];
  },

  getDecisionSummary(): RazonJournalDecisionSummary[] {
    return decisions.map(item => ({
      ...item,
      entries: entries.filter(entry => entry.decision === item.decision),
    }));
  },
};
