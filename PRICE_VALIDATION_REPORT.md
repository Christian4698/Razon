# PRICE VALIDATION REPORT

Date: 2026-06-15

## Scope

This phase validates KALOS directional signal prices against the displayed market symbol and feed price before a signal can be treated as executable.

Observed bug:

- MT5 V75 price: approximately 39400
- KALOS V75 price: approximately 8397

This is treated as an impossible signal relation because the entry is not an absolute price near the active market feed for the displayed symbol.

## Runtime Contract

Every directional signal now carries:

- `entry`
- `currentPrice`
- `tp`
- `sl`
- `invalidation`
- `symbol`
- `timeframe`
- `source`
- `decimals`
- `priceValidation`

Runtime validator code:

- `server/services/priceValidation.ts`

Execution refusal code:

- `INVALID_SIGNAL_PRICE_RELATION`

## Validation Rules

1. Source price must match the displayed symbol.
2. Directional signals cannot use `MOCK_DATA` or fallback pricing as executable context.
3. `entry`, `currentPrice`, `tp`, `sl`, and `invalidation` must be finite absolute prices.
4. `entry` must be near the current market feed price, not an offset.
5. TP/SL must be absolute prices:
   - BUY: `TP > ENTRY > SL`
   - SELL: `TP < ENTRY < SL`
6. Invalidation must be beyond SL:
   - BUY: `invalidation <= SL`
   - SELL: `invalidation >= SL`
7. Price precision must not exceed market feed precision.
8. Invalid directional signals are converted to `INVALID` with confidence/probability set to `0`.

## Execution Block

Backend execution validation now refuses impossible order intents with:

```text
INVALID_SIGNAL_PRICE_RELATION
```

This applies even when an order intent is manually constructed and bypasses KALOS API output.

## Fixed Generation Logic

KALOS now generates invalidation beyond stop loss:

- BUY invalidation is below/equal to BUY SL.
- SELL invalidation is above/equal to SELL SL.

This prevents valid market-price signals from being rejected by the new contract.
