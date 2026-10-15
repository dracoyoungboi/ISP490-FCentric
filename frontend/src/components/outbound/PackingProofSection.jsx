import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, Video, Upload, Trash2, CheckCircle2, AlertCircle, Play,
  Square, RefreshCw, Eye, X, Loader2, Sparkles, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import CameraCaptureModal from "./CameraCaptureModal";
import { dongGoiService } from "@/services/dongGoiService";
import { formatCurrency } from "@/utils/formatters";
import { getApiErrorMessage } from "@/utils/apiError";

export const LOAI_BANG_CHUNG = {
  ANH_HANG_TRONG_HOP: "ANH_HANG_TRONG_HOP",
  ANH_NIEM_PHONG_TEM_VC: "ANH_NIEM_PHONG_TEM_VC",
  VIDEO_DONG_GOI: "VIDEO_DONG_GOI",
};

/**
 * Chuẩn hóa URL hiển thị bằng chứng đóng gói:
 * - Nếu URL đầy đủ (HTTP/HTTPS/blob/data): giữ nguyên.
 * - Nếu URL là đường dẫn tương đối MinIO (legacy data "packing-proofs/..."): tự động ghép origin MinIO công khai HTTPS.
 */
export function resolveProofMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("packing-proofs/")) {
    return `https://minio.slmglobal.vn/fashion/${url}`;
  }
  return url;
}

/**
 * Section Bằng chứng đóng gói bắt buộc theo giá trị đơn hàng (SRS 6.3.1 - 6.3.2)
 * - Đơn < 1.000.000đ: 2 ảnh (Hàng trong hộp + Niêm phong kèm tem ĐVVC)
 * - Đơn >= 1.000.000đ: 1 video (15-30s từ lúc cho đồ vào đến khi niêm phong)
 * - Tự động xóa vĩnh viễn trên MinIO sau 30 ngày
 */
export default function PackingProofSection({
  donId,
  soDonHang,
  tongTienDonHang = 0,
  yeuCauVideo = false,
  danhSachBangChung = [],
  daDuBangChung = false,
  onRefresh,
  readOnly = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null); // { type: 'image' | 'video', url, title }

  // ── Tìm bằng chứng theo loại ──
  const anhHang = danhSachBangChung.find((b) => b.loaiBangChung === LOAI_BANG_CHUNG.ANH_HANG_TRONG_HOP);
  const anhNiemPhong = danhSachBangChung.find((b) => b.loaiBangChung === LOAI_BANG_CHUNG.ANH_NIEM_PHONG_TEM_VC);
  const videoDongGoi = danhSachBangChung.find((b) => b.loaiBangChung === LOAI_BANG_CHUNG.VIDEO_DONG_GOI);

  // ── Upload handler chung ──
  const handleUploadFile = async (file, loaiBangChung, thoiLuongGiay = null) => {
    if (!file || !donId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("loaiBangChung", loaiBangChung);
      if (thoiLuongGiay != null) {
        formData.append("thoiLuongGiay", thoiLuongGiay);
      }

      await dongGoiService.uploadBangChung(donId, formData);
      toast.success("Tải lên bằng chứng đóng gói thành công");
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải lên bằng chứng"));
    } finally {
      setUploading(false);
    }
  };

  // ── Xóa bằng chứng ──
  const handleDeleteProof = async (id, title) => {
    if (readOnly || !id) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${title || "bằng chứng này"} để tải lại không?`)) return;

    setDeletingId(id);
    try {
      await dongGoiService.xoaBangChung(id);
      toast.success("Đã xóa bằng chứng đóng gói");
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa bằng chứng"));
    } finally {
      setDeletingId(null);
    }
  };

  const formattedTongTien = formatCurrency(tongTienDonHang || 0);

  return (
    <SurfaceCard
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-bo-primary" />
          <span>Bằng chứng đóng gói (Proof of Packaging)</span>
        </div>
      }
      description={
        <span>
          Giá trị đơn: <strong className="font-semibold text-bo-foreground">{formattedTongTien}</strong>
          {" · "}
          {yeuCauVideo ? (
            <span className="text-amber-700 font-medium">Đơn ≥ 1.000.000 đ → Bắt buộc 1 video quay niêm phong (15-30s)</span>
          ) : (
            <span className="text-emerald-700 font-medium">Đơn &lt; 1.000.000 đ → Bắt buộc 2 ảnh đóng gói</span>
          )}
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          {daDuBangChung ? (
            <StatusBadge label="Đã đủ bằng chứng" tone="success" />
          ) : (
            <StatusBadge label="Chưa đủ bằng chứng" tone="warning" />
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner hướng dẫn */}
        <div
          className={`flex items-start gap-3 rounded-lg border p-3.5 text-xs ${
            daDuBangChung
              ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
              : "border-amber-200 bg-amber-50/70 text-amber-900"
          }`}
        >
          {daDuBangChung ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <p className="font-semibold">
              {daDuBangChung
                ? "Bằng chứng đóng gói đã hợp lệ! Bạn có thể bấm 'Hoàn tất đóng gói' sau khi quét đủ sản phẩm."
                : "Cần tải lên đầy đủ bằng chứng quy định để mở khóa nút 'Hoàn tất đóng gói'."}
            </p>
            <p className="text-slate-600">
              * Tệp bằng chứng được lưu trữ trên MinIO và tự động xóa vĩnh viễn sau 30 ngày kể từ thời điểm tạo.
            </p>
          </div>
        </div>

        {/* ── GIAO DIỆN 1: ĐƠN < 1 TRIỆU (2 ẢNH) ── */}
        {!yeuCauVideo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ảnh 1: Hàng trong hộp */}
            <PhotoUploadSlot
              title="Ảnh 1: Hàng đã cho vào hộp/túi"
              description="Chụp rõ các sản phẩm của đơn hàng đã xếp gọn trong hộp hoặc túi đóng gói."
              proof={anhHang}
              loaiBangChung={LOAI_BANG_CHUNG.ANH_HANG_TRONG_HOP}
              onUpload={handleUploadFile}
              onDelete={handleDeleteProof}
              onPreview={setPreviewMedia}
              uploading={uploading}
              deleting={deletingId === anhHang?.id}
              readOnly={readOnly}
            />

            {/* Ảnh 2: Niêm phong kèm tem ĐVVC */}
            <PhotoUploadSlot
              title="Ảnh 2: Hộp niêm phong + Tem ĐVVC"
              description="Hộp đã dán kín băng keo niêm phong, dán tem vận chuyển rõ mã vận đơn."
              proof={anhNiemPhong}
              loaiBangChung={LOAI_BANG_CHUNG.ANH_NIEM_PHONG_TEM_VC}
              onUpload={handleUploadFile}
              onDelete={handleDeleteProof}
              onPreview={setPreviewMedia}
              uploading={uploading}
              deleting={deletingId === anhNiemPhong?.id}
              readOnly={readOnly}
            />
          </div>
        ) : (
          /* ── GIAO DIỆN 2: ĐƠN >= 1 TRIỆU (VIDEO 15-30S) ── */
          <VideoUploadSection
            proof={videoDongGoi}
            onUpload={handleUploadFile}
            onDelete={handleDeleteProof}
            onPreview={setPreviewMedia}
            uploading={uploading}
            deleting={deletingId === videoDongGoi?.id}
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── Lightbox Preview Modal ── */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
          <div className="relative max-h-[90vh] max-w-4xl w-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-950 text-white">
              <span className="font-semibold text-sm">{previewMedia.title || "Xem bằng chứng đóng gói"}</span>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="text-slate-400 hover:text-white rounded p-1"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black min-h-[300px] max-h-[75vh] overflow-auto">
              {previewMedia.type === "video" ? (
                <video src={resolveProofMediaUrl(previewMedia.url)} controls autoPlay className="max-h-[70vh] max-w-full rounded" />
              ) : (
                <img src={resolveProofMediaUrl(previewMedia.url)} alt="Preview" className="max-h-[70vh] max-w-full object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

/** Khung hiển thị và upload 1 ảnh */
function PhotoUploadSlot({
  title,
  description,
  proof,
  loaiBangChung,
  onUpload,
  onDelete,
  onPreview,
  uploading,
  deleting,
  readOnly,
}) {
  const fileInputRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Vui lòng chọn tệp hình ảnh (JPEG, PNG, WebP)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Dung lượng ảnh tối đa là 10MB");
        return;
      }
      setHasImageError(false);
      onUpload(file, loaiBangChung);
    }
    e.target.value = "";
  };

  const rawUrl = proof?.urlPublic || proof?.duongDanMinio;
  const isUploaded = Boolean(rawUrl);
  const mediaUrl = resolveProofMediaUrl(rawUrl);

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      isUploaded ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            {isUploaded ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Camera className="size-4 text-slate-500" />}
            {title}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {isUploaded ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shrink-0">
            Đã có ảnh
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shrink-0">
            Chưa có
          </span>
        )}
      </div>

      {isUploaded ? (
        <div className="mt-3 space-y-2">
          <div className="relative group rounded-md overflow-hidden border border-slate-200 bg-slate-100 aspect-video max-h-48 flex items-center justify-center">
            {hasImageError ? (
              <div className="flex flex-col items-center justify-center p-4 text-center text-slate-500">
                <AlertCircle className="size-6 text-amber-500 mb-1" />
                <span className="text-xs font-medium">Không thể tải ảnh từ MinIO</span>
                <button
                  type="button"
                  onClick={() => setHasImageError(false)}
                  className="mt-1 text-[11px] text-bo-primary underline font-medium"
                >
                  Thử tải lại
                </button>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt={title}
                onError={() => setHasImageError(true)}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {!hasImageError && (
                <button
                  type="button"
                  onClick={() => onPreview({ type: "image", url: mediaUrl, title })}
                  className="bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full shadow"
                  title="Xem ảnh lớn"
                >
                  <Eye className="size-4" />
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onDelete(proof.id, title)}
                  disabled={deleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-full shadow disabled:opacity-50"
                  title="Xóa và chụp lại"
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Người chụp: {proof.tenNguoiTao || "Nhân viên"}</span>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="text-emerald-700 hover:underline font-medium"
                >
                  Chụp lại
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-bo-primary hover:underline font-medium"
                >
                  Chọn tệp khác
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <Camera className="size-8 text-slate-400 mb-2" />
          <p className="text-xs text-slate-600 font-medium mb-3">Chụp trực tiếp từ camera hoặc tải ảnh từ máy tính</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsCameraOpen(true)}
              disabled={uploading || readOnly}
              className="gap-1.5 text-xs h-8 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium"
            >
              <Camera className="size-3.5" /> Chụp ảnh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || readOnly}
              className="gap-1.5 text-xs h-8 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Chọn tệp ảnh
            </Button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* Camera Capture Modal (WebRTC) */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          setHasImageError(false);
          onUpload(file, loaiBangChung);
        }}
        title={`Chụp ảnh: ${title}`}
        description={description}
      />
    </div>
  );
}

/** Khung hiển thị và quay/upload video 15-30s */
function VideoUploadSection({
  proof,
  onUpload,
  onDelete,
  onPreview,
  uploading,
  deleting,
  readOnly,
}) {
  const fileInputRef = useRef(null);
  const liveVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stream, setStream] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const rawUrl = proof?.urlPublic || proof?.duongDanMinio;
  const isUploaded = Boolean(rawUrl);
  const mediaUrl = resolveProofMediaUrl(rawUrl);

  // Dọn dẹp stream camera khi unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stream]);

  // Bắt đầu quay camera trực tiếp
  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      setStream(mediaStream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mediaStream;
      }

      const recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `video_dong_goi_${Date.now()}.webm`, { type: "video/webm" });
        // Tải lên
        onUpload(file, LOAI_BANG_CHUNG.VIDEO_DONG_GOI, Math.max(15, Math.min(30, seconds)));
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSeconds(0);

      // Đếm giây 0 -> 30s
      timerIntervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 29) {
            // Tự động dừng khi đủ 30 giây
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Không thể mở Camera để quay video: " + err.message);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsRecording(false);
    setSeconds(0);
  };

  // Chọn tệp video từ máy tính và validate duration
  const handleVideoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov)$/i)) {
      toast.error("Vui lòng chọn tệp video hợp lệ (MP4, WebM, MOV)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Dung lượng video tối đa là 100MB");
      return;
    }

    // Kiểm tra thời lượng bằng HTML5 Video Element
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = URL.createObjectURL(file);
    tempVideo.onloadedmetadata = () => {
      URL.revokeObjectURL(tempVideo.src);
      const duration = Math.round(tempVideo.duration);
      if (duration < 15 || duration > 30) {
        toast.error(`Thời lượng video không hợp lệ: Yêu cầu từ 15 đến 30 giây (Hiện tại: ${duration}s)`);
        return;
      }
      onUpload(file, LOAI_BANG_CHUNG.VIDEO_DONG_GOI, duration);
    };
    tempVideo.onerror = () => {
      URL.revokeObjectURL(tempVideo.src);
      toast.error("Không thể đọc thông tin tệp video này");
    };

    e.target.value = "";
  };

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      isUploaded ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            {isUploaded ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Video className="size-4 text-slate-500" />}
            Video đóng gói niêm phong (Thời lượng: 15–30s)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Quay liền mạch từ lúc cho sản phẩm vào hộp/túi đến khi dán kín niêm phong kèm tem vận chuyển.
          </p>
        </div>
        {isUploaded ? (
          <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 shrink-0">
            Đã có video ({proof.thoiLuongGiay || 20}s)
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 shrink-0">
            Chưa có video
          </span>
        )}
      </div>

      {isUploaded ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-64 flex items-center justify-center">
            <video src={mediaUrl} controls className="w-full h-full max-h-64" />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 pt-1">
            <span>Thời lượng: <strong className="font-semibold">{proof.thoiLuongGiay || "15-30"}s</strong> · Người quay: {proof.tenNguoiTao || "Nhân viên"}</span>
            {!readOnly && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(proof.id, "video đóng gói")}
                disabled={deleting}
                className="gap-1.5 h-7 text-xs"
              >
                {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Xóa & quay lại
              </Button>
            )}
          </div>
        </div>
      ) : isRecording ? (
        /* Giao diện đang quay trực tiếp */
        <div className="mt-3 flex flex-col items-center justify-center rounded-lg border border-red-300 bg-black p-4 text-white">
          <div className="relative w-full max-w-md aspect-video bg-slate-900 rounded-lg overflow-hidden mb-3">
            <video ref={liveVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded text-xs font-mono font-bold text-red-400">
              <span className="size-2 rounded-full bg-red-500 animate-ping" />
              ĐANG QUAY: {seconds}s / 30s
            </div>
            {seconds < 15 ? (
              <div className="absolute bottom-2 inset-x-2 text-center bg-black/70 text-[11px] text-amber-300 py-1 rounded">
                Cần quay tối thiểu 15 giây (còn {15 - seconds}s nữa mới được dừng)
              </div>
            ) : (
              <div className="absolute bottom-2 inset-x-2 text-center bg-emerald-950/80 text-[11px] text-emerald-300 py-1 rounded font-medium">
                ✓ Thời lượng hợp lệ! Bạn có thể bấm 'Dừng & Lưu' bất kỳ lúc nào (tối đa 30s)
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              disabled={seconds < 15}
              className="gap-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Square className="size-3.5 fill-current" /> Dừng & Lưu ({seconds}s)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelRecording}
              className="text-xs text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        /* Giao diện nút bắt đầu quay hoặc tải tệp */
        <div className="mt-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <Video className="size-10 text-slate-400 mb-2" />
          <p className="text-xs text-slate-600 font-medium mb-1">Quay video ngắn (15-30 giây) hoặc tải tệp từ thiết bị</p>
          <p className="text-[11px] text-slate-400 mb-4">Hỗ trợ MP4, WebM, MOV · Tối đa 100MB</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={startRecording}
              disabled={uploading || readOnly}
              className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              <Camera className="size-3.5" /> Bắt đầu quay video
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || readOnly}
              className="gap-1.5 text-xs border-slate-300"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Tải video từ máy
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVideoFileChange}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />
    </div>
  );
}
