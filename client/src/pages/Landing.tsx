import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import RazonModeBanner from "@/components/RazonModeBanner";
import { useRazonApi } from "@/hooks/useRazonApi";
import type { RazonStatus } from "@/lib/api";
import { ArrowRight, BarChart3, BookOpen, Shield, TrendingUp } from "lucide-react";

export default function Landing() {
  const status = useRazonApi<RazonStatus>("/api/status");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/60">
                <span className="text-xs font-bold text-accent-foreground">R</span>
              </div>
              <span className="text-lg font-bold">RAZON</span>
            </div>
          </Link>
          <Link href="/dashboard">
            <Button className="btn-fintech bg-accent text-accent-foreground hover:bg-accent/90">
              Launch App <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden py-20 md:py-28">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url('https://d2xsxph8kpxj0f.cloudfront.net/310519663588118950/9wgLGKuyRG73B9k3FiPtex/hero-fintech-trading-FzrLMKgAch2McMgvAAxdnf.webp')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />

        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-5xl font-bold leading-tight md:text-6xl">
              RAZON
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              AI Trading Analysis Platform
            </p>

            <div className="mx-auto mb-8 max-w-2xl">
              <RazonModeBanner
                state={status.state}
                mode={status.data?.mode ?? "demo"}
              />
            </div>

            <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
              RAZON V1 provides analysis-only market signals, risk guardrails,
              backtest readiness, and a decision journal. It does not place
              trades automatically.
            </p>

            <Link href="/dashboard">
              <Button className="btn-fintech bg-accent px-8 py-6 text-lg text-accent-foreground hover:bg-accent/90">
                Open RAZON Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "RAZON Signals",
                description: "BUY, SELL, or NO SIGNAL from the V1 signal engine.",
              },
              {
                icon: <BarChart3 className="h-8 w-8" />,
                title: "RAZON Analysis",
                description: "Price, volume, RSI, EMA, and ATR inputs from the API.",
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: "RAZON Protect",
                description: "V1 guardrails block automated and live execution.",
              },
              {
                icon: <BookOpen className="h-8 w-8" />,
                title: "RAZON Journal",
                description: "Every generated decision records its inputs and reasons.",
              },
            ].map(feature => (
              <div key={feature.title} className="card-glow p-6">
                <div className="mb-4 text-accent">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Powered by General Tech Consult</p>
        </div>
      </footer>
    </div>
  );
}
