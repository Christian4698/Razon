import type { JournalRow } from "../app/cockpit.types";
import { formatDecision, StatusPill } from "./CockpitPrimitives";
import { useLanguage } from "@/i18n/useLanguage";

function sourceDisplay(row: JournalRow) {
  return row.sourceLabel ?? (row.source === "MOCK" ? "SIM ARCHIVE" : row.source);
}

export function JournalTable({ rows }: { rows: readonly JournalRow[] }) {
  const { t } = useLanguage();

  return (
    <div className="cockpit-table-wrap">
      <table className="cockpit-table">
        <thead>
          <tr>
            <th>{t("journal.id")}</th>
            <th>{t("journal.date")}</th>
            <th>{t("common.symbol")}</th>
            <th>TF</th>
            <th>{t("common.mode")}</th>
            <th>{t("common.decision")}</th>
            <th>{t("common.confidence")}</th>
            <th>{t("common.risk")}</th>
            <th>{t("common.source")}</th>
            <th>Module</th>
            <th>{t("journal.result")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{new Date(row.timestamp).toLocaleTimeString()}</td>
              <td>{row.symbol}</td>
              <td>{row.timeframe}</td>
              <td>{row.mode}</td>
              <td><StatusPill tone={row.decision}>{formatDecision(row.decision)}</StatusPill></td>
              <td>{row.confidence}%</td>
              <td>{row.riskScore}</td>
              <td>
                <div className="cockpit-stack" style={{ gap: 4 }}>
                  <StatusPill tone={row.source === "MOCK" && !row.sourceLabel ? "demo" : row.source}>
                    {sourceDisplay(row)}
                  </StatusPill>
                  {row.fallback ? <span className="cockpit-muted">fallback {row.fallback}</span> : null}
                </div>
              </td>
              <td>{row.module}</td>
              <td>{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
