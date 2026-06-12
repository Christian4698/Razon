import type { BacktestSummary, JournalRow } from "../app/cockpit.types";
import { JournalTable } from "../components/JournalTable";
import { StatusPill } from "../components/CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

export function JournalPage({
  backtests,
  rows,
}: {
  backtests: readonly BacktestSummary[];
  rows: readonly JournalRow[];
}) {
  const { t } = useLanguage();

  return (
    <div className="cockpit-stack">
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("journal.title")}</h2>
          <StatusPill tone="connected">{t("journal.noTradeLogged")}</StatusPill>
        </div>
        <JournalTable rows={rows} />
      </section>
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("journal.auditTrail")}</h2>
          <StatusPill tone="live-off">{t("common.readOnly")}</StatusPill>
        </div>
        <div className="cockpit-grid three">
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("journal.accepted")}</span>
            <div className="cockpit-value">{rows.filter(row => row.decision === "BUY" || row.decision === "SELL").length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("journal.rejected")}</span>
            <div className="cockpit-value">{rows.filter(row => row.decision === "NO_TRADE").length}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">{t("journal.waiting")}</span>
            <div className="cockpit-value">{rows.filter(row => row.decision === "WAIT").length}</div>
          </div>
        </div>
      </section>
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>{t("dashboard.backtests")}</h2>
          <StatusPill tone="live-off">{t("common.readOnly")}</StatusPill>
        </div>
        <div className="demo-backtest-grid">
          {backtests.map(backtest => (
            <article className="demo-backtest-card" key={backtest.id}>
              <div className="cockpit-row">
                <strong>{backtest.id}</strong>
                <StatusPill tone={backtest.dataSource === "MOCK" ? "demo" : backtest.dataSource}>
                  {backtest.dataSource === "MOCK" ? "SIM ARCHIVE" : backtest.dataSource}
                </StatusPill>
              </div>
              <p className="cockpit-muted">
                {backtest.symbol} | {backtest.timeframe} | {backtest.mode} | {backtest.period}
              </p>
              <div className="demo-metric-row">
                <span>
                  Trades
                  <strong>{backtest.totalTrades}</strong>
                </span>
                <span>
                  Win
                  <strong>{backtest.winRate.toFixed(1)}%</strong>
                </span>
                <span>
                  Drawdown
                  <strong>{backtest.maxDrawdown.toFixed(1)}%</strong>
                </span>
                <span>
                  NO_TRADE
                  <strong>{backtest.noTradeCount}</strong>
                </span>
              </div>
              <p className="cockpit-muted">{backtest.recommendation}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
