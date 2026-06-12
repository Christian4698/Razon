import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type AreaData,
  type BarData,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type LogicalRange,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  Copy,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  MoveUpRight,
  MoveVertical,
  Pencil,
  RotateCcw,
  Ruler,
  Slash,
  Square,
  Trash2,
  TrendingUp,
  Type,
  Unlock,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { KalosSignal, MarketStatus, OhlcCandle } from "../app/cockpit.types";
import { formatDecision, formatPrice, StatusPill } from "../components/CockpitPrimitives";
import {
  computeIndicators,
  createIndicatorConfig,
  indicatorCatalog,
  latestIndicatorValue,
  normalizeIndicatorConfigs,
  normalizeIndicatorParams,
  type ComputedIndicator,
  type IndicatorConfig,
  type IndicatorParams,
  type IndicatorType,
} from "./indicatorEngine";
import { useLanguage } from "@/i18n/useLanguage";
import { useTheme } from "@/contexts/ThemeContext";

type ChartType = "CANDLE" | "OHLC" | "HOLLOW" | "AREA";
type SmartZoomMode = "AUTO" | "MANUAL" | "HYBRID";
type CursorMode = "normal" | "pan" | "drawing";
type DrawingTool = "SELECT" | "HORIZONTAL" | "VERTICAL" | "TRENDLINE" | "RAY" | "SEGMENT" | "RECTANGLE" | "MEASURE" | "TEXT";
type DrawingKind = Exclude<DrawingTool, "SELECT">;

interface DrawingPoint {
  readonly logical: number;
  readonly price: number;
}

interface ChartDrawing {
  readonly id: string;
  readonly kind: DrawingKind;
  readonly points: readonly DrawingPoint[];
  readonly text?: string;
  readonly locked?: boolean;
  readonly createdAt: number;
}

interface DraftDrawing {
  readonly kind: DrawingKind;
  readonly start: DrawingPoint;
  readonly current: DrawingPoint;
}

interface VirtualCandle extends OhlcCandle {
  readonly index: number;
  readonly time: UTCTimestamp;
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  readonly momentum: number;
}

interface TooltipState {
  readonly x: number;
  readonly y: number;
  readonly candle: VirtualCandle;
}

interface PanState {
  readonly startX: number;
  readonly startRange: LogicalRange;
}

interface DrawingDragState {
  readonly id: string;
  readonly start: DrawingPoint;
  readonly originals: readonly ChartDrawing[];
}

interface ChartContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly drawingId?: string;
}

const chartTypes: readonly ChartType[] = ["CANDLE", "OHLC", "HOLLOW", "AREA"];
const smartZoomModes: readonly SmartZoomMode[] = ["AUTO", "MANUAL", "HYBRID"];
const drawingTools = [
  { tool: "SELECT", label: "Select", shortcut: "ESC", Icon: MousePointer2 },
  { tool: "HORIZONTAL", label: "Horizontal line", shortcut: "H", Icon: Minus },
  { tool: "VERTICAL", label: "Vertical line", shortcut: "V", Icon: MoveVertical },
  { tool: "TRENDLINE", label: "Trendline", shortcut: "T", Icon: TrendingUp },
  { tool: "RAY", label: "Ray", shortcut: undefined, Icon: MoveUpRight },
  { tool: "SEGMENT", label: "Segment", shortcut: undefined, Icon: Slash },
  { tool: "RECTANGLE", label: "Rectangle", shortcut: undefined, Icon: Square },
  { tool: "MEASURE", label: "Measure", shortcut: "M", Icon: Ruler },
  { tool: "TEXT", label: "Text annotation", shortcut: undefined, Icon: Type },
] as const;
const timeframeOrder = ["M1", "M5", "M15", "H1", "H4", "D1"] as const;
const minVisibleCandles = 20;
const maxVisibleCandles = 10000;
const chartHeight = 430;
const baseTimestamp = Date.UTC(2026, 0, 1, 8, 0, 0) / 1000;

function dataSourceLabel(market: MarketStatus) {
  if (market.source === "DEMO" && market.sourceStatus === "CONNECTED" && market.session.toLowerCase().includes("deriv")) {
    return "DERIV DEMO";
  }

  if (market.source === "MOCK") return "MOCK_DATA";
  return market.source;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function timeframeMinutes(timeframe: string) {
  if (timeframe === "M1") return 1;
  if (timeframe === "M5") return 5;
  if (timeframe === "M15") return 15;
  if (timeframe === "H1") return 60;
  if (timeframe === "H4") return 240;
  if (timeframe === "D1") return 1440;
  return 5;
}

function nextTimeframe(current: string, direction: "up" | "down") {
  const index = timeframeOrder.indexOf(current as (typeof timeframeOrder)[number]);
  const fallbackIndex = timeframeOrder.indexOf("M5");
  const safeIndex = index >= 0 ? index : fallbackIndex;
  const delta = direction === "up" ? 1 : -1;
  return timeframeOrder[clamp(safeIndex + delta, 0, timeframeOrder.length - 1)];
}

function createVirtualCandles(candles: readonly OhlcCandle[], timeframe: string): readonly VirtualCandle[] {
  const spacingSeconds = timeframeMinutes(timeframe) * 60;

  return candles.map((candle, index) => {
    const previous = candles[index - 1];
    const momentum = previous ? candle.close - previous.close : candle.close - candle.open;
    const trend = candle.close > candle.open ? "BULLISH" : candle.close < candle.open ? "BEARISH" : "NEUTRAL";

    return {
      ...candle,
      index,
      time: (baseTimestamp + index * spacingSeconds) as UTCTimestamp,
      trend,
      momentum,
    };
  });
}

function candleData(candles: readonly VirtualCandle[]): CandlestickData<Time>[] {
  return candles.map(candle => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function barData(candles: readonly VirtualCandle[]): BarData<Time>[] {
  return candles.map(candle => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function areaData(candles: readonly VirtualCandle[]): AreaData<Time>[] {
  return candles.map(candle => ({
    time: candle.time,
    value: candle.close,
  }));
}

function configureCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  const bitmapWidth = Math.max(1, Math.floor(width * ratio));
  const bitmapHeight = Math.max(1, Math.floor(height * ratio));

  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function drawDashedLine(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  dash: readonly number[],
) {
  context.save();
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.setLineDash([...dash]);
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.restore();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = "#b9c7c2",
  align: CanvasTextAlign = "left",
) {
  context.save();
  context.font = "700 11px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = align;
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

function claimLabelY(y: number, used: number[], height: number) {
  const minGap = 16;
  const top = 14;
  const bottom = height - 18;
  let nextY = clamp(y, top, bottom);

  for (let attempt = 0; attempt < 8 && used.some(usedY => Math.abs(usedY - nextY) < minGap); attempt += 1) {
    const direction = attempt % 2 === 0 ? 1 : -1;
    const steps = Math.ceil((attempt + 1) / 2);
    nextY = clamp(y + direction * steps * minGap, top, bottom);
  }

  used.push(nextY);
  return nextY;
}

function drawingStorageKey(symbol: string) {
  return `razon-chart-drawings-v1:${symbol}`;
}

function indicatorStorageKey(symbol: string) {
  return `razon-chart-indicators-v1:${symbol}`;
}

function createDrawingId() {
  return `draw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isDrawingKind(value: unknown): value is DrawingKind {
  return (
    value === "HORIZONTAL" ||
    value === "VERTICAL" ||
    value === "TRENDLINE" ||
    value === "RAY" ||
    value === "SEGMENT" ||
    value === "RECTANGLE" ||
    value === "MEASURE" ||
    value === "TEXT"
  );
}

function isDrawingPoint(value: unknown): value is DrawingPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<DrawingPoint>;
  return typeof point.logical === "number" && Number.isFinite(point.logical) && typeof point.price === "number" && Number.isFinite(point.price);
}

function normalizeDrawings(value: unknown): ChartDrawing[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is ChartDrawing => {
      if (!item || typeof item !== "object") return false;
      const drawing = item as Partial<ChartDrawing>;
      return (
        typeof drawing.id === "string" &&
        isDrawingKind(drawing.kind) &&
        Array.isArray(drawing.points) &&
        drawing.points.every(isDrawingPoint) &&
        typeof drawing.createdAt === "number"
      );
    })
    .slice(0, 200);
}

function loadStoredDrawings(key: string): ChartDrawing[] {
  try {
    return normalizeDrawings(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
  } catch {
    return [];
  }
}

function storeDrawings(key: string, drawings: readonly ChartDrawing[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(drawings));
  } catch {
    // localStorage may be unavailable in constrained browser modes; drawing still works in memory.
  }
}

function loadStoredIndicators(key: string): IndicatorConfig[] {
  try {
    return normalizeIndicatorConfigs(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
  } catch {
    return [];
  }
}

function storeIndicators(key: string, indicators: readonly IndicatorConfig[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(indicators));
  } catch {
    // localStorage may be unavailable in constrained browser modes; indicators still work in memory.
  }
}

function indicatorConfigFingerprint(indicators: readonly IndicatorConfig[]) {
  return indicators
    .map(indicator => {
      const params = normalizeIndicatorParams(indicator.type, indicator.params);
      return `${indicator.id}:${indicator.type}:${params.period ?? ""}:${params.fast ?? ""}:${params.slow ?? ""}:${params.signal ?? ""}:${
        params.deviation ?? ""
      }:${indicator.color}`;
    })
    .join("|");
}

function indicatorDataFingerprint(candles: readonly VirtualCandle[], timeframe: string) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  const checksum = candles.reduce(
    (sum, candle, index) => sum + (index + 1) * (candle.open + candle.high + candle.low + candle.close + candle.volume * 0.0001),
    0,
  );

  return [
    timeframe,
    candles.length,
    first?.time ?? "",
    first?.open ?? "",
    first?.high ?? "",
    first?.low ?? "",
    first?.close ?? "",
    last?.time ?? "",
    last?.open ?? "",
    last?.high ?? "",
    last?.low ?? "",
    last?.close ?? "",
    last?.volume ?? "",
    checksum.toFixed(5),
  ].join(":");
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isMultiPointDrawing(kind: DrawingKind) {
  return kind === "TRENDLINE" || kind === "RAY" || kind === "SEGMENT" || kind === "RECTANGLE" || kind === "MEASURE";
}

function lineEndForRay(x1: number, y1: number, x2: number, y2: number, width: number, height: number) {
  if (Math.abs(x2 - x1) < 1) {
    return { x: x2, y: y2 < y1 ? 0 : height };
  }

  const targetX = x2 >= x1 ? width - 12 : 12;
  const slope = (y2 - y1) / (x2 - x1);
  return { x: targetX, y: y1 + slope * (targetX - x1) };
}

function drawHandle(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.fillStyle = "#101315";
  context.strokeStyle = "#58f0d1";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(x - 4, y - 4, 8, 8, 2);
  context.fill();
  context.stroke();
  context.restore();
}

function numericValues(values: readonly (number | null)[]) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function valueRange(lines: ComputedIndicator["lines"], fallbackMin: number, fallbackMax: number) {
  const values = lines.flatMap(line => numericValues(line.values));
  if (values.length === 0) return { min: fallbackMin, max: fallbackMax };

  const min = Math.min(...values, fallbackMin);
  const max = Math.max(...values, fallbackMax);
  const span = Math.max(max - min, Math.abs(max) * 0.01, 0.0001);

  return {
    min: min - span * 0.08,
    max: max + span * 0.08,
  };
}

function drawIndicatorLine(
  context: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  color: string,
  coordinateForIndex: (index: number, value: number) => { x: number; y: number } | null,
  dash: readonly number[] = [],
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1.4;
  context.setLineDash([...dash]);
  context.beginPath();

  let started = false;
  values.forEach((value, index) => {
    if (value === null) {
      started = false;
      return;
    }

    const point = coordinateForIndex(index, value);
    if (!point) {
      started = false;
      return;
    }

    if (!started) {
      context.moveTo(point.x, point.y);
      started = true;
    } else {
      context.lineTo(point.x, point.y);
    }
  });

  context.stroke();
  context.restore();
}

function applySeriesAutoscale(
  series: ISeriesApi<SeriesType, Time> | null,
  candles: readonly VirtualCandle[],
  signal: KalosSignal,
  visibleRange: LogicalRange | null,
  verticalZoom: number,
  indicators: readonly ComputedIndicator[] = [],
) {
  if (!series || candles.length === 0) return;

  series.applyOptions({
    autoscaleInfoProvider: () => {
      const from = Math.max(0, Math.floor(visibleRange?.from ?? 0));
      const to = Math.min(candles.length - 1, Math.ceil(visibleRange?.to ?? candles.length - 1));
      const visibleCandles = candles.slice(from, to + 1);
      const values = visibleCandles.length > 0 ? visibleCandles : candles;
      const priceIndicatorValues = indicators
        .filter(indicator => indicator.pane === "price")
        .flatMap(indicator => indicator.lines.flatMap(line => numericValues(line.values.slice(from, to + 1))));
      const rawMin = Math.min(...values.map(candle => candle.low), signal.sl, signal.invalidation, ...priceIndicatorValues);
      const rawMax = Math.max(...values.map(candle => candle.high), signal.tp, ...priceIndicatorValues);
      const padding = Math.max((rawMax - rawMin) * 0.12, Math.abs(rawMax) * 0.002, 0.01);
      const center = (rawMax + rawMin) / 2;
      const baseRange = rawMax - rawMin + padding * 2;
      const zoomedRange = baseRange / verticalZoom;

      return {
        priceRange: {
          minValue: center - zoomedRange / 2,
          maxValue: center + zoomedRange / 2,
        },
      };
    },
  });
}

function publishChartNavigationPause(durationMs = 10000) {
  window.dispatchEvent(
    new CustomEvent("razon:chart-navigation", {
      detail: { until: Date.now() + durationMs },
    }),
  );
}

export function LiveMarketChart({
  candles,
  market,
  signal,
}: {
  candles: readonly OhlcCandle[];
  market: MarketStatus;
  signal: KalosSignal;
}) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const indicatorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const visibleRangeRef = useRef<LogicalRange | null>(null);
  const crosshairRef = useRef<TooltipState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const drawingDragRef = useRef<DrawingDragState | null>(null);
  const hoveredRef = useRef(false);
  const spacePressedRef = useRef(false);
  const smartZoomSequenceRef = useRef(0);
  const lastZoomIntentRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const apiCallGuardRef = useRef(0);
  const drawingApiGuardRef = useRef(0);
  const loadedDrawingKeyRef = useRef("");
  const loadedIndicatorKeyRef = useRef("");
  const indicatorCacheRef = useRef<{ key: string; indicators: ComputedIndicator[] } | null>(null);
  const indicatorComputeCountRef = useRef(0);
  const tooltipThrottleRef = useRef(0);
  const [chartType, setChartType] = useState<ChartType>("CANDLE");
  const [smartZoomMode, setSmartZoomMode] = useState<SmartZoomMode>("HYBRID");
  const [selectedTimeframe, setSelectedTimeframe] = useState(market.timeframe);
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingTool>("SELECT");
  const [drawings, setDrawings] = useState<readonly ChartDrawing[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<readonly IndicatorConfig[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<DraftDrawing | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [kalosVisible, setKalosVisible] = useState(true);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const [contextMenu, setContextMenu] = useState<ChartContextMenuState | null>(null);
  const [contextMode, setContextMode] = useState<"Manual" | "Semi-auto" | "Auto">("Manual");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [cursorMode, setCursorMode] = useState<CursorMode>("normal");
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [visibleCandles, setVisibleCandles] = useState(Math.min(candles.length, 80));
  const [fps, setFps] = useState(60);
  const sourceLabel = dataSourceLabel(market);
  const chartPalette = useMemo(() => {
    if (resolvedTheme === "LIGHT") {
      return {
        background: "#f8faf8",
        text: "#43514c",
        grid: "#d5ded9",
        gridSoft: "rgba(190, 204, 198, 0.72)",
        border: "#c8d2cd",
      };
    }
    if (resolvedTheme === "OBSCURE") {
      return {
        background: "#040505",
        text: "#a8b8b2",
        grid: "#151d1a",
        gridSoft: "rgba(21, 29, 26, 0.72)",
        border: "#19211f",
      };
    }

    return {
      background: "#101315",
      text: "#b8c7c2",
      grid: "#26302e",
      gridSoft: "rgba(38, 48, 46, 0.68)",
      border: "#26302e",
    };
  }, [resolvedTheme]);
  const activeDrawingLabel = drawingTools.find(item => item.tool === activeDrawingTool)?.label ?? "Select";
  const drawingKey = useMemo(() => drawingStorageKey(market.symbol), [market.symbol]);
  const indicatorKey = useMemo(() => indicatorStorageKey(market.symbol), [market.symbol]);
  const virtualCandles = useMemo(() => createVirtualCandles(candles, selectedTimeframe), [candles, selectedTimeframe]);
  const candleByTime = useMemo(() => new Map<Time, VirtualCandle>(virtualCandles.map(candle => [candle.time, candle])), [virtualCandles]);
  const chartData = useMemo(
    () => ({
      area: areaData(virtualCandles),
      bar: barData(virtualCandles),
      candle: candleData(virtualCandles),
    }),
    [virtualCandles],
  );
  const indicatorComputationKey = useMemo(
    () => `${indicatorDataFingerprint(virtualCandles, selectedTimeframe)}::${indicatorConfigFingerprint(activeIndicators)}`,
    [activeIndicators, selectedTimeframe, virtualCandles],
  );
  const computedIndicators = useMemo(() => {
    const cached = indicatorCacheRef.current;
    if (cached?.key === indicatorComputationKey) return cached.indicators;

    indicatorComputeCountRef.current += 1;
    const indicators = computeIndicators(virtualCandles, activeIndicators);
    indicatorCacheRef.current = { key: indicatorComputationKey, indicators };
    return indicators;
  }, [activeIndicators, indicatorComputationKey, virtualCandles]);
  const indicatorTooltipRows = useMemo(
    () => (tooltip ? computedIndicators.flatMap(indicator => latestIndicatorValue(indicator, tooltip.candle.index)) : []),
    [computedIndicators, tooltip],
  );

  const drawingPointToCanvas = useCallback((point: DrawingPoint) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;

    const x = chart.timeScale().logicalToCoordinate(point.logical as Logical);
    const y = series.priceToCoordinate(point.price);
    if (x === null || y === null) return null;
    return { x, y };
  }, []);

  const drawingPointFromClient = useCallback((clientX: number, clientY: number) => {
    const root = rootRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!root || !chart || !series) return null;

    const bounds = root.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    return { logical: Number(logical), price: Number(price) };
  }, []);

  const updateTooltipFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      const chart = chartRef.current;
      if (!root || !chart || virtualCandles.length === 0) return;

      const bounds = root.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      const logical = chart.timeScale().coordinateToLogical(x);
      if (logical === null) return;

      const candle = virtualCandles[clamp(Math.round(Number(logical)), 0, virtualCandles.length - 1)];
      if (!candle) return;

      publishChartNavigationPause(2500);
      const now = performance.now();
      if (now - tooltipThrottleRef.current < 16) return;

      tooltipThrottleRef.current = now;
      crosshairRef.current = { x, y, candle };
      setTooltip(crosshairRef.current);
    },
    [virtualCandles],
  );

  const hitTestDrawing = useCallback(
    (clientX: number, clientY: number, sourceDrawings: readonly ChartDrawing[] = drawings) => {
      const root = rootRef.current;
      if (!root) return null;

      const bounds = root.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;

      for (const drawing of [...sourceDrawings].reverse()) {
        const first = drawing.points[0] ? drawingPointToCanvas(drawing.points[0]) : null;
        const second = drawing.points[1] ? drawingPointToCanvas(drawing.points[1]) : null;
        if (!first) continue;

        if (drawing.kind === "HORIZONTAL" && Math.abs(y - first.y) <= 8) return drawing.id;
        if (drawing.kind === "VERTICAL" && Math.abs(x - first.x) <= 8) return drawing.id;
        if (drawing.kind === "TEXT") {
          const textWidth = Math.max(64, (drawing.text?.length ?? 4) * 7 + 22);
          if (x >= first.x - 8 && x <= first.x + textWidth && y >= first.y - 18 && y <= first.y + 18) return drawing.id;
        }
        if (!second) continue;

        if (drawing.kind === "RECTANGLE") {
          const left = Math.min(first.x, second.x);
          const right = Math.max(first.x, second.x);
          const top = Math.min(first.y, second.y);
          const bottom = Math.max(first.y, second.y);
          const nearEdge = x >= left - 8 && x <= right + 8 && y >= top - 8 && y <= bottom + 8;
          const inside = x >= left && x <= right && y >= top && y <= bottom;
          if (nearEdge || inside) return drawing.id;
          continue;
        }

        const end = drawing.kind === "RAY" ? lineEndForRay(first.x, first.y, second.x, second.y, bounds.width, bounds.height) : second;
        if (distanceToSegment(x, y, first.x, first.y, end.x, end.y) <= 8) return drawing.id;
      }

      return null;
    },
    [drawingPointToCanvas, drawings],
  );

  const drawLayers = useCallback(() => {
    const root = rootRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const indicatorCanvas = indicatorCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (!root || !chart || !series || !indicatorCanvas || !drawingCanvas || !overlayCanvas) return;

    const bounds = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const indicatorContext = configureCanvas(indicatorCanvas, width, height);
    const drawingContext = configureCanvas(drawingCanvas, width, height);
    const overlayContext = configureCanvas(overlayCanvas, width, height);

    if (!indicatorContext || !drawingContext || !overlayContext || virtualCandles.length === 0) return;

    const timeScale = chart.timeScale();
    const compactLabels = width < 520;
    const oscillatorIndicators = computedIndicators.filter(indicator => indicator.pane === "oscillator");
    const priceIndicators = computedIndicators.filter(indicator => indicator.pane === "price");
    const volumeTop = Math.max(0, height - 58);
    const volumeHeight = 34;
    const oscillatorPaneHeight = compactLabels ? 42 : 50;
    const oscillatorGap = 6;
    const oscillatorTotalHeight =
      oscillatorIndicators.length > 0 ? oscillatorIndicators.length * oscillatorPaneHeight + (oscillatorIndicators.length - 1) * oscillatorGap : 0;
    const oscillatorTop = Math.max(36, volumeTop - oscillatorTotalHeight - 8);
    const maxVolume = Math.max(...virtualCandles.map(candle => candle.volume), 1);

    indicatorContext.save();
    indicatorContext.fillStyle = "rgba(13, 17, 18, 0.72)";
    indicatorContext.fillRect(0, volumeTop - 8, width, volumeHeight + 18);
    indicatorContext.strokeStyle = "rgba(38, 48, 46, 0.9)";
    indicatorContext.beginPath();
    indicatorContext.moveTo(0, volumeTop - 8);
    indicatorContext.lineTo(width, volumeTop - 8);
    indicatorContext.stroke();
    virtualCandles.forEach(candle => {
      const x = timeScale.timeToCoordinate(candle.time);
      if (x === null || x < -20 || x > width + 20) return;
      const barHeight = Math.max(2, (candle.volume / maxVolume) * volumeHeight);
      indicatorContext.fillStyle = candle.close >= candle.open ? "rgba(51, 208, 179, 0.48)" : "rgba(255, 119, 119, 0.48)";
      indicatorContext.fillRect(x - 3, volumeTop + volumeHeight - barHeight, 6, barHeight);
    });
    if (!compactLabels) {
      drawLabel(indicatorContext, "INDICATOR LAYER / volume only", 12, volumeTop - 18, "#6e817b");
    }

    const coordinateForPriceIndicator = (index: number, value: number) => {
      const candle = virtualCandles[index];
      if (!candle) return null;
      const x = timeScale.timeToCoordinate(candle.time);
      const y = series.priceToCoordinate(value);
      if (x === null || y === null || x < -40 || x > width + 40) return null;
      return { x, y };
    };

    priceIndicators.forEach(indicator => {
      const upper = indicator.lines.find(line => line.key === "upper");
      const lower = indicator.lines.find(line => line.key === "lower");

      if (upper && lower) {
        indicatorContext.save();
        indicatorContext.fillStyle = indicator.type === "BOLLINGER" ? "rgba(88, 240, 209, 0.045)" : "rgba(255, 184, 107, 0.04)";
        indicatorContext.beginPath();
        let started = false;
        upper.values.forEach((value, index) => {
          if (value === null) return;
          const point = coordinateForPriceIndicator(index, value);
          if (!point) return;
          if (!started) {
            indicatorContext.moveTo(point.x, point.y);
            started = true;
          } else {
            indicatorContext.lineTo(point.x, point.y);
          }
        });
        [...lower.values].reverse().forEach((value, reverseIndex) => {
          if (value === null) return;
          const index = lower.values.length - 1 - reverseIndex;
          const point = coordinateForPriceIndicator(index, value);
          if (!point) return;
          indicatorContext.lineTo(point.x, point.y);
        });
        indicatorContext.closePath();
        indicatorContext.fill();
        indicatorContext.restore();
      }

      indicator.lines.forEach(line => {
        drawIndicatorLine(
          indicatorContext,
          line.values,
          line.color,
          coordinateForPriceIndicator,
          line.key === "middle" ? [4, 5] : [],
        );
      });

      if (!compactLabels) {
        const lastLine = indicator.lines[0];
        const lastIndex = [...lastLine.values].findLastIndex(value => value !== null);
        const lastValue = lastLine.values[lastIndex];
        const lastPoint = lastValue === null || lastValue === undefined ? null : coordinateForPriceIndicator(lastIndex, lastValue);
        if (lastPoint) {
          drawLabel(indicatorContext, indicator.label, Math.min(width - 70, lastPoint.x + 8), lastPoint.y - 10, lastLine.color);
        }
      }
    });

    oscillatorIndicators.forEach((indicator, paneIndex) => {
      const paneTop = oscillatorTop + paneIndex * (oscillatorPaneHeight + oscillatorGap);
      const paneBottom = paneTop + oscillatorPaneHeight;
      const range = indicator.type === "RSI" ? { min: 0, max: 100 } : valueRange(indicator.lines, -1, 1);
      const span = Math.max(range.max - range.min, 0.0001);
      const yForValue = (value: number) => paneBottom - ((value - range.min) / span) * oscillatorPaneHeight;
      const coordinateForOscillator = (index: number, value: number) => {
        const candle = virtualCandles[index];
        if (!candle) return null;
        const x = timeScale.timeToCoordinate(candle.time);
        if (x === null || x < -40 || x > width + 40) return null;
        return { x, y: clamp(yForValue(value), paneTop, paneBottom) };
      };

      indicatorContext.save();
      indicatorContext.fillStyle = "rgba(13, 17, 18, 0.66)";
      indicatorContext.fillRect(0, paneTop, width, oscillatorPaneHeight);
      indicatorContext.strokeStyle = "rgba(38, 48, 46, 0.92)";
      indicatorContext.strokeRect(0, paneTop, width, oscillatorPaneHeight);

      const zeroY = yForValue(indicator.type === "RSI" ? 50 : 0);
      if (zeroY >= paneTop && zeroY <= paneBottom) {
        drawDashedLine(indicatorContext, 0, zeroY, width, zeroY, "rgba(238, 244, 239, 0.18)", [3, 5]);
      }

      indicator.lines.forEach(line => {
        if (line.key === "histogram") {
          const baseline = clamp(yForValue(0), paneTop, paneBottom);
          line.values.forEach((value, index) => {
            if (value === null) return;
            const candle = virtualCandles[index];
            if (!candle) return;
            const x = timeScale.timeToCoordinate(candle.time);
            if (x === null || x < -20 || x > width + 20) return;
            const y = clamp(yForValue(value), paneTop, paneBottom);
            indicatorContext.fillStyle = value >= 0 ? "rgba(99, 230, 166, 0.48)" : "rgba(255, 119, 119, 0.46)";
            indicatorContext.fillRect(x - 2, Math.min(y, baseline), 4, Math.max(1, Math.abs(baseline - y)));
          });
          return;
        }

        drawIndicatorLine(indicatorContext, line.values, line.color, coordinateForOscillator);
      });

      drawLabel(indicatorContext, indicator.label, 12, paneTop + 12, indicator.lines[0]?.color ?? "#eef4ef");
      indicatorContext.restore();
    });

    indicatorContext.restore();

    if (overlaysVisible) {
      const drawingLabelYs: number[] = [];
      const tpY = series.priceToCoordinate(signal.tp);
      const slY = series.priceToCoordinate(signal.sl);
      const invalidationY = series.priceToCoordinate(signal.invalidation);
      const priceY = series.priceToCoordinate(market.price);
      const high = Math.max(...virtualCandles.map(candle => candle.high));
      const low = Math.min(...virtualCandles.map(candle => candle.low));
      const highY = series.priceToCoordinate(high);
      const lowY = series.priceToCoordinate(low);

      drawingContext.save();
      drawingContext.fillStyle = "rgba(51, 208, 179, 0.08)";
      if (tpY !== null && slY !== null) {
        drawingContext.fillRect(0, Math.min(tpY, slY), width, Math.max(1, Math.abs(tpY - slY)));
        if (!compactLabels) {
          drawLabel(drawingContext, "Entry Zone", 14, claimLabelY(Math.min(tpY, slY) + 16, drawingLabelYs, height), "#86f5dc");
        }
      }
      if (tpY !== null) {
        drawDashedLine(drawingContext, 0, tpY, width, tpY, "#63e6a6", [5, 5]);
        drawLabel(drawingContext, `TP ${formatPrice(signal.tp)}`, 14, claimLabelY(tpY - 12, drawingLabelYs, height), "#9af5c5");
      }
      if (slY !== null) {
        drawDashedLine(drawingContext, 0, slY, width, slY, "#ff7777", [5, 5]);
        drawLabel(drawingContext, `SL ${formatPrice(signal.sl)}`, 14, claimLabelY(slY + 14, drawingLabelYs, height), "#ffb1b1");
      }
      if (invalidationY !== null) {
        drawDashedLine(drawingContext, 0, invalidationY, width, invalidationY, "#f4c86a", [4, 7]);
        if (!compactLabels) {
          drawLabel(
            drawingContext,
            `Invalidation ${formatPrice(signal.invalidation)}`,
            width - 28,
            claimLabelY(invalidationY + 14, drawingLabelYs, height),
            "#f4c86a",
            "right",
          );
        }
      }
      if (highY !== null) {
        drawDashedLine(drawingContext, width * 0.52, highY, width - 22, highY, "#8ad7ff", [7, 5]);
        if (!compactLabels) {
          drawLabel(
            drawingContext,
            "BOS / Strong High",
            width - 28,
            claimLabelY(highY - 12, drawingLabelYs, height),
            "#8ad7ff",
            "right",
          );
        }
      }
      if (lowY !== null) {
        drawDashedLine(drawingContext, 18, lowY, Math.min(width * 0.42, width - 120), lowY, "#d6a3ff", [7, 5]);
        if (!compactLabels) {
          drawLabel(drawingContext, "CHoCH / Weak Low", 24, claimLabelY(lowY + 14, drawingLabelYs, height), "#d6a3ff");
        }
      }
      if (priceY !== null) {
        drawDashedLine(drawingContext, 0, priceY, width, priceY, "rgba(238, 244, 239, 0.24)", [2, 4]);
        if (!compactLabels) {
          drawLabel(drawingContext, `PRICE ${formatPrice(market.price)}`, width - 28, claimLabelY(priceY - 12, drawingLabelYs, height), "#eef4ef", "right");
        }
      }
      drawingContext.restore();
    }

    const renderChartDrawing = (drawing: ChartDrawing, transient = false) => {
      const first = drawing.points[0] ? drawingPointToCanvas(drawing.points[0]) : null;
      const second = drawing.points[1] ? drawingPointToCanvas(drawing.points[1]) : null;
      if (!first) return;

      const selected = drawing.id === selectedDrawingId && !transient;
      const color = selected ? "#58f0d1" : transient ? "#f4c86a" : "#dce7e2";
      const locked = drawing.locked === true;

      drawingContext.save();
      drawingContext.strokeStyle = color;
      drawingContext.fillStyle = color;
      drawingContext.lineWidth = selected ? 2.2 : 1.6;
      drawingContext.globalAlpha = transient ? 0.72 : locked ? 0.62 : 0.88;
      if (locked) drawingContext.setLineDash([5, 5]);

      if (drawing.kind === "HORIZONTAL") {
        drawDashedLine(drawingContext, 0, first.y, width, first.y, color, locked ? [5, 5] : [1, 0]);
        if (selected) drawHandle(drawingContext, first.x, first.y);
      } else if (drawing.kind === "VERTICAL") {
        drawDashedLine(drawingContext, first.x, 0, first.x, height, color, locked ? [5, 5] : [1, 0]);
        if (selected) drawHandle(drawingContext, first.x, first.y);
      } else if (drawing.kind === "TEXT") {
        const label = drawing.text?.trim() || "Text";
        const textWidth = Math.max(72, drawingContext.measureText(label).width + 20);
        drawingContext.fillStyle = "rgba(13, 17, 18, 0.82)";
        drawingContext.strokeStyle = selected ? "#58f0d1" : "rgba(220, 231, 226, 0.48)";
        drawingContext.beginPath();
        drawingContext.roundRect(first.x - 6, first.y - 15, textWidth, 30, 6);
        drawingContext.fill();
        drawingContext.stroke();
        drawLabel(drawingContext, label, first.x + 5, first.y, selected ? "#58f0d1" : "#eef4ef");
        if (selected) drawHandle(drawingContext, first.x, first.y);
      } else if (second) {
        if (drawing.kind === "RECTANGLE") {
          const left = Math.min(first.x, second.x);
          const top = Math.min(first.y, second.y);
          const rectWidth = Math.abs(second.x - first.x);
          const rectHeight = Math.abs(second.y - first.y);
          drawingContext.fillStyle = selected ? "rgba(88, 240, 209, 0.10)" : "rgba(138, 215, 255, 0.07)";
          drawingContext.strokeStyle = color;
          drawingContext.beginPath();
          drawingContext.rect(left, top, rectWidth, rectHeight);
          drawingContext.fill();
          drawingContext.stroke();
        } else {
          const end = drawing.kind === "RAY" ? lineEndForRay(first.x, first.y, second.x, second.y, width, height) : second;
          drawingContext.beginPath();
          drawingContext.moveTo(first.x, first.y);
          drawingContext.lineTo(end.x, end.y);
          drawingContext.stroke();

          if (drawing.kind === "MEASURE") {
            const delta = drawing.points[1].price - drawing.points[0].price;
            const pct = drawing.points[0].price === 0 ? 0 : (delta / drawing.points[0].price) * 100;
            const candlesDelta = Math.round(drawing.points[1].logical - drawing.points[0].logical);
            const measureLabel = `${delta >= 0 ? "+" : ""}${formatPrice(delta)} | ${pct.toFixed(2)}% | ${candlesDelta} bars`;
            const midX = (first.x + second.x) / 2;
            const midY = (first.y + second.y) / 2;
            drawingContext.fillStyle = "rgba(13, 17, 18, 0.88)";
            drawingContext.strokeStyle = "rgba(244, 200, 106, 0.72)";
            const labelWidth = Math.max(150, drawingContext.measureText(measureLabel).width + 20);
            drawingContext.beginPath();
            drawingContext.roundRect(clamp(midX - labelWidth / 2, 8, width - labelWidth - 8), clamp(midY - 17, 8, height - 38), labelWidth, 30, 6);
            drawingContext.fill();
            drawingContext.stroke();
            drawLabel(drawingContext, measureLabel, clamp(midX - labelWidth / 2 + 10, 18, width - labelWidth + 2), clamp(midY - 1, 23, height - 23), "#f4c86a");
          }
        }

        if (selected) {
          drawHandle(drawingContext, first.x, first.y);
          drawHandle(drawingContext, second.x, second.y);
        }
      }

      drawingContext.restore();
    };

    drawings.forEach(drawing => renderChartDrawing(drawing));

    if (draftDrawing) {
      renderChartDrawing({
        id: "draft",
        kind: draftDrawing.kind,
        points: [draftDrawing.start, draftDrawing.current],
        createdAt: Date.now(),
      }, true);
    }

    if (kalosVisible) {
      const fallbackTime = virtualCandles[0].time;
      const signalX = timeScale.timeToCoordinate(virtualCandles.at(-2)?.time ?? virtualCandles.at(-1)?.time ?? fallbackTime);
      const signalY = series.priceToCoordinate(market.price);
      const projectionStart = timeScale.timeToCoordinate(virtualCandles.at(-7)?.time ?? virtualCandles[0].time);
      const projectionMiddle = timeScale.timeToCoordinate(virtualCandles.at(-4)?.time ?? virtualCandles[0].time);
      const projectionStartY = series.priceToCoordinate(virtualCandles.at(-7)?.close ?? market.price);
      const projectionMiddleY = series.priceToCoordinate(virtualCandles.at(-4)?.close ?? market.price);
      const projectionTargetY = series.priceToCoordinate(signal.tp);
      const overlayColor =
        signal.decision === "NO_TRADE" ? "#f4c86a" : signal.decision === "WAIT" ? "#8ad7ff" : signal.decision === "SELL" ? "#ff7777" : "#63e6a6";

      overlayContext.save();
      if (
        projectionStart !== null &&
        projectionMiddle !== null &&
        projectionStartY !== null &&
        projectionMiddleY !== null &&
        projectionTargetY !== null
      ) {
        overlayContext.beginPath();
        overlayContext.strokeStyle = overlayColor;
        overlayContext.lineWidth = 1.5;
        overlayContext.setLineDash([3, 8]);
        overlayContext.moveTo(projectionStart, projectionStartY);
        overlayContext.lineTo(projectionMiddle, projectionMiddleY);
        overlayContext.lineTo(width - 28, projectionTargetY);
        overlayContext.stroke();
        if (!compactLabels) {
          drawLabel(overlayContext, "Trend Projection", width - 28, projectionTargetY - 24, overlayColor, "right");
        }
      }

      if (signalX !== null && signalY !== null) {
        overlayContext.beginPath();
        overlayContext.strokeStyle = overlayColor;
        overlayContext.lineWidth = 2;
        overlayContext.arc(signalX, signalY, 13, 0, Math.PI * 2);
        overlayContext.stroke();
        overlayContext.beginPath();
        overlayContext.fillStyle = overlayColor;
        overlayContext.arc(signalX, signalY, 6, 0, Math.PI * 2);
        overlayContext.fill();

        if (signal.decision === "BUY" || signal.decision === "SELL") {
          overlayContext.beginPath();
          overlayContext.fillStyle = overlayColor;
          if (signal.decision === "BUY") {
            overlayContext.moveTo(signalX, signalY - 31);
            overlayContext.lineTo(signalX - 9, signalY - 15);
            overlayContext.lineTo(signalX + 9, signalY - 15);
          } else {
            overlayContext.moveTo(signalX, signalY + 31);
            overlayContext.lineTo(signalX - 9, signalY + 15);
            overlayContext.lineTo(signalX + 9, signalY + 15);
          }
          overlayContext.closePath();
          overlayContext.fill();
        }

        if (!compactLabels) {
          drawLabel(overlayContext, signal.decision, Math.min(signalX + 12, width - 28), signalY + 2, overlayColor);
        }
      }
      overlayContext.restore();
    }

    const crosshair = crosshairRef.current;
    if (crosshair) {
      overlayContext.save();
      overlayContext.strokeStyle = "rgba(238, 244, 239, 0.56)";
      overlayContext.lineWidth = 1;
      overlayContext.setLineDash([2, 4]);
      overlayContext.beginPath();
      overlayContext.moveTo(crosshair.x, 0);
      overlayContext.lineTo(crosshair.x, height);
      overlayContext.moveTo(0, crosshair.y);
      overlayContext.lineTo(width, crosshair.y);
      overlayContext.stroke();
      overlayContext.restore();
    }
  }, [computedIndicators, draftDrawing, drawingPointToCanvas, drawings, kalosVisible, market.price, overlaysVisible, selectedDrawingId, signal, virtualCandles]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      drawLayers();
    });
  }, [drawLayers]);

  const refreshSeriesAutoscale = useCallback(() => {
    applySeriesAutoscale(seriesRef.current, virtualCandles, signal, visibleRangeRef.current, verticalZoom, computedIndicators);
  }, [computedIndicators, signal, verticalZoom, virtualCandles]);

  const setInitialRange = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || virtualCandles.length === 0) return;

    const visible = Math.min(Math.max(minVisibleCandles, 72), virtualCandles.length);
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, virtualCandles.length - visible),
      to: virtualCandles.length - 1,
    });
  }, [virtualCandles.length]);

  const fitScreen = useCallback(() => {
    publishChartNavigationPause();
    chartRef.current?.timeScale().fitContent();
    setVerticalZoom(1);
    setContextMenu(null);
    scheduleDraw();
  }, [scheduleDraw]);

  const resetZoom = useCallback(() => {
    publishChartNavigationPause();
    setVerticalZoom(1);
    setInitialRange();
    setContextMenu(null);
    scheduleDraw();
  }, [scheduleDraw, setInitialRange]);

  const activateDrawingTool = useCallback((tool: DrawingTool) => {
    publishChartNavigationPause();
    setActiveDrawingTool(tool);
    setDraftDrawing(null);
    setSelectedDrawingId(null);
    setContextMenu(null);
    setCursorMode(tool === "SELECT" ? "normal" : "drawing");
    scheduleDraw();
  }, [scheduleDraw]);

  const addSinglePointDrawing = useCallback((kind: DrawingKind, point: DrawingPoint) => {
    const text = kind === "TEXT" ? window.prompt("Text annotation", "Note")?.trim() : undefined;
    if (kind === "TEXT" && !text) return;

    const drawing: ChartDrawing = {
      id: createDrawingId(),
      kind,
      points: [point],
      text,
      createdAt: Date.now(),
    };

    publishChartNavigationPause();
    setDrawings(current => [...current, drawing]);
    setSelectedDrawingId(drawing.id);
    scheduleDraw();
  }, [scheduleDraw]);

  const completeDraftDrawing = useCallback(() => {
    if (!draftDrawing) return;

    const logicalDelta = Math.abs(draftDrawing.current.logical - draftDrawing.start.logical);
    const priceDelta = Math.abs(draftDrawing.current.price - draftDrawing.start.price);
    const minPriceMove = Math.max(Math.abs(market.price) * 0.00001, 0.0001);
    const shouldKeep = logicalDelta >= 0.3 || priceDelta >= minPriceMove;

    if (!shouldKeep) {
      setDraftDrawing(null);
      scheduleDraw();
      return;
    }

    const drawing: ChartDrawing = {
      id: createDrawingId(),
      kind: draftDrawing.kind,
      points: [draftDrawing.start, draftDrawing.current],
      createdAt: Date.now(),
    };

    publishChartNavigationPause();
    setDrawings(current => [...current, drawing]);
    setSelectedDrawingId(drawing.id);
    setDraftDrawing(null);
    scheduleDraw();
  }, [draftDrawing, market.price, scheduleDraw]);

  const editDrawing = useCallback((drawingId: string) => {
    const drawing = drawings.find(item => item.id === drawingId);
    if (!drawing || drawing.locked) return;

    publishChartNavigationPause();
    setSelectedDrawingId(drawingId);
    setActiveDrawingTool("SELECT");
    setCursorMode("normal");
    setContextMenu(null);

    if (drawing.kind === "TEXT") {
      const nextText = window.prompt("Edit text annotation", drawing.text ?? "Note")?.trim();
      if (!nextText) return;
      setDrawings(current => current.map(item => (item.id === drawingId ? { ...item, text: nextText } : item)));
    }

    scheduleDraw();
  }, [drawings, scheduleDraw]);

  const duplicateDrawing = useCallback((drawingId: string) => {
    const drawing = drawings.find(item => item.id === drawingId);
    if (!drawing || drawing.locked) return;

    const priceOffset = Math.max(Math.abs(market.price) * 0.004, 0.01);
    const duplicate: ChartDrawing = {
      ...drawing,
      id: createDrawingId(),
      locked: false,
      createdAt: Date.now(),
      points: drawing.points.map(point => ({
        logical: point.logical + 2,
        price: point.price + priceOffset,
      })),
    };

    publishChartNavigationPause();
    setDrawings(current => [...current, duplicate]);
    setSelectedDrawingId(duplicate.id);
    setContextMenu(null);
    scheduleDraw();
  }, [drawings, market.price, scheduleDraw]);

  const deleteDrawing = useCallback((drawingId: string) => {
    const drawing = drawings.find(item => item.id === drawingId);
    if (!drawing || drawing.locked) return;

    publishChartNavigationPause();
    setDrawings(current => current.filter(item => item.id !== drawingId));
    setSelectedDrawingId(current => (current === drawingId ? null : current));
    setContextMenu(null);
    scheduleDraw();
  }, [drawings, scheduleDraw]);

  const toggleDrawingLock = useCallback((drawingId: string) => {
    publishChartNavigationPause();
    setDrawings(current => current.map(item => (item.id === drawingId ? { ...item, locked: !item.locked } : item)));
    setSelectedDrawingId(drawingId);
    setContextMenu(null);
    scheduleDraw();
  }, [scheduleDraw]);

  const addIndicator = useCallback((type: IndicatorType) => {
    publishChartNavigationPause();
    setActiveIndicators(current => {
      if (current.length >= 5) return current;
      return [...current, createIndicatorConfig(type)];
    });
    scheduleDraw();
  }, [scheduleDraw]);

  const removeIndicator = useCallback((indicatorId: string) => {
    publishChartNavigationPause();
    setActiveIndicators(current => current.filter(indicator => indicator.id !== indicatorId));
    scheduleDraw();
  }, [scheduleDraw]);

  const updateIndicatorParams = useCallback((indicatorId: string, patch: IndicatorParams) => {
    publishChartNavigationPause();
    setActiveIndicators(current =>
      current.map(indicator => {
        if (indicator.id !== indicatorId) return indicator;
        return {
          ...indicator,
          params: normalizeIndicatorParams(indicator.type, { ...indicator.params, ...patch }),
        };
      }),
    );
    scheduleDraw();
  }, [scheduleDraw]);

  const applySmartZoom = useCallback(
    (visibleCount: number) => {
      if (smartZoomMode === "MANUAL") return;

      const now = performance.now();
      if (now - lastZoomIntentRef.current < 300) return;
      lastZoomIntentRef.current = now;

      if (smartZoomMode === "HYBRID") {
        smartZoomSequenceRef.current = (smartZoomSequenceRef.current + 1) % 3;
        if (smartZoomSequenceRef.current !== 0) return;
      }

      if (visibleCount > 450) {
        setSelectedTimeframe(current => nextTimeframe(current, "up"));
      } else if (visibleCount < 60) {
        setSelectedTimeframe(current => nextTimeframe(current, "down"));
      }
    },
    [smartZoomMode],
  );

  useEffect(() => {
    setSelectedTimeframe(market.timeframe);
  }, [market.timeframe]);

  useEffect(() => {
    loadedDrawingKeyRef.current = drawingKey;
    setDrawings(loadStoredDrawings(drawingKey));
    setDraftDrawing(null);
    setSelectedDrawingId(null);
    setActiveDrawingTool("SELECT");
    setCursorMode("normal");
  }, [drawingKey]);

  useEffect(() => {
    loadedIndicatorKeyRef.current = indicatorKey;
    setActiveIndicators(loadStoredIndicators(indicatorKey));
  }, [indicatorKey]);

  useEffect(() => {
    if (loadedDrawingKeyRef.current !== drawingKey) return;
    storeDrawings(drawingKey, drawings);
  }, [drawingKey, drawings]);

  useEffect(() => {
    if (loadedIndicatorKeyRef.current !== indicatorKey) return;
    storeIndicators(indicatorKey, activeIndicators);
  }, [activeIndicators, indicatorKey]);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return undefined;

    const chart = createChart(host, {
      autoSize: true,
      height: chartHeight,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: chartPalette.background },
        textColor: chartPalette.text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        horzLines: { color: chartPalette.grid, style: LineStyle.Solid },
        vertLines: { color: chartPalette.gridSoft, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderColor: chartPalette.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: chartPalette.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        minBarSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        enableConflation: true,
        tickMarkFormatter: (time: Time) => candleByTime.get(time)?.timestamp ?? "",
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      kineticScroll: {
        mouse: false,
        touch: false,
      },
    });

    chartRef.current = chart;
    chart.priceScale("right").setAutoScale(true);

    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      if (!params.point) {
        crosshairRef.current = null;
        setTooltip(null);
        scheduleDraw();
        return;
      }

      publishChartNavigationPause(2500);
      const fromTime = params.time ? candleByTime.get(params.time) : undefined;
      const logicalIndex = params.logical === undefined ? null : Math.round(Number(params.logical));
      const fromLogical = logicalIndex === null ? undefined : virtualCandles[clamp(logicalIndex, 0, virtualCandles.length - 1)];
      const candle = fromTime ?? fromLogical;

      if (!candle) {
        crosshairRef.current = null;
        setTooltip(null);
        scheduleDraw();
        return;
      }

      const nextTooltip = { x: params.point.x, y: params.point.y, candle };
      crosshairRef.current = nextTooltip;
      const now = performance.now();
      if (now - tooltipThrottleRef.current >= 16) {
        tooltipThrottleRef.current = now;
        setTooltip(nextTooltip);
      }
      scheduleDraw();
    };

    const handleLogicalRangeChange = (range: LogicalRange | null) => {
      visibleRangeRef.current = range;

      if (range) {
        const count = Math.max(1, range.to - range.from);
        setVisibleCandles(Math.round(count));
        applySmartZoom(count);

        if (count < minVisibleCandles || count > maxVisibleCandles) {
          const center = (range.from + range.to) / 2;
          const nextCount = clamp(count, minVisibleCandles, maxVisibleCandles);
          window.requestAnimationFrame(() => {
            chart.timeScale().setVisibleLogicalRange({
              from: center - nextCount / 2,
              to: center + nextCount / 2,
            });
          });
        }
      }

      refreshSeriesAutoscale();
      scheduleDraw();
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

    const resizeObserver = new ResizeObserver(() => {
      scheduleDraw();
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [applySmartZoom, candleByTime, chartPalette, refreshSeriesAutoscale, scheduleDraw, virtualCandles]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const handleNativeWheel = (event: WheelEvent) => {
      publishChartNavigationPause();
      if (!event.ctrlKey) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1.12 : 0.88;
      setVerticalZoom(value => clamp(value * direction, 0.35, 6));
    };

    root.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => root.removeEventListener("wheel", handleNativeWheel);
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (chartType === "AREA") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: "#33d0b3",
        topColor: "rgba(51, 208, 179, 0.34)",
        bottomColor: "rgba(51, 208, 179, 0.02)",
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: "#8ad7ff",
        lastValueVisible: true,
      }) as ISeriesApi<SeriesType, Time>;
      series.setData(chartData.area);
      seriesRef.current = series;
    } else if (chartType === "OHLC") {
      const series = chart.addSeries(BarSeries, {
        upColor: "#33d0b3",
        downColor: "#ff7777",
        openVisible: true,
        thinBars: false,
        priceLineVisible: true,
        priceLineColor: "#8ad7ff",
      }) as ISeriesApi<SeriesType, Time>;
      series.setData(chartData.bar);
      seriesRef.current = series;
    } else {
      const hollow = chartType === "HOLLOW";
      const series = chart.addSeries(CandlestickSeries, {
        upColor: hollow ? "rgba(51, 208, 179, 0.08)" : "#33d0b3",
        downColor: "#ff7777",
        borderUpColor: "#33d0b3",
        borderDownColor: "#ff7777",
        wickUpColor: "#33d0b3",
        wickDownColor: "#ff7777",
        priceLineVisible: true,
        priceLineColor: "#8ad7ff",
      }) as ISeriesApi<SeriesType, Time>;
      series.setData(chartData.candle);
      seriesRef.current = series;
    }

    refreshSeriesAutoscale();
    setInitialRange();
    scheduleDraw();
  }, [chartData, chartType, refreshSeriesAutoscale, scheduleDraw, setInitialRange]);

  useEffect(() => {
    refreshSeriesAutoscale();
    scheduleDraw();
  }, [refreshSeriesAutoscale, scheduleDraw, verticalZoom]);

  useEffect(() => {
    let frameCount = 0;
    let lastMark = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      frameCount += 1;
      if (now - lastMark >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastMark)));
        frameCount = 0;
        lastMark = now;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    scheduleDraw();
  }, [scheduleDraw]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (event.key === "Escape") {
        if (!hoveredRef.current && activeDrawingTool === "SELECT" && !draftDrawing && !contextMenu) return;
        event.preventDefault();
        activateDrawingTool("SELECT");
        return;
      }

      if (hoveredRef.current && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "h") {
          event.preventDefault();
          activateDrawingTool("HORIZONTAL");
          return;
        }
        if (key === "v") {
          event.preventDefault();
          activateDrawingTool("VERTICAL");
          return;
        }
        if (key === "t") {
          event.preventDefault();
          activateDrawingTool("TRENDLINE");
          return;
        }
        if (key === "m") {
          event.preventDefault();
          activateDrawingTool("MEASURE");
          return;
        }
      }

      if (event.code !== "Space" || !hoveredRef.current || activeDrawingTool !== "SELECT") return;
      spacePressedRef.current = true;
      setCursorMode("pan");
      event.preventDefault();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressedRef.current = false;
      if (!panRef.current) setCursorMode("normal");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activateDrawingTool, activeDrawingTool, contextMenu, draftDrawing]);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const drawingId = hitTestDrawing(event.clientX, event.clientY) ?? undefined;
    if (drawingId) {
      setSelectedDrawingId(drawingId);
    }
    setContextMenu({
      x: Math.min(Math.max(event.clientX - bounds.left, 8), Math.max(bounds.width - 236, 8)),
      y: Math.min(Math.max(event.clientY - bounds.top, 8), Math.max(bounds.height - 286, 8)),
      drawingId,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".drawing-tool-palette, .chart-context-menu")) return;

    const chart = chartRef.current;
    const range = chart?.timeScale().getVisibleLogicalRange();
    const isMiddleMouse = event.button === 1;
    const isSpaceDrag = event.button === 0 && spacePressedRef.current;

    if (!chart || !range) return;

    if (isMiddleMouse || isSpaceDrag) {
      publishChartNavigationPause();
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic QA events do not always own an active pointer; real browser drags still capture.
      }
      panRef.current = { startX: event.clientX, startRange: range };
      setCursorMode("pan");
      return;
    }

    if (event.button !== 0) return;

    const point = drawingPointFromClient(event.clientX, event.clientY);
    if (!point) return;

    if (activeDrawingTool !== "SELECT") {
      publishChartNavigationPause();
      event.preventDefault();
      setContextMenu(null);
      setSelectedDrawingId(null);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic QA events do not always own an active pointer; real browser drags still capture.
      }

      if (activeDrawingTool === "HORIZONTAL" || activeDrawingTool === "VERTICAL" || activeDrawingTool === "TEXT") {
        addSinglePointDrawing(activeDrawingTool, point);
      } else if (isMultiPointDrawing(activeDrawingTool)) {
        setDraftDrawing({ kind: activeDrawingTool, start: point, current: point });
      }

      scheduleDraw();
      return;
    }

    const drawingId = hitTestDrawing(event.clientX, event.clientY);
    setSelectedDrawingId(drawingId);
    setContextMenu(null);

    if (drawingId) {
      const drawing = drawings.find(item => item.id === drawingId);
      if (drawing && !drawing.locked) {
        publishChartNavigationPause();
        drawingDragRef.current = { id: drawingId, start: point, originals: drawings };
        setCursorMode("drawing");
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic QA events do not always own an active pointer; real browser drags still capture.
        }
      }
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const chart = chartRef.current;
    const root = rootRef.current;
    const drag = drawingDragRef.current;

    if (drag) {
      const nextPoint = drawingPointFromClient(event.clientX, event.clientY);
      if (!nextPoint) return;

      publishChartNavigationPause();
      const deltaLogical = nextPoint.logical - drag.start.logical;
      const deltaPrice = nextPoint.price - drag.start.price;
      setDrawings(
        drag.originals.map(drawing =>
          drawing.id === drag.id
            ? {
                ...drawing,
                points: drawing.points.map(point => ({
                  logical: point.logical + deltaLogical,
                  price: point.price + deltaPrice,
                })),
              }
            : drawing,
        ),
      );
      scheduleDraw();
      return;
    }

    if (draftDrawing) {
      const nextPoint = drawingPointFromClient(event.clientX, event.clientY);
      if (!nextPoint) return;

      publishChartNavigationPause();
      setDraftDrawing(current => (current ? { ...current, current: nextPoint } : current));
      scheduleDraw();
      return;
    }

    if (!pan || !chart || !root) {
      updateTooltipFromClient(event.clientX, event.clientY);
      return;
    }

    publishChartNavigationPause();
    const width = Math.max(1, root.getBoundingClientRect().width);
    const span = pan.startRange.to - pan.startRange.from;
    const deltaLogical = ((pan.startX - event.clientX) / width) * span;
    chart.timeScale().setVisibleLogicalRange({
      from: pan.startRange.from + deltaLogical,
      to: pan.startRange.to + deltaLogical,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be absent when QA dispatches synthetic events.
    }

    if (draftDrawing) {
      completeDraftDrawing();
      setCursorMode(activeDrawingTool === "SELECT" ? "normal" : "drawing");
      return;
    }

    if (drawingDragRef.current) {
      drawingDragRef.current = null;
      setCursorMode("normal");
      scheduleDraw();
      return;
    }

    if (!panRef.current) return;
    panRef.current = null;
    setCursorMode(spacePressedRef.current ? "pan" : activeDrawingTool === "SELECT" ? "normal" : "drawing");
  };

  const tooltipBounds = rootRef.current?.getBoundingClientRect();
  const tooltipStyle = tooltip
    ? {
        left: tooltip.x,
        top: tooltip.y,
        transform: `translate(${
          tooltipBounds && tooltip.x > tooltipBounds.width - 236 ? "calc(-100% - 12px)" : "12px"
        }, ${tooltipBounds && tooltip.y > tooltipBounds.height - 260 ? "calc(-100% - 12px)" : "12px"})`,
      }
    : undefined;
  const tooltipMomentum = tooltip ? `${tooltip.candle.momentum >= 0 ? "+" : ""}${formatPrice(tooltip.candle.momentum)}` : "";
  const contextDrawing = contextMenu?.drawingId ? drawings.find(drawing => drawing.id === contextMenu.drawingId) : null;

  return (
    <section className="cockpit-panel">
      <div className="cockpit-panel-header">
        <div>
          <h2>{t("page.marketChart.title")}</h2>
          <p className="cockpit-muted">
            {market.symbol} | {selectedTimeframe} | {sourceLabel} | {market.sourceStatus ?? "UNKNOWN"} | fallback{" "}
            {market.fallback ?? "NONE"} | {t("common.price")} {formatPrice(market.price)} | {t("common.spread")} {market.spread} | {t("common.volume")}{" "}
            {market.volume.toLocaleString("en-US")}
          </p>
        </div>
        <StatusPill tone={signal.decision}>{formatDecision(signal.decision)}</StatusPill>
      </div>

      <div className="chart-engine-toolbar" aria-label="Chart engine controls">
        <div className="chart-control-group" aria-label="Chart type">
          {chartTypes.map(type => (
            <button
              className={`cockpit-control ${type === chartType ? "is-active" : ""}`}
              key={type}
              onClick={() => setChartType(type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
        <div className="chart-control-group" aria-label="Timeframe">
          {timeframeOrder.map(timeframe => (
            <button
              className={`cockpit-control ${timeframe === selectedTimeframe ? "is-active" : ""}`}
              key={timeframe}
              onClick={() => setSelectedTimeframe(timeframe)}
              type="button"
            >
              {timeframe}
            </button>
          ))}
        </div>
        <div className="chart-control-group" aria-label="Smart zoom mode">
          {smartZoomModes.map(mode => (
            <button
              className={`cockpit-control ${mode === smartZoomMode ? "is-active" : ""}`}
              key={mode}
              onClick={() => setSmartZoomMode(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="chart-control-group" aria-label="Zoom actions">
          <button className="cockpit-control" onClick={fitScreen} title={t("chart.fitScreen")} type="button">
            <Maximize2 size={14} aria-hidden="true" />
            {t("chart.fitScreen")}
          </button>
          <button className="cockpit-control" onClick={resetZoom} title={t("chart.resetZoom")} type="button">
            <RotateCcw size={14} aria-hidden="true" />
            {t("chart.resetZoom")}
          </button>
        </div>
      </div>

      <div className="indicator-panel" aria-label="Indicators">
        <div className="indicator-panel-head">
          <span>
            Indicators <b>{activeIndicators.length}/5</b>
          </span>
          <span>Calc {indicatorComputeCountRef.current}</span>
        </div>
        <div className="indicator-add-row">
          {indicatorCatalog.map(item => (
            <button
              className="cockpit-control"
              disabled={activeIndicators.length >= 5}
              key={item.type}
              onClick={() => addIndicator(item.type)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        {activeIndicators.length > 0 ? (
          <div className="indicator-active-list">
            {activeIndicators.map(indicator => (
              <div className="indicator-row" key={indicator.id}>
                <span className="indicator-row-name">
                  <i style={{ background: indicator.color }} />
                  <b>{indicatorCatalog.find(item => item.type === indicator.type)?.label ?? indicator.type}</b>
                </span>
                <div className="indicator-param-grid">
                  {indicator.type === "MACD" ? (
                    <>
                      <label>
                        Fast
                        <input
                          max={100}
                          min={2}
                          onChange={event => updateIndicatorParams(indicator.id, { fast: Number(event.target.value) })}
                          type="number"
                          value={indicator.params.fast ?? 12}
                        />
                      </label>
                      <label>
                        Slow
                        <input
                          max={140}
                          min={3}
                          onChange={event => updateIndicatorParams(indicator.id, { slow: Number(event.target.value) })}
                          type="number"
                          value={indicator.params.slow ?? 26}
                        />
                      </label>
                      <label>
                        Signal
                        <input
                          max={80}
                          min={2}
                          onChange={event => updateIndicatorParams(indicator.id, { signal: Number(event.target.value) })}
                          type="number"
                          value={indicator.params.signal ?? 9}
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      Period
                      <input
                        max={200}
                        min={2}
                        onChange={event => updateIndicatorParams(indicator.id, { period: Number(event.target.value) })}
                        type="number"
                        value={indicator.params.period ?? 20}
                      />
                    </label>
                  )}
                  {indicator.type === "BOLLINGER" ? (
                    <label>
                      Dev
                      <input
                        max={5}
                        min={0.5}
                        onChange={event => updateIndicatorParams(indicator.id, { deviation: Number(event.target.value) })}
                        step={0.1}
                        type="number"
                        value={indicator.params.deviation ?? 2}
                      />
                    </label>
                  ) : null}
                </div>
                <button className="cockpit-control" onClick={() => removeIndicator(indicator.id)} type="button">
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={`cockpit-chart chart-engine cursor-${cursorMode}`}
        data-api-calls-during-zoom={apiCallGuardRef.current}
        data-api-calls-during-draw={drawingApiGuardRef.current}
        data-active-drawing-tool={activeDrawingTool}
        data-chart-engine="lightweight-charts-canvas"
        data-drawing-count={drawings.length}
        onContextMenu={handleContextMenu}
        onDoubleClick={resetZoom}
        onMouseEnter={() => {
          hoveredRef.current = true;
        }}
        onMouseLeave={() => {
          hoveredRef.current = false;
          setTooltip(null);
          if (!panRef.current && !draftDrawing && !drawingDragRef.current) {
            spacePressedRef.current = false;
            setCursorMode(activeDrawingTool === "SELECT" ? "normal" : "drawing");
          }
        }}
        onMouseMove={(event: MouseEvent<HTMLDivElement>) => {
          if (!panRef.current && !draftDrawing && !drawingDragRef.current) {
            updateTooltipFromClient(event.clientX, event.clientY);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={rootRef}
      >
        <div className="drawing-tool-palette" aria-label="Drawing tools">
          {drawingTools.map(({ tool, label, shortcut, Icon }) => (
            <button
              aria-label={label}
              className={tool === activeDrawingTool ? "is-active" : ""}
              key={tool}
              onClick={() => activateDrawingTool(tool)}
              title={shortcut ? `${label} (${shortcut})` : label}
              type="button"
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="chart-price-layer" ref={chartHostRef} />
        <canvas aria-hidden="true" className="chart-layer chart-indicator-layer" ref={indicatorCanvasRef} />
        <canvas aria-hidden="true" className="chart-layer chart-drawing-layer" ref={drawingCanvasRef} />
        <canvas aria-hidden="true" className="chart-layer chart-overlay-layer" ref={overlayCanvasRef} />

        {tooltip ? (
          <div className="chart-tooltip" style={tooltipStyle}>
            <div className="chart-tooltip-title">
              <strong>{market.symbol}</strong>
              <span>{tooltip.candle.timestamp}</span>
            </div>
            <span>
              Open <b>{formatPrice(tooltip.candle.open)}</b>
            </span>
            <span>
              High <b>{formatPrice(tooltip.candle.high)}</b>
            </span>
            <span>
              Low <b>{formatPrice(tooltip.candle.low)}</b>
            </span>
            <span>
              Close <b>{formatPrice(tooltip.candle.close)}</b>
            </span>
            <span>
              {t("common.volume")} <b>{tooltip.candle.volume.toLocaleString("en-US")}</b>
            </span>
            <span>
              {t("common.trend")} <b>{tooltip.candle.trend}</b>
            </span>
            <span>
              Momentum <b>{tooltipMomentum}</b>
            </span>
            <span>
              Timestamp <b>{tooltip.candle.timestamp}</b>
            </span>
            <span>
              {t("common.source")} <b>{sourceLabel}</b>
            </span>
            <span>
              {t("common.spread")} <b>{market.spread}</b>
            </span>
            {indicatorTooltipRows.length > 0 ? (
              <>
                <div className="chart-tooltip-title">
                  <strong>Indicators</strong>
                  <span>{indicatorTooltipRows.length}</span>
                </div>
                {indicatorTooltipRows.slice(0, 12).map(row => (
                  <span key={`${row.label}-${row.color}`}>
                    {row.label} <b style={{ color: row.color }}>{formatPrice(row.value ?? 0)}</b>
                  </span>
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        {contextMenu ? (
          <div
            className="chart-context-menu"
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            {contextDrawing ? (
              <>
                <div className="chart-context-title">
                  <span>{contextDrawing.kind}</span>
                  <b>{contextDrawing.locked ? "LOCKED" : "EDITABLE"}</b>
                </div>
                <button disabled={contextDrawing.locked} type="button" onClick={() => editDrawing(contextDrawing.id)}>
                  <Pencil size={13} aria-hidden="true" />
                  Edit
                </button>
                <button disabled={contextDrawing.locked} type="button" onClick={() => duplicateDrawing(contextDrawing.id)}>
                  <Copy size={13} aria-hidden="true" />
                  Duplicate
                </button>
                <button disabled={contextDrawing.locked} type="button" onClick={() => deleteDrawing(contextDrawing.id)}>
                  <Trash2 size={13} aria-hidden="true" />
                  Delete
                </button>
                <button type="button" onClick={() => toggleDrawingLock(contextDrawing.id)}>
                  {contextDrawing.locked ? <Unlock size={13} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}
                  {contextDrawing.locked ? "Unlock" : "Lock"}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={fitScreen}>{t("chart.fitScreen")}</button>
                <button type="button" onClick={resetZoom}>{t("chart.resetZoom")}</button>
                <button type="button" onClick={() => setKalosVisible(value => !value)}>
                  {kalosVisible ? "Hide Kalos" : "Show Kalos"}
                </button>
                <button type="button" onClick={() => setOverlaysVisible(value => !value)}>
                  {overlaysVisible ? "Hide overlays" : "Show overlays"}
                </button>
                <div className="chart-context-group">
                  <span>Draw</span>
                  <div className="chart-context-grid">
                    {drawingTools.slice(1).map(({ tool, label }) => (
                      <button className={tool === activeDrawingTool ? "is-active" : ""} key={tool} type="button" onClick={() => activateDrawingTool(tool)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="chart-context-group">
                  <span>Chart type</span>
                  <div className="chart-context-grid">
                    {chartTypes.map(type => (
                      <button className={type === chartType ? "is-active" : ""} key={type} type="button" onClick={() => setChartType(type)}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="chart-context-group">
                  <span>Mode</span>
                  <div className="chart-context-grid">
                    {(["Manual", "Semi-auto", "Auto"] as const).map(mode => (
                      <button
                        className={mode === contextMode ? "is-active" : ""}
                        key={mode}
                        type="button"
                        onClick={() => setContextMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="chart-engine-status">
        <span>
          Engine <b>lightweight-charts canvas</b>
        </span>
        <span>
          Layers <b>Price / Indicator / Drawing / Overlay</b>
        </span>
        <span>
          Smart Zoom <b>{smartZoomMode}</b>
        </span>
        <span>
          Visible <b>{visibleCandles}</b>
        </span>
        <span>
          Vertical <b>{verticalZoom.toFixed(2)}x</b>
        </span>
        <span>
          FPS <b>{fps}</b>
        </span>
        <span>
          API on zoom <b>{apiCallGuardRef.current}</b>
        </span>
        <span>
          Tool <b>{activeDrawingLabel}</b>
        </span>
        <span>
          Drawings <b>{drawings.length}</b>
        </span>
        <span>
          Indicators <b>{activeIndicators.length}/5</b>
        </span>
        <span>
          Calc <b>{indicatorComputeCountRef.current}</b>
        </span>
        <span>
          API on draw <b>{drawingApiGuardRef.current}</b>
        </span>
        <span>
          {t("common.live")} <b>OFF</b>
        </span>
        <span>
          AUTO EXECUTION <b>OFF</b>
        </span>
      </div>
    </section>
  );
}
