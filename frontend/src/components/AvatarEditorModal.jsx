import { getApiErrorMessage } from "@/utils/apiError";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Upload, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UserAvatar from "@/components/UserAvatar";
import { nguoiDungService } from "@/services/nguoiDungService";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Tệp gốc được chọn tới 15 MB (ảnh chụp điện thoại thường 3–8 MB): ảnh được cắt và thu về 512×512 JPEG trước khi
// tải lên, nên tệp gửi đi luôn nhỏ hơn nhiều so với giới hạn 2 MB của backend.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const CROP_BOX = 280; // cạnh khung cắt (px)
const OUTPUT_SIZE = 512; // cạnh ảnh lưu (px)
const ZOOM_MAX = 3;
const PREVIEW_SIZES = [56, 32]; // cỡ thật: ảnh ở đầu trang Hồ sơ và ở thanh trên cùng

/** Kích thước ảnh trong khung cắt theo mức phóng, và giới hạn kéo để ảnh luôn phủ kín khung. */
function khungCat(anh, zoom) {
  const scale = Math.max(CROP_BOX / anh.w, CROP_BOX / anh.h) * zoom;
  const w = anh.w * scale;
  const h = anh.h * scale;
  return { scale, w, h, maxX: Math.max(0, (w - CROP_BOX) / 2), maxY: Math.max(0, (h - CROP_BOX) / 2) };
}

const kep = (v, min, max) => Math.min(max, Math.max(min, v));

function viTriHopLe(anh, zoom, x, y) {
  const k = khungCat(anh, zoom);
  return { x: kep(x, -k.maxX, k.maxX), y: kep(y, -k.maxY, k.maxY) };
}

/** Cắt vùng đang thấy trong khung và xuất JPEG vuông OUTPUT_SIZE. */
function xuatAnhCat(anh, zoom, viTri) {
  const k = khungCat(anh, zoom);
  const left = (CROP_BOX - k.w) / 2 + viTri.x;
  const top = (CROP_BOX - k.h) / 2 + viTri.y;
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // ảnh PNG trong suốt: nền trắng thay vì đen khi đổi sang JPEG
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(anh.img, -left / k.scale, -top / k.scale, CROP_BOX / k.scale, CROP_BOX / k.scale, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], "anh-dai-dien.jpg", { type: "image/jpeg" })) : reject(new Error(t("Không xử lý được ảnh")))),
      "image/jpeg",
      0.9,
    );
  });
}

/** Ảnh trong một khung tròn/vuông cỡ `size`, cùng vị trí và mức phóng với khung cắt (dùng cho xem trước). */
function AnhTheoKhung({ anh, zoom, viTri, size, className }) {
  const k = khungCat(anh, zoom);
  const r = size / CROP_BOX;
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)} style={{ width: size, height: size }}>
      <img
        src={anh.url}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          left: ((CROP_BOX - k.w) / 2 + viTri.x) * r,
          top: ((CROP_BOX - k.h) / 2 + viTri.y) * r,
          width: k.w * r,
          height: k.h * r,
        }}
      />
    </span>
  );
}

// Hộp thoại đổi ảnh đại diện của người đang đăng nhập.
// Bước 1: chọn hoặc kéo thả ảnh (hoặc gỡ ảnh hiện tại). Bước 2: cắt vuông — kéo để chỉnh vị trí (hoặc phím mũi tên),
// thanh trượt / phím +, - để phóng to, xem trước ở cỡ thật. Mọi thay đổi chỉ là bản nháp trong hộp thoại;
// chỉ "Lưu ảnh" mới gọi API (upload ảnh đã cắt hoặc xóa). Hủy / Escape / đóng hộp vứt bản nháp; lỗi giữ bản nháp để thử lại.
export default function AvatarEditorModal({
  open,
  onOpenChange,
  userId,
  userName,
  avatarUrl,
  onSaved,
}) {
  const [anh, setAnh] = useState(null); // { url, img, w, h } của tệp đang cắt
  const [zoom, setZoom] = useState(1);
  const [viTri, setViTri] = useState({ x: 0, y: 0 });
  const [draftRemove, setDraftRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [keoVao, setKeoVao] = useState(false);
  const keoRef = useRef(null);
  const lanChonRef = useRef(0);

  // Reset bản nháp mỗi lần mở / đóng hộp thoại (pattern "adjust state during render")
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setAnh(null);
    setZoom(1);
    setViTri({ x: 0, y: 0 });
    setDraftRemove(false);
    setSaving(false);
    setErrorMsg("");
    setKeoVao(false);
  }

  // Thu hồi object URL khi bị thay thế, khi đóng hoặc unmount
  useEffect(
    () => () => {
      if (anh?.url) URL.revokeObjectURL(anh.url);
    },
    [anh]
  );

  const nhanTep = (file) => {
    setKeoVao(false);
    if (!file) return;
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg(t("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP"));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setErrorMsg(t("Ảnh lớn hơn 15 MB. Vui lòng chọn ảnh khác"));
      return;
    }
    const lan = ++lanChonRef.current;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Người dùng đã chọn ảnh khác hoặc đóng hộp trong lúc ảnh này đang đọc: bỏ
      if (lan !== lanChonRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setErrorMsg("");
      setDraftRemove(false);
      setZoom(1);
      setViTri({ x: 0, y: 0 });
      setAnh({ url, img, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (lan === lanChonRef.current) setErrorMsg(t("Không đọc được ảnh này. Vui lòng chọn ảnh khác"));
    };
    img.src = url;
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    nhanTep(file);
  };

  const doiZoom = (z) => {
    if (!anh) return;
    const moi = kep(z, 1, ZOOM_MAX);
    setZoom(moi);
    setViTri((cu) => viTriHopLe(anh, moi, cu.x, cu.y));
  };
  const dichChuyen = (x, y) => {
    if (anh) setViTri(viTriHopLe(anh, zoom, x, y));
  };

  const batDauKeo = (e) => {
    if (!anh || saving) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    keoRef.current = { px: e.clientX, py: e.clientY, x: viTri.x, y: viTri.y };
  };
  const dangKeo = (e) => {
    const k = keoRef.current;
    if (k) dichChuyen(k.x + e.clientX - k.px, k.y + e.clientY - k.py);
  };
  const thaKeo = () => {
    keoRef.current = null;
  };
  const phimKhungCat = (e) => {
    const buoc = e.shiftKey ? 20 : 5;
    const huong = { ArrowLeft: [-buoc, 0], ArrowRight: [buoc, 0], ArrowUp: [0, -buoc], ArrowDown: [0, buoc] }[e.key];
    if (huong) {
      e.preventDefault();
      dichChuyen(viTri.x + huong[0], viTri.y + huong[1]);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      doiZoom(zoom + 0.1);
    } else if (e.key === "-") {
      e.preventDefault();
      doiZoom(zoom - 0.1);
    }
  };

  const isDirty = draftRemove || anh != null;

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setErrorMsg("");
    try {
      let res;
      if (anh) {
        const file = await xuatAnhCat(anh, zoom, viTri);
        res = await nguoiDungService.uploadAvatar(file);
      } else {
        res = await nguoiDungService.removeAvatar();
      }
      const dto = res?.data; // ResponseData.data
      if (!dto) throw new Error(t("Không đọc được dữ liệu trả về"));
      onSaved?.(dto);
      onOpenChange(false);
    } catch (err) {
      // Giữ hộp thoại + bản nháp để người dùng thử lại
      setErrorMsg(getApiErrorMessage(err, anh ? t("Không thể lưu ảnh đại diện") : t("Không thể gỡ ảnh đại diện")));
    } finally {
      setSaving(false);
    }
  };

  const k = anh ? khungCat(anh, zoom) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(mo) => {
        if (!mo) lanChonRef.current += 1; // ảnh đang đọc dở sẽ bị bỏ
        onOpenChange(mo);
      }}
    >
      <DialogContent
        className="bg-bo-surface text-bo-foreground sm:max-w-[460px]"
        // Chặn đóng hộp thoại khi đang lưu — lỗi sẽ giữ bản nháp để thử lại
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("Ảnh đại diện")}</DialogTitle>
          <DialogDescription className="text-bo-muted">{t("Hiện ở thanh trên cùng, trên phiếu và lịch sử thao tác.")}</DialogDescription>
        </DialogHeader>

        {anh ? (
          <div className="flex flex-col items-center gap-3.5">
            <button
              type="button"
              aria-label={t("Vùng cắt ảnh. Kéo hoặc dùng phím mũi tên để chỉnh vị trí, phím + và - để phóng to, thu nhỏ.")}
              onPointerDown={batDauKeo}
              onPointerMove={dangKeo}
              onPointerUp={thaKeo}
              onPointerCancel={thaKeo}
              onKeyDown={phimKhungCat}
              disabled={saving}
              className="relative block shrink-0 cursor-grab touch-none overflow-hidden rounded-xl bg-bo-sidebar outline-none focus-visible:ring-2 focus-visible:ring-bo-primary focus-visible:ring-offset-2 active:cursor-grabbing"
              style={{ width: CROP_BOX, height: CROP_BOX }}
            >
              <img
                src={anh.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ left: (CROP_BOX - k.w) / 2 + viTri.x, top: (CROP_BOX - k.h) / 2 + viTri.y, width: k.w, height: k.h }}
              />
              {/* Phủ mờ ngoài vùng tròn + viền tròn: thấy đúng phần sẽ hiện trong ảnh đại diện */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(circle at center, transparent ${CROP_BOX / 2 - 1}px, rgb(11 19 32 / 0.6) ${CROP_BOX / 2}px)` }}
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90" />
            </button>

            <div className="flex w-[280px] items-center gap-2.5">
              <ZoomOut className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
              <label htmlFor="thu-phong-anh" className="sr-only">
                {t("Thu phóng")}
              </label>
              <input
                id="thu-phong-anh"
                type="range"
                min={1}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                disabled={saving}
                onChange={(e) => doiZoom(parseFloat(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-bo-primary"
              />
              <ZoomIn className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
            </div>

            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
              <span className="text-[12.5px] text-bo-muted">{t("Xem trước")}</span>
              <span className="flex items-center gap-3">
                {PREVIEW_SIZES.map((s) => (
                  <AnhTheoKhung key={s} anh={anh} zoom={zoom} viTri={viTri} size={s} className="rounded-full bg-slate-200" />
                ))}
              </span>
              <label className="cursor-pointer rounded text-[13px] font-medium text-bo-primary hover:underline focus-within:ring-2 focus-within:ring-bo-primary/40">
                {t("Chọn ảnh khác")}
                <input type="file" accept={ACCEPTED_TYPES.join(",")} className="sr-only" onChange={handleFileChange} disabled={saving} />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <UserAvatar userId={userId} name={userName} avatarUrl={draftRemove ? null : avatarUrl} size="lg" />
            <label
              onDragOver={(e) => {
                e.preventDefault();
                if (!keoVao) setKeoVao(true);
              }}
              onDragLeave={() => setKeoVao(false)}
              onDrop={(e) => {
                e.preventDefault();
                nhanTep(e.dataTransfer?.files?.[0]);
              }}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-5 text-center text-[13.5px] text-slate-700 transition-colors focus-within:ring-2 focus-within:ring-bo-primary/40",
                keoVao ? "border-bo-primary bg-bo-primary-soft" : "border-slate-300 bg-bo-surface-subtle hover:border-bo-primary hover:bg-bo-primary-soft",
              )}
            >
              <Upload className="size-5 text-bo-primary" aria-hidden="true" />
              <span>
                <b className="font-semibold text-bo-primary">{t("Chọn ảnh từ máy")}</b> {t("hoặc kéo ảnh vào đây")}
              </span>
              <span className="text-xs text-bo-muted">{t("JPEG, PNG hoặc WebP. Ảnh lớn được tự thu nhỏ trước khi tải lên.")}</span>
              <input type="file" accept={ACCEPTED_TYPES.join(",")} className="sr-only" onChange={handleFileChange} disabled={saving} />
            </label>
            {avatarUrl && !draftRemove ? (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setDraftRemove(true);
                }}
                disabled={saving}
                className="rounded text-[13px] font-medium text-bo-muted outline-none hover:text-bo-danger hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40"
              >
                {t("Gỡ ảnh, dùng chữ viết tắt")}
              </button>
            ) : null}
            {draftRemove ? (
              <p className="text-center text-xs text-bo-muted">
                {t("Sau khi lưu, ảnh đại diện sẽ được gỡ và thay bằng chữ viết tắt tên của bạn.")}{" "}
                <button
                  type="button"
                  onClick={() => setDraftRemove(false)}
                  disabled={saving}
                  className="rounded font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                >
                  {t("Hoàn tác")}
                </button>
              </p>
            ) : null}
          </div>
        )}

        {errorMsg && (
          <Alert className="w-full border-bo-danger/30 bg-bo-danger-soft">
            <AlertCircle className="h-4 w-4 text-bo-danger" />
            <AlertDescription className="text-bo-danger">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("Hủy")}
          </Button>
          <Button
            type="button"
            disabled={!isDirty || saving}
            onClick={handleSave}
            className="bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
          >
            {saving ? t("Đang lưu...") : draftRemove ? t("Gỡ ảnh") : t("Lưu ảnh")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
