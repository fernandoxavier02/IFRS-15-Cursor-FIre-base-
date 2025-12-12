import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  isLoading,
  className,
  testId,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend
    ? trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus
    : null;

  const trendColor =
    trend?.direction === "up"
      ? "text-chart-2"
      : trend?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const cardTestId = testId || `metric-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <Card className={cn("", className)} data-testid={cardTestId}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-2xl font-semibold tabular-nums truncate" data-testid={`${cardTestId}-value`}>
              {value}
            </p>
            {(subtitle || trend) && (
              <div className="flex items-center gap-2 mt-1">
                {trend && TrendIcon && (
                  <span className={cn("flex items-center gap-0.5 text-xs", trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {Math.abs(trend.value)}%
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
