# RAZON Incident Response

## Severity Levels

- `SAFE`: no active safety block.
- `WARNING`: degraded data, latency, connector delay or non-critical safety warning.
- `DANGER`: critical safety gate failed, drawdown limit reached, journal unavailable or engine unavailable.
- `STOPPED`: Emergency Stop or persistent Kill Switch active.

## Immediate Actions

1. Activate Emergency Stop.
2. Confirm `ENABLE_LIVE_TRADING=false`.
3. Enable or keep persistent Kill Switch.
4. Confirm no execution is allowed from MOCK data.
5. Preserve audit logs, journal entries and connector health snapshots.
6. Rotate exposed or suspected secrets.

## Secret Exposure

If any API key, password or token may be exposed:

1. Revoke the key at the provider.
2. Rotate the vault secret.
3. Search logs for leaked raw values.
4. Confirm logs mask tokens.
5. Review frontend bundles for accidental public variables.

## Trading Safety Incident

If an unsafe execution attempt is detected:

1. Keep system in `STOPPED`.
2. Export execution logs.
3. Export Risk Engine and No-Trade Engine decisions.
4. Verify journal availability at the time of the attempt.
5. Review connector runtime mode and data source.
6. Do not re-enable LIVE until a human review is complete.

## Recovery

Recovery requires:

- incident resolved and documented
- Emergency Stop intentionally cleared
- Kill Switch intentionally cleared
- connector health stable
- journal available
- Risk Engine ready
- No-Trade Engine ready
- production checklist revalidated

LIVE mode still remains disabled unless explicitly approved after recovery.
