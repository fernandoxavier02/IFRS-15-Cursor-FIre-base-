import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-firebase";
import { auditLogService } from "@/lib/firestore-service";
import type { AuditLog } from "@shared/firestore-types";
import { useQuery } from "@tanstack/react-query";
import {
    Calculator,
    Calendar,
    ChevronDown,
    Clock,
    FileText,
    Filter,
    KeyRound,
    Search,
    User
} from "lucide-react";
import { useState } from "react";

interface AuditLogWithDetails extends AuditLog {
  userName?: string;
}

const actionColors: Record<string, string> = {
  create: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  update: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  approve: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  reject: "bg-destructive/10 text-destructive border-destructive/20",
  recognize: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  defer: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const entityIcons: Record<string, React.ReactNode> = {
  contract: <FileText className="h-4 w-4" />,
  license: <KeyRound className="h-4 w-4" />,
  performance_obligation: <Calculator className="h-4 w-4" />,
  customer: <User className="h-4 w-4" />,
};

export default function AuditTrail() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data: auditLogs, isLoading } = useQuery<AuditLogWithDetails[]>({
    queryKey: ["audit-logs", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { toDate } = await import("@shared/firestore-types");
      const logs = await auditLogService.getAll(user.tenantId);
      // Convert Firestore timestamps to Date objects safely
      return logs.map(log => {
        const createdAt = toDate(log.createdAt);
        return {
          ...log,
          createdAt: createdAt || new Date(), // Fallback to current date if invalid
        };
      }).filter(log => {
        // Filter out logs with invalid dates
        const date = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
        return !isNaN(date.getTime());
      }) as AuditLogWithDetails[];
    },
    enabled: !!user?.tenantId,
  });

  const filteredLogs = auditLogs?.filter((log) => {
    const matchesSearch =
      log.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.justification?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entityType === entityFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const groupLogsByDate = (logs: AuditLogWithDetails[]) => {
    const groups: Record<string, AuditLogWithDetails[]> = {};
    logs.forEach((log) => {
      try {
        const dateObj = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
        if (isNaN(dateObj.getTime())) {
          console.warn("Invalid date for log:", log.id);
          return;
        }
        const date = dateObj.toLocaleDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(log);
      } catch (error) {
        console.warn("Error formatting date for log:", log.id, error);
      }
    });
    return groups;
  };

  const groupedLogs = filteredLogs ? groupLogsByDate(filteredLogs) : {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete history of system changes and decisions
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-audit"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40" data-testid="select-entity-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="contract">Contracts</SelectItem>
            <SelectItem value="license">Licenses</SelectItem>
            <SelectItem value="performance_obligation">Obligations</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36" data-testid="select-action-filter">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="recognize">Recognize</SelectItem>
            <SelectItem value="defer">Defer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(groupedLogs).length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-30" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-6 space-y-8">
                {Object.entries(groupedLogs).map(([date, logs]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{date}</span>
                      <Badge variant="secondary" className="text-xs">
                        {logs.length} event{logs.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="space-y-3 ml-6 border-l pl-6">
                      {logs.map((log) => (
                        <Collapsible
                          key={log.id}
                          open={expandedLogs.has(log.id)}
                          onOpenChange={() => toggleExpanded(log.id)}
                        >
                          <div className="relative">
                            <div className="absolute -left-9 top-3 w-3 h-3 rounded-full bg-muted border-2 border-background" />
                            
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-start p-4 h-auto hover-elevate"
                              >
                                <div className="flex items-start gap-3 flex-1">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {log.userName?.substring(0, 2).toUpperCase() || "SY"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">
                                        {log.userName || "System"}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${actionColors[log.action] || ""}`}
                                      >
                                        {log.action}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {log.entityType}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      {entityIcons[log.entityType] || <FileText className="h-3 w-3" />}
                                      <span className="font-mono">{log.entityId.substring(0, 8)}...</span>
                                      <span>|</span>
                                      <Clock className="h-3 w-3" />
                                      <span>{(() => {
                                        try {
                                          const date = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
                                          return isNaN(date.getTime()) ? "-" : date.toLocaleTimeString();
                                        } catch {
                                          return "-";
                                        }
                                      })()}</span>
                                      {log.ipAddress && (
                                        <>
                                          <span>|</span>
                                          <span className="font-mono">{log.ipAddress}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedLogs.has(log.id) ? "rotate-180" : ""}`} />
                                </div>
                              </Button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-4 pb-4 space-y-3">
                                {log.justification && (
                                  <div className="rounded-md bg-muted p-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Justification
                                    </p>
                                    <p className="text-sm">{log.justification}</p>
                                  </div>
                                )}

                                {(log.previousValue !== undefined || log.newValue !== undefined) && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {log.previousValue !== undefined && (
                                      <div className="rounded-md bg-muted/50 p-3">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          Previous Value
                                        </p>
                                        <pre className="text-xs font-mono overflow-auto max-h-32">
                                          {formatValue(log.previousValue)}
                                        </pre>
                                      </div>
                                    )}
                                    {log.newValue !== undefined && (
                                      <div className="rounded-md bg-muted/50 p-3">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          New Value
                                        </p>
                                        <pre className="text-xs font-mono overflow-auto max-h-32">
                                          {formatValue(log.newValue)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
