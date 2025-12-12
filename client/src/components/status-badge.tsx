import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "draft"
  | "active"
  | "modified"
  | "terminated"
  | "expired"
  | "suspended"
  | "revoked"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "trialing"
  | "scheduled"
  | "invoiced"
  | "paid"
  | "overdue"
  | "cancelled"
  | "posted"
  | "unposted";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  modified: { label: "Modified", variant: "outline" },
  terminated: { label: "Terminated", variant: "destructive" },
  expired: { label: "Expired", variant: "secondary" },
  suspended: { label: "Suspended", variant: "destructive" },
  revoked: { label: "Revoked", variant: "destructive" },
  past_due: { label: "Past Due", variant: "destructive" },
  canceled: { label: "Canceled", variant: "secondary" },
  unpaid: { label: "Unpaid", variant: "destructive" },
  trialing: { label: "Trialing", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "outline" },
  invoiced: { label: "Invoiced", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  posted: { label: "Posted", variant: "default" },
  unposted: { label: "Unposted", variant: "outline" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };

  return (
    <Badge
      variant={config.variant}
      className={cn("text-xs font-medium", className)}
    >
      {config.label}
    </Badge>
  );
}
