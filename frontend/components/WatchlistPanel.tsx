import type { WatchlistItem } from "../app/cockpit.types";
import { formatDecision, formatPrice, Panel, StatusPill } from "./CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

function runtimeLabel(item: WatchlistItem) {
  if (item.sourceLabel) return item.sourceLabel;
  if (item.runtimeMode === "MOCK") return "MOCK_DATA";
  if (item.runtimeMode === "LIVE" || item.runtimeMode === "REAL_DATA") return "REAL_DATA";
  return item.runtimeMode;
}

function confidenceLevel(confidence: number | null | undefined) {
  if (confidence === null || confidence === undefined) return "PENDING";
  if (confidence >= 80) return "HIGH";
  if (confidence >= 65) return "MEDIUM";
  if (confidence >= 50) return "LOW";
  return "WEAK";
}

function confidenceTone(level: string) {
  if (level === "HIGH") return "connected";
  if (level === "MEDIUM") return "demo";
  if (level === "LOW") return "delayed";
  if (level === "WEAK") return "critical";
  return "MOCK";
}

function qualityTone(quality: WatchlistItem["dataQuality"]) {
  if (quality === "HEALTHY") return "connected";
  if (quality === "DEGRADED" || quality === "STALE") return "delayed";
  if (quality === "INVALID" || quality === "DISCONNECTED") return "critical";
  return "MOCK";
}

function confidenceText(confidence: number | null | undefined) {
  if (confidence === null || confidence === undefined) return "KALOS pending";
  return `${confidence}%`;
}

function rowTitle(item: WatchlistItem) {
  return [
    `confidence: ${confidenceText(item.confidence)}`,
    `probability: ${confidenceText(item.probability)}`,
    `risk: ${item.riskScore ?? "n/a"}`,
    `data quality: ${item.dataQuality ?? "n/a"}`,
    `source: ${runtimeLabel(item)}`,
  ].join(" | ");
}

export function WatchlistPanel({ items }: { items: readonly WatchlistItem[] }) {
  const { t } = useLanguage();

  return (
    <Panel title={t("watchlist.title")}>
      <div className="cockpit-stack">
        {items.map((item, index) => {
          const level = confidenceLevel(item.confidence);

          return (
            <div className="cockpit-watch-row" key={`${item.symbol}-${index}`} title={rowTitle(item)}>
              <div className="watchlist-main">
                <div className="watchlist-signal-line">
                  <strong>{item.symbol}</strong>
                  <StatusPill tone={item.signal}>{formatDecision(item.signal)}</StatusPill>
                  <span className="watchlist-confidence">{confidenceText(item.confidence)}</span>
                  <StatusPill tone={confidenceTone(level)}>{level === "PENDING" ? t("common.kalosPending") : level}</StatusPill>
                </div>
                <span className="watchlist-meta-line">
                  {t("watchlist.spread")} {item.spread} | {runtimeLabel(item)} |{" "}
                  <StatusPill tone={qualityTone(item.dataQuality)}>{item.dataQuality ?? t("watchlist.qualityPending")}</StatusPill>
                </span>
                <span className="watchlist-detail-line">
                  {t("watchlist.risk")} {item.riskScore ?? "n/a"} | {t("watchlist.probability")} {confidenceText(item.probability)}
                </span>
              </div>
              <div className="watchlist-price-block">
                <strong>{formatPrice(item.price)}</strong>
                <div className={item.change >= 0 ? "cockpit-positive" : "cockpit-negative"}>
                  {item.change >= 0 ? "+" : ""}{item.change}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
