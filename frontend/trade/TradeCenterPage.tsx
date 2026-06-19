import { useMemo, useState } from "react";
import type { ConnectorStatus, DemoObservationGateReport, KalosSignal, MarketStatus, RiskStatus, ShadowTradingReport, TradingMode } from "../app/cockpit.types";
import { displayAction, toDerivAction } from "../app/actionDisplay";
import { formatPrice, StatusPill } from "../components/CockpitPrimitives";

function formatMetric(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "n/a";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  return `${Math.round(seconds / 60)} min`;
}

function statusTone(ok: boolean) {
  return ok ? "connected" : "critical";
}

function findDerivDemo(connectors: readonly ConnectorStatus[]) {
  return connectors.find(connector => connector.source === "PERSONAL_DERIV_DEMO_OAUTH" || connector.personalSource === "PERSONAL_DERIV_DEMO_OAUTH")
    ?? connectors.find(connector => connector.id.toLowerCase().includes("deriv") && connector.accountKind === "DEMO");
}

function findDerivReal(connectors: readonly ConnectorStatus[]) {
  return connectors.find(connector => connector.id.toLowerCase().includes("deriv") && connector.accountKind === "REAL");
}

export function TradeCenterPage({
  connectors,
  market,
  signal,
  risk,
  demoObservationGate,
  shadowTrading,
  tradingMode,
}: {
  connectors: readonly ConnectorStatus[];
  market: MarketStatus;
  signal: KalosSignal;
  risk: RiskStatus;
  demoObservationGate: DemoObservationGateReport | null;
  shadowTrading: ShadowTradingReport | null;
  tradingMode: TradingMode;
}) {
  const [targetAccount, setTargetAccount] = useState<"DEMO" | "REAL">("DEMO");
  const [userStake, setUserStake] = useState(() => signal.statisticalRisk?.recommendedStake ?? 0);
  const demo = findDerivDemo(connectors);
  const real = findDerivReal(connectors);
  const recommendedStake = signal.statisticalRisk?.recommendedStake ?? 0;
  const maxRisk = Math.max(0, recommendedStake * 0.25);
  const idealProfitWindow = signal.adaptiveHorizon?.profitWindowSeconds ?? signal.signalHorizon?.maxProfitWindowSeconds ?? 0;
  const targetGain = Math.max(0, recommendedStake * Math.max(signal.statisticalRisk?.riskReward ?? 0, 0));
  const exceedsRecommendation = userStake > recommendedStake || userStake > maxRisk * 4 || idealProfitWindow < 60 || risk.dailyDrawdown > 5;
  const direction = toDerivAction(signal.decision);
  const standardAction = displayAction(signal.decision, "standard");
  const realChecklist = [
    "1000 trades demo",
    "Sharpe > 1.5",
    "Drawdown < 8%",
    "No MOCK",
    "Journal complet",
    "Kill switch teste",
  ];

  const modeRows = useMemo(
    () => [
      { label: "Analysis only", active: tradingMode === "ANALYSE_SEULEMENT", locked: false },
      { label: "Manual", active: tradingMode === "MANUEL", locked: false },
      { label: "Semi-auto", active: tradingMode === "SEMI_AUTO", locked: false },
      { label: "Auto", active: tradingMode === "AUTO", locked: true },
    ],
    [tradingMode]
  );

  return (
    <div className="cockpit-grid two">
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>Deriv Account Panel</h2>
          <StatusPill tone={demo?.connected ? "connected" : "disconnected"}>{demo?.connected ? "DEMO CONNECTED" : "DEMO DISCONNECTED"}</StatusPill>
        </div>
        <div className="cockpit-kpi-row">
          <div className="cockpit-kpi">
            <span className="cockpit-label">DEMO account</span>
            <div className="cockpit-value" style={{ fontSize: 18 }}>{demo?.loginid ?? demo?.accountId ?? "n/a"}</div>
            <span className="cockpit-muted">{demo?.source ?? "PERSONAL_DERIV_DEMO_OAUTH"}</span>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">REAL account</span>
            <div className="cockpit-value" style={{ fontSize: 18 }}>{real?.connected ? "CONNECTED READ ONLY" : "LOCKED"}</div>
            <span className="cockpit-muted">REAL execution disabled</span>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">Demo balance</span>
            <div className="cockpit-value">{formatMetric(10000, 2)} USD</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">Real balance</span>
            <div className="cockpit-value">locked</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">OAuth status</span>
            <div className="cockpit-value" style={{ fontSize: 18 }}>{demo?.authType ?? "OAUTH"}</div>
          </div>
          <div className="cockpit-kpi">
            <span className="cockpit-label">Last sync</span>
            <div className="cockpit-value" style={{ fontSize: 18 }}>{demo?.lastTestAt ? new Date(demo.lastTestAt).toLocaleTimeString() : "n/a"}</div>
          </div>
        </div>
      </section>

      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>Trading Mode Panel</h2>
          <StatusPill tone="live-off">AUTO LOCKED</StatusPill>
        </div>
        <div className="settings-grid">
          {modeRows.map(row => (
            <div className="setting-row" key={row.label}>
              <strong>{row.label}</strong>
              <span className={`toggle-state ${row.active ? "on" : ""}`}>{row.locked ? "LOCKED" : row.active ? "ACTIVE" : "OFF"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>Capital & Risk Panel</h2>
          <StatusPill tone="demo">SIMULATION</StatusPill>
        </div>
        <div className="cockpit-kpi-row">
          <div className="cockpit-kpi"><span className="cockpit-label">Available capital</span><div className="cockpit-value">10,000 USD</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Minimum recommended capital</span><div className="cockpit-value">500 USD</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Recommended stake</span><div className="cockpit-value">{formatMetric(recommendedStake, 2)} USD</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Max risk/trade</span><div className="cockpit-value">{risk.riskPerTrade}%</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Max daily loss</span><div className="cockpit-value">8%</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Current drawdown</span><div className="cockpit-value">{formatMetric(signal.statisticalRisk?.drawdown.dailyDrawdown ?? risk.dailyDrawdown, 2)}%</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Stop loss</span><div className="cockpit-value">{formatPrice(signal.sl)}</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Take profit</span><div className="cockpit-value">{formatPrice(signal.tp)}</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">RiskReward</span><div className="cockpit-value">{formatMetric(signal.statisticalRisk?.riskReward, 2)}</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Kelly fraction</span><div className="cockpit-value">{formatMetric((signal.statisticalRisk?.kellyFraction ?? 0) * 100, 2)}%</div></div>
          <div className="cockpit-kpi"><span className="cockpit-label">Expected value</span><div className="cockpit-value">{formatMetric(signal.statisticalRisk?.expectedValue, 4)}</div></div>
        </div>
      </section>

      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>RAZON Trade Proposal</h2>
          <StatusPill tone={signal.adaptiveHorizon?.noTrade ? "critical" : "demo"}>{signal.adaptiveHorizon?.noTrade ? "BLOCKED" : "PREVIEW ONLY"}</StatusPill>
        </div>
        <div className="dashboard-mini-grid">
          <span><b>Market</b><strong>{market.symbol}</strong></span>
          <span><b>Direction</b><strong>{direction}</strong></span>
          <span><b>Standard action</b><strong>{standardAction}</strong></span>
          <span><b>Confidence</b><strong>{signal.confidence}%</strong></span>
          <span><b>Calibrated confidence</b><strong>{signal.statisticalRisk?.calibratedConfidence ?? "n/a"}%</strong></span>
          <span><b>Recommended stake</b><strong>{formatMetric(recommendedStake, 2)} USD</strong></span>
          <span><b>Target gain</b><strong>{formatMetric(targetGain, 2)} USD</strong></span>
          <span><b>Max accepted loss</b><strong>{formatMetric(maxRisk, 2)} USD</strong></span>
          <span><b>Ideal duration</b><strong>{formatDuration(idealProfitWindow)}</strong></span>
          <span><b>Validity window</b><strong>{formatDuration(signal.adaptiveHorizon?.validForSeconds)}</strong></span>
          <span><b>TP</b><strong>{formatPrice(signal.tp)}</strong></span>
          <span><b>SL</b><strong>{formatPrice(signal.sl)}</strong></span>
          <span><b>Invalidation</b><strong>{formatPrice(signal.invalidation)}</strong></span>
          <span><b>Expiry</b><strong>{signal.signalHorizon?.expirationTime ? new Date(signal.signalHorizon.expirationTime).toLocaleTimeString() : "n/a"}</strong></span>
          <span><b>Would execute</b><strong>{direction}</strong></span>
          <span><b>Production Confidence</b><strong>{signal.backtestValidation?.productionConfidence?.productionConfidence ?? "LOW"}</strong></span>
          <span><b>Generalization gap</b><strong>{formatMetric(signal.backtestValidation?.productionConfidence?.generalizationGap, 2)}</strong></span>
        </div>
        {signal.adaptiveHorizon?.noTradeReason ? <p className="cockpit-muted">NoTradeReason: {signal.adaptiveHorizon.noTradeReason}</p> : null}
        <div className="setting-row">
          <strong>User stake preview</strong>
          <input
            className="cockpit-token-input"
            min={0}
            onChange={event => setUserStake(Number(event.target.value))}
            step={1}
            type="number"
            value={Number.isFinite(userStake) ? userStake : 0}
          />
        </div>
        {exceedsRecommendation ? (
          <p className="cockpit-muted">
            Vous depassez la recommandation RAZON. Confirmez que vous acceptez le risque supplementaire.
          </p>
        ) : null}
      </section>

      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>DEMO / REAL Toggle</h2>
          <StatusPill tone={targetAccount === "REAL" ? "critical" : "demo"}>{targetAccount}</StatusPill>
        </div>
        <div className="chart-control-group" role="radiogroup" aria-label="Trading target">
          <button className={`cockpit-control ${targetAccount === "DEMO" ? "is-active" : ""}`} onClick={() => setTargetAccount("DEMO")} type="button">
            DEMO Trading
          </button>
          <button className={`cockpit-control ${targetAccount === "REAL" ? "is-active" : ""}`} onClick={() => setTargetAccount("REAL")} type="button">
            REAL Trading locked
          </button>
        </div>
        <div className="cockpit-stack" style={{ marginTop: 12 }}>
          {realChecklist.map(item => (
            <div className="setting-row" key={item}>
              <strong>{item}</strong>
              <span className="toggle-state">REQUIRED</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cockpit-panel cockpit-panel-wide">
        <div className="cockpit-panel-header">
          <div>
            <h2>Validation / Shadow Trading</h2>
            <p className="cockpit-muted">Market Feed {"->"} Signal {"->"} Decision {"->"} Virtual Entry {"->"} Virtual TP/SL {"->"} Journal {"->"} Performance</p>
          </div>
          <StatusPill tone="live-off">NO EXECUTION</StatusPill>
        </div>
        {shadowTrading ? (
          <>
            <div className="chart-control-group" aria-label="Shadow horizon modes">
              {shadowTrading.modes.map(mode => (
                <button className="cockpit-control is-active" key={mode} type="button">{mode}</button>
              ))}
            </div>
            <div className="cockpit-kpi-row">
              <div className="cockpit-kpi"><span className="cockpit-label">Today PnL</span><div className="cockpit-value">{formatMetric(shadowTrading.todayPnl, 2)} USD</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Weekly PnL</span><div className="cockpit-value">{formatMetric(shadowTrading.weeklyPnl, 2)} USD</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Virtual balance</span><div className="cockpit-value">{formatMetric(shadowTrading.virtualBalance, 2)} USD</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Winrate</span><div className="cockpit-value">{formatMetric(shadowTrading.winrate, 2)}%</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Avg duration</span><div className="cockpit-value">{formatDuration(shadowTrading.avgDurationSeconds)}</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Drawdown</span><div className="cockpit-value">{formatMetric(shadowTrading.drawdown, 2)}%</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Sharpe</span><div className="cockpit-value">{formatMetric(shadowTrading.sharpe, 4)}</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">NoTrade</span><div className="cockpit-value">{formatMetric(shadowTrading.noTradeRate, 2)}%</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Profit factor</span><div className="cockpit-value">{formatMetric(shadowTrading.profitFactor, 2)}</div></div>
            </div>
            <div className="dashboard-mini-grid">
              <span><b>Signals observed</b><strong>{shadowTrading.signalsObserved}/{shadowTrading.minimumLiveSignalsRequired}</strong></span>
              <span><b>Rolling Sharpe</b><strong>{formatMetric(shadowTrading.rollingSharpe, 4)}</strong></span>
              <span><b>Rolling drawdown</b><strong>{formatMetric(shadowTrading.rollingDrawdown, 2)}%</strong></span>
              <span><b>Signal decay</b><strong>{formatMetric(shadowTrading.signalDecay, 2)}%</strong></span>
              <span><b>Confidence stability</b><strong>{formatMetric(shadowTrading.confidenceStability, 2)}%</strong></span>
              <span><b>Market stability</b><strong>{formatMetric(shadowTrading.marketStability, 2)}%</strong></span>
              <span><b>Regime changes</b><strong>{shadowTrading.regimeChanges}</strong></span>
              <span><b>Real readiness</b><strong>{shadowTrading.realReadiness}</strong></span>
            </div>
            <div className="settings-grid" style={{ marginTop: 12 }}>
              <div className="setting-row"><strong>Rolling Sharpe {">="} 1.5</strong><StatusPill tone={statusTone(shadowTrading.rules.rollingSharpeOk)}>{shadowTrading.rules.rollingSharpeOk ? "PASS" : "FAIL"}</StatusPill></div>
              <div className="setting-row"><strong>Drawdown {"<="} 8%</strong><StatusPill tone={statusTone(shadowTrading.rules.drawdownOk)}>{shadowTrading.rules.drawdownOk ? "PASS" : "FAIL"}</StatusPill></div>
              <div className="setting-row"><strong>Signal decay {"<="} 15%</strong><StatusPill tone={statusTone(shadowTrading.rules.signalDecayOk)}>{shadowTrading.rules.signalDecayOk ? "PASS" : "FAIL"}</StatusPill></div>
              <div className="setting-row"><strong>Confidence drift {"<="} 10%</strong><StatusPill tone={statusTone(shadowTrading.rules.confidenceDriftOk)}>{shadowTrading.rules.confidenceDriftOk ? "PASS" : "FAIL"}</StatusPill></div>
            </div>
            <div className="journal-table-wrap" style={{ marginTop: 12 }}>
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Market</th>
                    <th>Direction</th>
                    <th>Lifecycle</th>
                    <th>Horizon</th>
                    <th>Entry</th>
                    <th>Virtual exit</th>
                    <th>PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {shadowTrading.journal.slice(0, 8).map(row => (
                    <tr key={row.id}>
                      <td>{new Date(row.timestamp).toLocaleTimeString()}</td>
                      <td>{row.market}</td>
                      <td>{row.direction}</td>
                      <td>{row.lifecycle}</td>
                      <td>{row.signalHorizon}</td>
                      <td>{formatPrice(row.entry)}</td>
                      <td>{formatPrice(row.virtualExit)}</td>
                      <td>{formatMetric(row.pnlSimulated, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cockpit-muted">
              {shadowTrading.realReadinessReasons.join(" ")}
            </p>
          </>
        ) : (
          <p className="cockpit-muted">Shadow Trading validation is unavailable. No execution was attempted.</p>
        )}
      </section>

      <section className="cockpit-panel cockpit-panel-wide">
        <div className="cockpit-panel-header">
          <div>
            <h2>14-Day Demo Observation</h2>
            <p className="cockpit-muted">REAL preparation remains locked until all demo observation thresholds pass.</p>
          </div>
          <StatusPill tone="live-off">{demoObservationGate?.gateStatus ?? "REAL_PREP_LOCKED"}</StatusPill>
        </div>
        {demoObservationGate ? (
          <>
            <div className="cockpit-kpi-row">
              <div className="cockpit-kpi"><span className="cockpit-label">Days completed</span><div className="cockpit-value">{demoObservationGate.daysCompleted}/14</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Days remaining</span><div className="cockpit-value">{demoObservationGate.daysRemaining}</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Signals</span><div className="cockpit-value">{demoObservationGate.observedSignals}/{demoObservationGate.minimumSignals}</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Readiness score</span><div className="cockpit-value">{demoObservationGate.readinessScore}/100</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Trend</span><div className="cockpit-value">{demoObservationGate.trend}</div></div>
              <div className="cockpit-kpi"><span className="cockpit-label">Real readiness</span><div className="cockpit-value">{demoObservationGate.realReadiness}</div></div>
            </div>
            <div className="dashboard-mini-grid">
              <span><b>Feed interruptions</b><strong>{demoObservationGate.incidentSummary.feedInterruption}</strong></span>
              <span><b>Latency spikes</b><strong>{demoObservationGate.incidentSummary.latencySpike}</strong></span>
              <span><b>PnL anomalies</b><strong>{demoObservationGate.incidentSummary.shadowPnlAnomaly}</strong></span>
              <span><b>Drawdown spikes</b><strong>{demoObservationGate.incidentSummary.drawdownSpike}</strong></span>
              <span><b>Confidence drift incidents</b><strong>{demoObservationGate.incidentSummary.confidenceDrift}</strong></span>
              <span><b>Missing ticks/candles</b><strong>{demoObservationGate.incidentSummary.missingTicksCandles}</strong></span>
            </div>
            <div className="settings-grid" style={{ marginTop: 12 }}>
              {demoObservationGate.blockers.map(blocker => (
                <div className="setting-row" key={blocker}>
                  <strong>{blocker}</strong>
                  <StatusPill tone="critical">BLOCKER</StatusPill>
                </div>
              ))}
            </div>
            <div className="journal-table-wrap" style={{ marginTop: 12 }}>
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Signals</th>
                    <th>Realistic PnL</th>
                    <th>Sharpe</th>
                    <th>Drawdown</th>
                    <th>Bias</th>
                    <th>Feed uptime</th>
                    <th>Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {demoObservationGate.dailyMetrics.map(day => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.signalsCount}</td>
                      <td>{formatMetric(day.realisticPnL, 2)}</td>
                      <td>{formatMetric(day.realisticSharpe, 4)}</td>
                      <td>{formatMetric(day.realisticDrawdown, 2)}%</td>
                      <td>{formatMetric(day.simulationBias, 2)}</td>
                      <td>{formatMetric(day.feedUptime, 2)}%</td>
                      <td>{day.incidentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="cockpit-muted">14-Day Demo Observation gate unavailable. REAL remains locked.</p>
        )}
      </section>
    </div>
  );
}
