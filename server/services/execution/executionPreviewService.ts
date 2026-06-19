import type { CurrentUserScope } from "../connectors/connectorSecretsRepository";
import { marketAggregator } from "../market/marketAggregator";
import type { MarketTimeframe } from "../market/marketProvider";
import { razonJournalService } from "../razonJournalService";

export interface ExecutionPreviewInput {
  symbol?: string;
  timeframe?: MarketTimeframe;
  userStake?: number;
  targetAccount?: "DEMO" | "REAL";
  userAcceptedExtraRisk?: boolean;
}

function directionFor(decision: string) {
  if (decision === "BUY") return "UP";
  if (decision === "SELL") return "DOWN";
  return "WAIT";
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

export async function buildExecutionPreview(input: ExecutionPreviewInput, user?: CurrentUserScope | null) {
  const symbol = input.symbol?.trim() || "Boom 500";
  const timeframe = input.timeframe ?? "5m";
  const [analysis, snapshot] = await Promise.all([
    marketAggregator.getKalos(symbol, timeframe, user ?? undefined),
    marketAggregator.getSnapshot(symbol, timeframe, user ?? undefined),
  ]);
  const recommendedStake = analysis.statisticalRisk?.recommendedStake ?? 0;
  const userStake = typeof input.userStake === "number" && Number.isFinite(input.userStake) ? input.userStake : recommendedStake;
  const riskReward = analysis.statisticalRisk?.riskReward ?? 0;
  const expectedGain = Math.max(0, userStake * riskReward);
  const maxAcceptedLoss = Math.max(0, userStake * 0.25);
  const idealProfitWindow = analysis.adaptiveHorizon?.profitWindowSeconds ?? analysis.signalHorizon?.maxProfitWindowSeconds ?? 0;
  const userOverride =
    userStake > recommendedStake ||
    userStake > maxAcceptedLoss * 4 ||
    idealProfitWindow < 60 ||
    (analysis.statisticalRisk?.drawdown.dailyDrawdown ?? 0) > 5;
  const warnings = [
    userOverride ? "Vous depassez la recommandation RAZON. Confirmez que vous acceptez le risque supplementaire." : null,
    input.targetAccount === "REAL" ? "REAL execution is locked and unavailable." : null,
    analysis.adaptiveHorizon?.noTradeReason ? `NO_TRADE: ${analysis.adaptiveHorizon.noTradeReason}` : null,
  ].filter((item): item is string => Boolean(item));

  const preview = {
    id: `preview-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    signal: analysis.decision,
    market: snapshot.symbol,
    capital: 10_000,
    currency: "USD",
    direction: directionFor(analysis.decision),
    standardAction: analysis.decision,
    confidence: analysis.confidence,
    calibratedConfidence: analysis.statisticalRisk?.calibratedConfidence ?? analysis.confidence,
    recommendedStake: round(recommendedStake),
    userStake: round(userStake),
    TP: analysis.tp,
    SL: analysis.sl,
    expectedValue: analysis.statisticalRisk?.expectedValue ?? null,
    riskReward,
    expectedGain: round(expectedGain),
    maxAcceptedLoss: round(maxAcceptedLoss),
    idealProfitWindow,
    validityWindow: analysis.adaptiveHorizon?.validForSeconds ?? analysis.signalHorizon?.remainingSeconds ?? 0,
    invalidation: analysis.invalidationLevel,
    expiry: analysis.signalHorizon?.expirationTime ?? null,
    noTradeReason: analysis.adaptiveHorizon?.noTradeReason ?? analysis.statisticalRisk?.noTradeReason ?? null,
    resultSimulated: "PENDING_PREVIEW",
    userOverride,
    userAcceptedExtraRisk: input.userAcceptedExtraRisk === true,
    targetAccount: input.targetAccount ?? "DEMO",
    source: analysis.source ?? snapshot.ticker.source,
    liveExecutionAllowed: false as const,
    autoExecutionAllowed: false as const,
    orderPlacementAllowed: false as const,
    warnings,
  };

  const journalEntry = razonJournalService.recordTradeProposal(preview);

  return {
    connected: true,
    preview,
    journalEntryId: journalEntry.id,
    liveExecutionEnabled: false as const,
    automaticTradingAllowed: false as const,
    orderPlacementAllowed: false as const,
  };
}
