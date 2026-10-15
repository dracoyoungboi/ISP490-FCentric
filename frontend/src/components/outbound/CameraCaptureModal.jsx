import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, RefreshCw, Check, X, AlertCircle, SwitchCamera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CameraCaptureModal: Pop-up chụp hình trực tiếp từ Camera/Webcam trình duyệt bằng WebRTC
 * Hỗ trợ xin quyền camera, chuyển đổi camera trước/sau, chụp ảnh độ phân giải cao và xem lại trước khi gửi.
 */
export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = "Chụp ảnh bằng chứng",
  description = "Căn chỉnh hàng hóa hoặc kiện hàng trong khung hình và bấm nút chụp",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // Mặc định camera sau / môi trường
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Dừng toàn bộ tracks của camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Khởi động Camera Stream
  const startCamera = useCallback(async (mode = facingMode) => {
    stopStream();
    setLoading(true);
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Trình duyệt của bạn không hỗ trợ tính năng mở Camera trực tiếp. Vui lòng sử dụng tính năng Chọn tệp ảnh.");
      setLoading(false);
      return;
    }

    try {
      // Kiểm tra xem thiết bị có nhiều camera không
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (_) {}

      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setLoading(false);
    } catch (err) {
      stopStream();
      setLoading(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("PERMISSION_DENIED");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("NO_CAMERA_FOUND");
      } else {
        setError(err.message || "Không thể khởi động thiết bị Camera");
      }
    }
  }, [facingMode, stopStream]);

  // Quản lý mở / đóng modal
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setPreviewUrl(null);
      startCamera(facingMode);
    } else {
      stopStream();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setCapturedBlob(null);
    }

    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [isOpen, startCamera, facingMode, stopStream]);

  // Phím Esc đóng modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    stopStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    onClose?.();
  };

  // Đổi camera trước / sau
  const handleToggleCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Bấm chụp hình (Snap)
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Nếu là camera trước, lật ảnh theo chiều ngang cho tự nhiên
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    // Dừng camera stream ngay sau khi chụp để tắt đèn webcam
    stopStream();

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      },
      "image/jpeg",
      0.92
    );
  };

  // Chụp lại (Retake)
  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCapturedBlob(null);
    startCamera(facingMode);
  };

  // Xác nhận sử dụng ảnh (Confirm)
  const handleConfirm = () => {
    if (!capturedBlob) return;
    const filename = `proof_camera_${Date.now()}.jpg`;
    const file = new File([capturedBlob], filename, { type: "image/jpeg" });
    onCapture?.(file);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Camera className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold leading-tight">{title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Viewfinder / Review Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px] sm:min-h-[420px] overflow-hidden">
          {/* TRƯỜNG HỢP 1: ĐÃ CHỤP XONG - XEM LẠI ẢNH */}
          {previewUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-2">
              <img
                src={previewUrl}
                alt="Ảnh vừa chụp"
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
              />
              <div className="absolute top-4 left-4 bg-emerald-600/90 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow flex items-center gap-1.5">
                <Check className="size-3.5" /> Ảnh đã chụp xong - Vui lòng kiểm tra
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: ĐANG BẬT LIVE CAMERA */
            <>
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-slate-300 z-10">
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                  <p className="text-xs sm:text-sm">Đang kết nối thiết bị Camera...</p>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 z-10">
                  <div className="size-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                    <AlertCircle className="size-6" />
                  </div>
                  {error === "PERMISSION_DENIED" ? (
                    <div className="max-w-md space-y-2">
                      <h4 className="text-sm font-semibold text-white">Trình duyệt chưa được cấp quyền Camera</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Vui lòng bấm vào biểu tượng <strong className="text-white">Ổ khóa</strong> hoặc <strong className="text-white">Máy ảnh</strong> trên thanh địa chỉ URL trình duyệt, chọn <strong className="text-emerald-400">Cho phép (Allow)</strong> Camera, sau đó bấm nút Thử lại bên dưới.
                      </p>
                    </div>
                  ) : error === "NO_CAMERA_FOUND" ? (
                    <div className="max-w-md space-y-2">
                      <h4 className="text-sm font-semibold text-white">Không tìm thấy thiết bị Camera (Webcam)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Không phát hiện webcam trên máy tính của bạn. Vui lòng kiểm tra cáp cắm webcam hoặc sử dụng nút <strong className="text-white">&quot;Chọn tệp ảnh&quot;</strong> từ máy tính.
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-md space-y-2">
                      <h4 className="text-sm font-semibold text-white">Lỗi Camera</h4>
                      <p className="text-xs text-slate-400">{error}</p>
                    </div>
                  )}

                  <div className="mt-5 flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => startCamera(facingMode)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      <RefreshCw className="size-3.5" /> Thử lại
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              )}

              {/* Thẻ Video Live Preview */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlays (Viền căn chỉnh ảnh) */}
              {!loading && !error && (
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="size-8 border-t-2 border-l-2 border-emerald-400/80 rounded-tl-lg" />
                    <div className="size-8 border-t-2 border-r-2 border-emerald-400/80 rounded-tr-lg" />
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="size-8 border-b-2 border-l-2 border-emerald-400/80 rounded-bl-lg" />
                    <div className="size-8 border-b-2 border-r-2 border-emerald-400/80 rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Nút chuyển đổi Camera Trước / Sau */}
              {!loading && !error && hasMultipleCameras && (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="absolute top-4 right-4 z-20 size-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center border border-slate-700 shadow backdrop-blur transition-transform active:scale-95"
                  title="Chuyển đổi Camera"
                >
                  <SwitchCamera className="size-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          {previewUrl ? (
            /* Controls khi đang xem lại ảnh */
            <div className="w-full flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5 h-9"
              >
                <RefreshCw className="size-3.5" /> Chụp lại
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5 h-9 px-5"
              >
                <Check className="size-4" /> Sử dụng ảnh này
              </Button>
            </div>
          ) : (
            /* Controls khi đang ngắm chụp */
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Hủy bỏ
              </button>

              {/* Nút Shutter tròn lớn ở trung tâm */}
              <button
                type="button"
                onClick={handleSnap}
                disabled={loading || Boolean(error)}
                className="group relative flex size-14 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                title="Bấm để chụp ảnh"
              >
                <span className="size-10 rounded-full bg-white transition-transform group-hover:scale-90" />
              </button>

              <div className="w-12 text-right">
                <span className="text-[11px] text-slate-500 font-mono">LIVE</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

