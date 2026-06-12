import { Activity, Clock, Database, LineChart } from "lucide-react";
import { dataModeLabels } from "../app/cockpit-data";
import type { DataMode, MarketStatus } from "../app/cockpit.types";
import { formatPrice, Panel, StatusPill } from "./CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

function dataSourceLabel(market: MarketStatus) {
  if (market.source === "DEMO" && market.sourceStatus === "CONNECTED" && market.session.toLowerCase().includes("deriv")) {
    return "DERIV DEMO";
  }

  if (market.source === "MOCK") return "MOCK_DATA";
  return market.source;
}

export function MarketStatusCard({ dataMode, market }: { dataMode: DataMode; market: MarketStatus }) {
  const { t } = useLanguage();
  const labels = dataModeLabels(dataMode);
  const sourceLabel = dataSourceLabel(market);

  return (
    <Panel
      title={t("dashboard.marketStatus")}
      action={
        <div className="cockpit-controls">
          <StatusPill tone={dataMode === "REAL_DATA" ? "critical" : "demo"}>{dataMode}</StatusPill>
          <StatusPill tone={sourceLabel === "DERIV DEMO" ? "connected" : market.runtimeMode}>{sourceLabel}</StatusPill>
        </div>
      }
    >
      <div className="cockpit-kpi-row">
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.dataSource")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{sourceLabel}</div>
          <span className="cockpit-muted">
            {sourceLabel === "DERIV DEMO"
              ? `CONNECTED | fallback ${market.fallback ?? "NONE"}`
              : "Fallback visible only in DEMO_DATA"}
          </span>
        </div>
        <div className="cockpit-kpi">
          <div className="cockpit-row">
            <span className="cockpit-label">{t("common.symbol")}</span>
            <LineChart size={16} color="#58f0d1" />
          </div>
          <div className="cockpit-value">{market.symbol}</div>
          <span className="cockpit-muted">{market.timeframe}</span>
        </div>
        <div className="cockpit-kpi">
          <div className="cockpit-row">
            <span className="cockpit-label">{t("common.price")}</span>
            <Activity size={16} color="#63e6a6" />
          </div>
          <div className="cockpit-value">{formatPrice(market.price)}</div>
          <span className="cockpit-muted">Spread {market.spread}</span>
        </div>
        <div className="cockpit-kpi">
          <div className="cockpit-row">
            <span className="cockpit-label">{t("common.volume")}</span>
            <Database size={16} color="#f4c86a" />
          </div>
          <div className="cockpit-value">{market.volume.toLocaleString("en-US")}</div>
          <span className="cockpit-muted">Disponible si feed actif</span>
        </div>
        <div className="cockpit-kpi">
          <div className="cockpit-row">
            <span className="cockpit-label">Session</span>
            <Clock size={16} color="#8ad7ff" />
          </div>
          <div className="cockpit-value" style={{ fontSize: 15 }}>{market.session}</div>
          <span className="cockpit-muted">Source {sourceLabel} | {labels.slice(1).filter(label => sourceLabel !== "DERIV DEMO" || label !== "MOCK").join(" / ")}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.dataQuality")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>{market.dataQuality ?? "UNKNOWN"}</div>
          <span className="cockpit-muted">Flux {market.sourceStatus ?? "MOCK"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.lastCandle")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>
            {market.lastCandleAt ? new Date(market.lastCandleAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "n/a"}
          </div>
          <span className="cockpit-muted">Last Tick {market.lastTickAt ? new Date(market.lastTickAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "n/a"}</span>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">{t("common.latency")}</span>
          <div className="cockpit-value" style={{ fontSize: 18 }}>
            {market.latencyMs === undefined || market.latencyMs === null ? "n/a" : `${market.latencyMs} ms`}
          </div>
          <span className="cockpit-muted">Freshness {market.freshnessSeconds === undefined || market.freshnessSeconds === null ? "n/a" : `${market.freshnessSeconds}s`}</span>
        </div>
      </div>
    </Panel>
  );
}
