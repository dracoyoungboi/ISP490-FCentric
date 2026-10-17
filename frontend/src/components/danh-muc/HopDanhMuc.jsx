import { useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { GIOI_HAN, goiYMaMoi, kiemTraForm, kiemTraPhanHoi, layDuongDan, taoBodyCapNhat } from "./cayDanhMuc";

const O_NHAP =
  "border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";

/**
 * Popup Thêm / Sửa danh mục (cùng kiểu popup Nhà cung cấp PA1).
 * - Thêm: `cheDo="them"`, `chaId` là danh mục cha (null = danh mục gốc). Mã gợi ý sẵn, sửa được.
 * - Sửa: `cheDo="sua"`, `nut` là danh mục đang sửa. Mã không đổi được (máy chủ không nhận đổi mã).
 * Trạng thái không nằm trong form: đổi bằng "Ngừng hoạt động" / "Cho hoạt động lại" trong menu ⋯.
 * Danh mục cha đổi bằng "Chuyển đến…".
 * `nut` là bản mới nhất trong cây của trang: body gửi đi dựng từ bản này lúc bấm lưu (không dùng bản cũ lúc mở).
 * `onDaLuu({ cheDo, ten, body, duLieu })` gọi sau khi máy chủ lưu xong (`duLieu`: danh mục máy chủ trả về).
 */
export default function HopDanhMuc({ open, onOpenChange, cheDo, nut, chaId, cay, onDaLuu }) {
  const [phien, setPhien] = useState(0);
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setPhien((so) => so + 1);
  }

  return (
    <Dialog open={open && (cheDo !== "sua" || Boolean(nut))} onOpenChange={onOpenChange}>
      {open && (cheDo !== "sua" || nut) ? (
        <NoiDung
          key={phien}
          cheDo={cheDo}
          nut={nut}
          chaId={cheDo === "sua" ? nut?.chaId ?? null : chaId ?? null}
          cay={cay}
          onDong={() => onOpenChange(false)}
          onDaLuu={onDaLuu}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ cheDo, nut, chaId, cay, onDong, onDaLuu }) {
  const laSua = cheDo === "sua";
  const [ma, setMa] = useState(() => (laSua ? nut.ma : goiYMaMoi(cay)));
  const [ten, setTen] = useState(() => (laSua ? nut.ten : ""));
  const [moTa, setMoTa] = useState(() => (laSua ? nut.moTa ?? "" : ""));
  const [loi, setLoi] = useState({});
  const [loiMayChu, setLoiMayChu] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const oTen = useRef(null);
  const oMa = useRef(null);

  const duongDanCha = chaId != null ? layDuongDan(cay, chaId).map((n) => n.ten) : [];
  const tieuDe = laSua ? "Sửa danh mục" : "Thêm danh mục";
  const kiemTra = kiemTraForm(cay, { ma, ten, chaId, idDangSua: laSua ? nut.id : null });

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuu) return;
    if (!kiemTra.hopLe) {
      setLoi(kiemTra.loi);
      (kiemTra.loi.ma ? oMa : oTen).current?.focus();
      return;
    }
    setDangLuu(true);
    setLoiMayChu("");
    try {
      const body = laSua
        ? taoBodyCapNhat(nut, { ten: ten.trim(), moTa: moTa.trim() })
        : { maDanhMuc: ma.trim(), tenDanhMuc: ten.trim(), moTa: moTa.trim(), trangThai: 1, danhMucChaId: chaId ?? null };
      const phanHoi = kiemTraPhanHoi(laSua ? await danhMucQuanAoService.update(body) : await danhMucQuanAoService.create(body));
      onDaLuu?.({ cheDo, ten: ten.trim(), body, duLieu: phanHoi.data.data });
      onDong();
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, laSua ? "Không lưu được danh mục. Vui lòng thử lại." : "Không thêm được danh mục. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  return (
    <DialogContent
      showCloseButton={!dangLuu}
      className="border-bo-border bg-white p-0 text-bo-foreground sm:max-w-lg"
      onEscapeKeyDown={(event) => { if (dangLuu) event.preventDefault(); }}
      onInteractOutside={(event) => { if (dangLuu) event.preventDefault(); }}
    >
      <form onSubmit={luu} noValidate>
        <DialogHeader className="border-b border-bo-border px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold text-bo-foreground">{tieuDe}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-bo-muted">
            {duongDanCha.length ? `Nằm trong: ${duongDanCha.join(" › ")}` : "Danh mục gốc (cấp 1)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="dm-ma">
                Mã danh mục {laSua ? null : <span className="text-bo-danger">*</span>}
              </Label>
              {laSua ? (
                <Input
                  id="dm-ma"
                  value={nut.ma || "—"}
                  readOnly
                  aria-describedby="dm-ma-goi-y"
                  className="border-bo-border bg-bo-surface-subtle font-mono text-bo-muted focus-visible:ring-0"
                />
              ) : (
                <Input
                  id="dm-ma"
                  ref={oMa}
                  value={ma}
                  maxLength={GIOI_HAN.MA}
                  onChange={(e) => { setMa(e.target.value); setLoi((cu) => ({ ...cu, ma: undefined })); }}
                  aria-invalid={loi.ma ? true : undefined}
                  aria-describedby={loi.ma ? "dm-ma-loi" : "dm-ma-goi-y"}
                  disabled={dangLuu}
                  className={O_NHAP}
                />
              )}
              {loi.ma ? (
                <p id="dm-ma-loi" className="text-xs text-bo-danger">{loi.ma}</p>
              ) : (
                <p id="dm-ma-goi-y" className="text-xs text-bo-muted">
                  {laSua ? "Mã không đổi được sau khi tạo." : "Gợi ý theo mã đang dùng, sửa được."}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dm-ten">
                Tên danh mục <span className="text-bo-danger">*</span>
              </Label>
              <Input
                id="dm-ten"
                ref={oTen}
                autoFocus
                value={ten}
                maxLength={GIOI_HAN.TEN}
                placeholder="VD: Áo thun"
                onChange={(e) => { setTen(e.target.value); setLoi((cu) => ({ ...cu, ten: undefined })); }}
                aria-invalid={loi.ten ? true : undefined}
                aria-describedby={loi.ten ? "dm-ten-loi" : kiemTra.trungTen ? "dm-ten-trung" : undefined}
                disabled={dangLuu}
                className={O_NHAP}
              />
              {loi.ten ? (
                <p id="dm-ten-loi" className="text-xs text-bo-danger">{loi.ten}</p>
              ) : kiemTra.trungTen ? (
                <p id="dm-ten-trung" className="text-xs text-bo-warning">
                  Đã có danh mục cùng tên trong {duongDanCha.length ? `“${duongDanCha[duongDanCha.length - 1]}”` : "danh mục gốc"}.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dm-mo-ta">Mô tả</Label>
            <Textarea
              id="dm-mo-ta"
              rows={3}
              value={moTa}
              placeholder="Không bắt buộc"
              onChange={(e) => setMoTa(e.target.value)}
              disabled={dangLuu}
              className={`${O_NHAP} min-h-20 resize-none`}
            />
          </div>

          {laSua ? (
            <p className="text-xs leading-5 text-bo-muted">
              Muốn đổi danh mục cha, dùng “Chuyển đến…” trong menu ⋯ của dòng.
            </p>
          ) : null}

          {loiMayChu ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{loiMayChu}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDong}
            disabled={dangLuu}
            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Hủy
          </Button>
          <Button type="submit" disabled={dangLuu} className="min-w-[132px] bg-bo-primary text-white hover:bg-bo-primary-hover">
            {dangLuu ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Đang lưu...
              </>
            ) : laSua ? "Lưu thay đổi" : "Thêm danh mục"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
