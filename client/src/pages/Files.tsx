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
  FileSpreadsheet,
  Upload,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from "lucide-react";

export default function Files() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const { data: files, isLoading } = trpc.file.list.useQuery();

  if (loading || !isAuthenticated) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusConfig = {
    uploaded: { label: "업로드됨", icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50" },
    processing: { label: "처리 중", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50" },
    completed: { label: "완료", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    failed: { label: "실패", icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">파일 관리</h1>
            <p className="text-sm text-muted-foreground font-light mt-0.5">
              업로드된 엑셀 파일 및 생성된 식단 파일
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
            <Upload className="w-4 h-4" />
            파일 업로드
          </Button>
        </div>

        {/* Storage Info */}
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">클라우드 스토리지</div>
              <div className="text-xs text-muted-foreground font-light">
                파일은 S3에 안전하게 저장됩니다
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-light">
            총 {files?.length ?? 0}개 파일 ·{" "}
            {formatFileSize(files?.reduce((acc, f) => acc + (f.fileSize ?? 0), 0) ?? 0)} 사용 중
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !files || files.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-2">업로드된 파일이 없습니다</p>
            <p className="text-sm text-muted-foreground font-light mb-6">
              엑셀 파일을 업로드하여 AI 식단을 생성해보세요
            </p>
            <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
              <Upload className="w-4 h-4" />
              파일 업로드
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => {
              const status = statusConfig[file.status as keyof typeof statusConfig] ?? statusConfig.uploaded;
              const StatusIcon = status.icon;
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{file.originalName}</div>
                      <div className="text-xs text-muted-foreground font-light">
                        {formatFileSize(file.fileSize ?? 0)} ·{" "}
                        {new Date(file.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </div>
                    <button
                      onClick={() => {
                        window.open(file.fileUrl, "_blank");
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="다운로드"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
