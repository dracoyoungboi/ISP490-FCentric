import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { INPUT_CLASS } from "@/components/channel/SettingsCard";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { ngayIso } from "./ngay";

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");
// Mã lỗi máy chủ (KH mục C.4) cho biết gian hàng không còn gọi được: trang cần đọc lại kết nối
const MA_MAT_KET_NOI = ["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI"];

/**
 * Lấy đơn thủ công từ sàn theo khoảng ngày (tối đa 50 đơn mỗi lần, đơn đã có không tạo lại).
 * `onXong(ketQua)` được gọi khi lấy xong; `baoToast = false` khi trang tự hiện kết quả.
 * `onMatKetNoi(error)`: lỗi vì ủy quyền hết hạn hoặc kênh chưa kết nối (lỗi vẫn hiện trong hộp thoại).
 */
export default function LayDonDialog({ maKenh, tenSan, onClose, onXong, onMatKetNoi, baoToast = true }) {
  const [tu, setTu] = useState(() => ngayIso(1));
  const [den, setDen] = useState(() => ngayIso(0));
  const [loi, setLoi] = useState("");
  const [dangLay, setDangLay] = useState(false);
  const dangLayRef = useRef(false);
  const homNay = ngayIso(0);

  const layDon = async (event) => {
    event.preventDefault();
    if (dangLayRef.current) return;
    if (!tu || !den) return setLoi("Chọn đủ hai ngày.");
    if (tu > den) return setLoi("Từ ngày phải trước hoặc bằng đến ngày.");
    if (den > homNay) return setLoi("Đến ngày không được sau hôm nay.");
    setLoi("");
    dangLayRef.current = true;
    setDangLay(true);
    try {
      const denLuc = den === homNay ? new Date() : new Date(`${den}T23:59:59`);
      const res = await kenhBanHangService.layDon(maKenh, {
        tu: new Date(`${tu}T00:00:00`).toISOString(),
        den: denLuc.toISOString(),
      });
      if (baoToast) toast.success(`Đã lấy ${soVN(res?.soDonMoi)} đơn mới từ ${tenSan}`);
      onXong(res);
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Không lấy được đơn hàng"));
      if (MA_MAT_KET_NOI.includes(getApiErrorCode(error))) onMatKetNoi?.(error);
    } finally {
      dangLayRef.current = false;
      setDangLay(false);
    }
  };

  return (
    <Dialog open onOpenChange={(mo) => !mo && !dangLayRef.current && onClose()}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Lấy đơn từ {tenSan}</DialogTitle>
          <DialogDescription className="text-bo-muted">
            Lấy các đơn tạo mới hoặc cập nhật trong khoảng ngày đã chọn, tối đa 50 đơn mỗi lần. Đơn đã có trong FCentric
            không bị tạo lại.
          </DialogDescription>
        </DialogHeader>
        <form id="lay-don-form" onSubmit={layDon} className="grid gap-4 sm:grid-cols-2" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-bo-foreground">Từ ngày</span>
            <input type="date" value={tu} max={homNay} onChange={(e) => setTu(e.target.value)} disabled={dangLay} className={INPUT_CLASS} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-bo-foreground">Đến ngày</span>
            <input type="date" value={den} max={homNay} onChange={(e) => setDen(e.target.value)} disabled={dangLay} className={INPUT_CLASS} />
          </label>
          {loi ? (
            <p role="alert" className="text-sm text-bo-danger sm:col-span-2">
              {loi}
            </p>
          ) : null}
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={dangLay} onClick={onClose} className={NUT_PHU}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="lay-don-form" disabled={dangLay} className={NUT_CHINH}>
            {dangLay ? <Loader2 className="size-4 animate-spin" /> : null}
            {dangLay ? "Đang lấy…" : "Lấy đơn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
