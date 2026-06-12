import { FastForward, Pause, Play, Rewind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MarketReplay } from "../app/cockpit.types";
import { formatPrice, StatusPill } from "../components/CockpitPrimitives";

const replaySpeeds = [1, 2, 4] as const;

function outcomeTone(outcome: string) {
  if (outcome === "WIN_SIMULATION") return "connected" as const;
  if (outcome === "LOSS_SIMULATION") return "critical" as const;
  return "delayed" as const;
}

export function KalosMarketReplayPanel({ replay }: { replay: MarketReplay }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const speed = replaySpeeds[speedIndex];
  const frameCount = replay.frames.length;
  const frame = replay.frames[Math.min(frameIndex, Math.max(frameCount - 1, 0))];

  useEffect(() => {
    if (!playing || frameCount <= 1) return undefined;

    const interval = window.setInterval(() => {
      setFrameIndex(current => (current + 1 >= frameCount ? 0 : current + 1));
    }, 1400 / speed);

    return () => window.clearInterval(interval);
  }, [frameCount, playing, speed]);

  const progress = useMemo(() => {
    if (frameCount <= 1) return 0;
    return Math.round((frameIndex / (frameCount - 1)) * 100);
  }, [frameCount, frameIndex]);

  if (!frame) {
    return (
      <section className="cockpit-panel">
        <div className="cockpit-panel-header">
          <h2>Market Replay</h2>
          <StatusPill tone="live-off">NO EXECUTION</StatusPill>
        </div>
        <p className="cockpit-muted">No replay frames available.</p>
      </section>
    );
  }

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>Market Replay</h2>
          <p className="cockpit-muted">Ce que KALOS voyait a cet instant precis.</p>
        </div>
        <StatusPill tone="live-off">NO REAL EXECUTION</StatusPill>
      </div>

      <div className="replay-controls" aria-label="Market replay controls">
        <button className="cockpit-control" type="button" onClick={() => setPlaying(true)} title="Rejouer marche">
          <Play size={15} />
          Replay
        </button>
        <button className="cockpit-control" type="button" onClick={() => setFrameIndex(current => Math.max(current - 1, 0))} title="Revenir">
          <Rewind size={15} />
          Back
        </button>
        <button className="cockpit-control" type="button" onClick={() => setSpeedIndex(current => (current + 1) % replaySpeeds.length)} title="Accelerer">
          <FastForward size={15} />
          {speed}x
        </button>
        <button className="cockpit-control" type="button" onClick={() => setPlaying(false)} title="Pause">
          <Pause size={15} />
          Pause
        </button>
      </div>

      <div className="replay-progress" aria-label="Replay progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="cockpit-kpi-row">
        <div className="cockpit-kpi">
          <span className="cockpit-label">Win simulation</span>
          <div className="cockpit-value cockpit-positive">{replay.metrics.winSimulation}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Loss simulation</span>
          <div className="cockpit-value cockpit-negative">{replay.metrics.lossSimulation}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Drawdown</span>
          <div className="cockpit-value">{replay.metrics.drawdown}</div>
        </div>
        <div className="cockpit-kpi">
          <span className="cockpit-label">Precision</span>
          <div className="cockpit-value">{replay.metrics.precision}%</div>
        </div>
      </div>

      <div className="replay-comparison-grid">
        <div className="replay-card">
          <div className="cockpit-row">
            <strong>Prediction</strong>
            <StatusPill tone={frame.prediction.signal}>{frame.prediction.signal}</StatusPill>
          </div>
          <span className="cockpit-muted">{frame.timestamp}</span>
          <div className="replay-value">{formatPrice(frame.prediction.seenPrice)}</div>
          <div className="overlay-chip-grid">
            {frame.prediction.kalosSaw.map(item => (
              <span className="overlay-chip" key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="replay-card">
          <div className="cockpit-row">
            <strong>Actual Result</strong>
            <StatusPill tone={outcomeTone(frame.actualResult.outcome)}>{frame.actualResult.outcome}</StatusPill>
          </div>
          <span className="cockpit-muted">{frame.actualResult.direction}</span>
          <div className="replay-value">{formatPrice(frame.actualResult.closePrice)}</div>
          <span className="cockpit-muted">Movement {frame.actualResult.movement}</span>
        </div>

        <div className="replay-card">
          <div className="cockpit-row">
            <strong>Difference</strong>
            <StatusPill tone={frame.difference.matched ? "connected" : "critical"}>
              {frame.difference.matched ? "MATCH" : "DIFF"}
            </StatusPill>
          </div>
          <span className="cockpit-muted">
            {frame.difference.expectedDirection} vs {frame.difference.actualDirection}
          </span>
          <div className="replay-value">{frame.difference.priceDelta}</div>
          <span className="cockpit-muted">{frame.difference.note}</span>
        </div>
      </div>
    </section>
  );
}
