interface RazonEmptyStateProps {
  title: string;
  description: string;
}

export default function RazonEmptyState({
  title,
  description,
}: RazonEmptyStateProps) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-6">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
