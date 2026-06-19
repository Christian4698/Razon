import type { ActionDisplayMode, AlertItem, KalosSignal, MarketStatus, OhlcCandle, WatchlistItem } from "../app/cockpit.types";
import { chartContextActions, kalosOverlayItems, syntheticIndexSymbols } from "../app/cockpit-data";
import { AlertPanel } from "../components/AlertPanel";
import { StatusPill } from "../components/CockpitPrimitives";
import { WatchlistPanel } from "../components/WatchlistPanel";
import { LiveMarketChart } from "../trading/LiveMarketChart";
import { useLanguage } from "@/i18n/useLanguage";

function isDerivDemoConnected(market: MarketStatus) {
  return market.source === "DEMO" && market.sourceStatus === "CONNECTED" && market.session.toLowerCase().includes("deriv");
}

export function MarketChartPage({
  candles,
  market,
  signal,
  watchlist,
  alerts,
  actionDisplayMode,
}: {
  candles: readonly OhlcCandle[];
  market: MarketStatus;
  signal: KalosSignal;
  watchlist: readonly WatchlistItem[];
  alerts: readonly AlertItem[];
  actionDisplayMode: ActionDisplayMode;
}) {
  const { t } = useLanguage();
  const derivConnected = isDerivDemoConnected(market);

  return (
    <div className="cockpit-grid dashboard">
      <LiveMarketChart actionDisplayMode={actionDisplayMode} candles={candles} market={market} signal={signal} />
      <div className="cockpit-stack">
        <WatchlistPanel items={watchlist} />
        <AlertPanel alerts={alerts} />
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("chart.overlayEngine")}</h2>
            <StatusPill tone="live-off">{t("common.noExecution")}</StatusPill>
          </div>
          <div className="overlay-chip-grid">
            {kalosOverlayItems.map(item => (
              <span className="overlay-chip" key={item}>{item}</span>
            ))}
          </div>
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("chart.syntheticEngine")}</h2>
            <StatusPill tone={derivConnected ? "connected" : "disconnected"}>
              {derivConnected ? "DERIV DEMO CONNECTED" : "DERIV DEMO DISCONNECTED"}
            </StatusPill>
          </div>
          <div className="overlay-chip-grid">
            {syntheticIndexSymbols.map(symbol => (
              <span className="overlay-chip" key={symbol}>{symbol}</span>
            ))}
          </div>
        </section>
        <section className="cockpit-panel">
          <div className="cockpit-panel-header">
            <h2>{t("chart.contextMenu")}</h2>
            <span className="cockpit-pill live-off">{t("common.noExecution")}</span>
          </div>
          <div className="cockpit-controls">
            {chartContextActions.map(action => (
              <button className="cockpit-control" key={action.id} type="button">
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
