import { InMemoryBacktestRepository, type BacktestRepository } from "./backtest.repository";
import { runBacktest as runBacktestRunner } from "./backtest.runner";
import type { BacktestReport, BacktestRequest, BacktestRunResult } from "./backtest.types";

export interface BacktestServiceOptions {
  readonly repository?: BacktestRepository;
}

export class BacktestService {
  private readonly repository: BacktestRepository;

  constructor(options: BacktestServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryBacktestRepository();
  }

  async runBacktest(request: BacktestRequest): Promise<BacktestReport> {
    const result = runBacktestRunner(request);
    await this.repository.saveReport(result.report);
    return result.report;
  }

  runBacktestWithReplay(request: BacktestRequest): BacktestRunResult {
    return runBacktestRunner(request);
  }

  async listReports(): Promise<readonly BacktestReport[]> {
    return this.repository.listReports();
  }

  async getReport(id: string): Promise<BacktestReport | undefined> {
    return this.repository.getReport(id);
  }
}

export async function runBacktest(
  request: BacktestRequest,
  options: BacktestServiceOptions = {}
): Promise<BacktestReport> {
  const service = new BacktestService(options);
  return service.runBacktest(request);
}
