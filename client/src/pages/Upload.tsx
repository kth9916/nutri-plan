import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AnalyzingLoader from "@/components/AnalyzingLoader";
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";

/**
 * 엑셀 파일 업로드 페이지
 *
 * 업로드 흐름:
 * 1. 드래그앤드롭 또는 클릭으로 파일 선택
 * 2. 파일 유효성 검사 (.xlsx, .xls, 최대 10MB)
 * 3. 파일을 base64로 인코딩 후 서버 API 전송
 * 4. 서버에서 S3 업로드 및 메타데이터 저장
 * 5. AI 식단 생성 페이지로 이동
 *
 * 성능 최적화 방향:
 * - 현재: base64 인코딩 (단순하지만 파일 크기 33% 증가)
 * - 개선: Presigned URL 방식으로 클라이언트에서 직접 S3 업로드
 *   → 서버 부하 제거, 대용량 파일 지원
 */
export default function Upload() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  // AI 분석 중 로딩 오버레이 표시 여부
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [preferences, setPreferences] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.file.upload.useMutation();
  const generateMutation = trpc.mealPlan.generate.useMutation();

  /**
   * 파일 유효성 검사
   * - 허용 형식: .xlsx, .xls
   * - 최대 크기: 10MB
   */
  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const allowedExtensions = [".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      return "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "파일 크기는 10MB를 초과할 수 없습니다.";
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    setUploadStatus("idle");
    setUploadProgress(0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  /**
   * 파일 업로드 및 AI 식단 생성 실행
   *
   * 처리 순서:
   * 1. File → ArrayBuffer → base64 변환
   * 2. 서버 API로 파일 업로드 (S3 저장)
   * 3. AI 식단 생성 요청
   * 4. 생성된 플랜 페이지로 이동
   */
  const handleUploadAndGenerate = async () => {
    if (!selectedFile) return;

    try {
      setUploadStatus("uploading");
      setUploadProgress(20);

      // File → base64 변환
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      setUploadProgress(40);

      // 파일 업로드
      const { fileId } = await uploadMutation.mutateAsync({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileData: base64,
      });

      setUploadProgress(60);

      // AI 분석 로딩 화면 표시 (LLM 호출 중)
      setIsAnalyzing(true);
      const { planId } = await generateMutation.mutateAsync({
        year,
        month,
        sourceFileId: fileId,
        preferences: preferences || undefined,
      });

      setUploadProgress(100);
      setUploadStatus("success");
      setIsAnalyzing(false);

      toast.success("식단 생성이 완료되었습니다!");
      setTimeout(() => {
        navigate(`/dashboard/plans/${planId}`);
      }, 1000);
    } catch (error) {
      setUploadStatus("error");
      setUploadProgress(0);
      setIsAnalyzing(false); // 오류 시 로딩 화면 해제
      toast.error("업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error(error);
    }
  };

  if (loading || !isAuthenticated) return null;

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <DashboardLayout>
      {/* AI 분석 중 오버레이 로딩 화면 */}
      <AnalyzingLoader isVisible={isAnalyzing} />
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">식단 업로드</h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            엑셀 파일을 업로드하면 AI가 한 달 치 맞춤형 식단을 자동 생성합니다
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {["파일 업로드", "AI 분석", "식단 검토"].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {i + 1}
                </div>
                {step}
              </div>
              {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-700">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground font-light mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setUploadStatus("idle");
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                파일 제거
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isDragging ? "bg-primary/20" : "bg-muted"}`}>
                <UploadIcon className={`w-8 h-8 transition-all ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-semibold mb-1">
                  {isDragging ? "파일을 놓아주세요" : "엑셀 파일을 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-sm text-muted-foreground font-light">
                  .xlsx, .xls 형식 지원 · 최대 10MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploadStatus === "uploading" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-light">
                {uploadProgress < 60 ? "파일 업로드 중..." : "AI 식단 생성 중..."}
              </span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="bg-card rounded-xl border border-border/50 p-6 space-y-5">
          <h2 className="font-semibold">식단 생성 설정</h2>

          {/* Year/Month Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">대상 연도</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">대상 월</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              선호도 / 제약사항 <span className="text-muted-foreground font-light">(선택)</span>
            </label>
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="예: 저염식 위주, 채식 포함, 알레르기 (견과류 제외) 등"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-light resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Info */}
          <div className="flex gap-2.5 p-3 rounded-lg bg-accent/50">
            <Info className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-accent-foreground font-light leading-relaxed">
              엑셀 파일에 기존 식단 데이터가 있으면 AI가 이를 참고하여 더 맞춤화된 식단을 생성합니다.
              파일 없이도 기본 영양 균형 기준으로 식단을 생성할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            onClick={handleUploadAndGenerate}
            disabled={uploadStatus === "uploading" || uploadStatus === "success"}
            className="flex-1 gap-2"
          >
            {uploadStatus === "uploading" ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                처리 중...
              </>
            ) : uploadStatus === "success" ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                완료!
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 식단 생성
              </>
            )}
          </Button>
        </div>

        {/* Template Download */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-light">
            엑셀 템플릿이 필요하신가요?{" "}
            <button
              onClick={() => {
                toast.info("템플릿 다운로드 기능은 준비 중입니다.");
              }}
              className="text-primary hover:underline"
            >
              샘플 템플릿 다운로드
            </button>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
