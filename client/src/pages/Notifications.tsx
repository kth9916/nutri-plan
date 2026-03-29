import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  Sparkles,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

export default function Notifications() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const { data: notifications, isLoading, refetch } = trpc.notification.list.useQuery();
  const utils = trpc.useUtils();

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      toast.success("모든 알림을 읽음 처리했습니다.");
    },
  });

  const notifTypeConfig = {
    meal_generated: { icon: Sparkles, color: "text-blue-500", bg: "bg-blue-50" },
    meal_confirmed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    payment_success: { icon: CreditCard, color: "text-purple-500", bg: "bg-purple-50" },
    system: { icon: Bell, color: "text-gray-500", bg: "bg-gray-50" },
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">알림</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="gap-2"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              모두 읽음
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-2">알림이 없습니다</p>
            <p className="text-sm text-muted-foreground font-light">
              식단 생성, 확정, 결제 시 알림이 표시됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const config = notifTypeConfig[notif.type as keyof typeof notifTypeConfig] ?? notifTypeConfig.system;
              const Icon = config.icon;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    !notif.isRead
                      ? "bg-card border-primary/20 hover:border-primary/40"
                      : "bg-card/50 border-border/50 opacity-70 hover:opacity-100"
                  }`}
                  onClick={() => {
                    if (!notif.isRead) markReadMutation.mutate({ id: notif.id });
                  }}
                >
                  <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{notif.title}</div>
                      <div className="text-xs text-muted-foreground font-light flex-shrink-0">
                        {new Date(notif.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground font-light mt-0.5">
                      {notif.content}
                    </div>
                  </div>
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
