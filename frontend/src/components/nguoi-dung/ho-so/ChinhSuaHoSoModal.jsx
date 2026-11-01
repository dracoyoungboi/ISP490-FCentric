import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import { PHONE_ERROR_MESSAGE, getPhoneError, isPhoneValid, sanitizePhoneInput } from "@/utils/phoneValidation";
import { LOI_HO_TEN_DAI, LOI_HO_TEN_KY_TU, chuanHoaHoTen, loiHoTen } from "@/validations/hoTen";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

const O_NHAP =
  "h-9 w-full border-bo-input-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";
const NHAN = "mb-1.5 block text-[13px] font-medium leading-[18px] text-slate-700";

const chuan = (v) => (v ?? "").trim();

/**
 * Hộp "Chỉnh sửa hồ sơ" (SRS 1.2.1): chỉ sửa họ tên và số điện thoại; tên đăng nhập và email không đổi được
 * (máy chủ cũng chặn). Nút "Lưu thông tin" chỉ bật khi có thay đổi và dữ liệu hợp lệ. Đang lưu thì không đóng được.
 * `oDauTien`: "ho-ten" | "so-dien-thoai" — ô nhận con trỏ khi mở (bấm "+ Thêm số điện thoại" thì vào ô số).
 */
export default function ChinhSuaHoSoModal({ open, onOpenChange, hoSo, oDauTien = "ho-ten", onSaved }) {
  const [nhap, setNhap] = useState({ hoTen: "", soDienThoai: "" });
  const [loiTen, setLoiTen] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const [daRoiSdt, setDaRoiSdt] = useState(false);

  // Mở lại hộp thì nạp giá trị đang lưu (pattern "adjust state during render", như ChangePasswordModal)
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) {
      setNhap({ hoTen: hoSo?.hoTen || "", soDienThoai: hoSo?.soDienThoai || "" });
      setLoiTen("");
      setDaRoiSdt(false);
      setDangLuu(false);
    }
  }

  const loiSdt = getPhoneError(nhap.soDienThoai);
  const hoTenMoi = chuanHoaHoTen(nhap.hoTen);
  // Giữ nguyên họ tên đang lưu thì không kiểm lại (như máy chủ): tên tạo trước khi có luật vẫn sửa được số điện thoại
  const giuHoTen = Boolean(hoTenMoi) && hoTenMoi === chuanHoaHoTen(hoSo?.hoTen);
  const loiHoTenDayDu = giuHoTen ? "" : loiHoTen(nhap.hoTen);
  // Gõ ký tự không cho phép hoặc quá dài thì báo ngay; trống, quá ngắn chỉ báo khi rời ô (đang gõ dở)
  const loiTenHien =
    loiTen || ([LOI_HO_TEN_KY_TU, LOI_HO_TEN_DAI].includes(loiHoTenDayDu) ? loiHoTenDayDu : "");
  const coThayDoi = !giuHoTen || chuan(nhap.soDienThoai) !== chuan(hoSo?.soDienThoai);
  const hopLe = !loiHoTenDayDu && isPhoneValid(nhap.soDienThoai);

  const dong = (mo) => {
    if (!mo && dangLuu) return;
    onOpenChange(mo);
  };

  const luu = async (e) => {
    e.preventDefault();
    if (dangLuu || !coThayDoi) return;
    if (loiHoTenDayDu) {
      setLoiTen(loiHoTenDayDu);
      return;
    }
    if (!isPhoneValid(nhap.soDienThoai)) return;
    setDangLuu(true);
    try {
      const res = await nguoiDungService.updateMe({
        hoTen: hoTenMoi,
        soDienThoai: chuan(nhap.soDienThoai) || null,
      });
      if (!res?.data) throw new Error("Không đọc được dữ liệu trả về");
      onSaved?.(res.data);
      toast.success("Đã cập nhật hồ sơ.");
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không cập nhật được hồ sơ. Vui lòng thử lại."));
    } finally {
      setDangLuu(false);
    }
  };

  // Số chưa đủ 10 chữ số chưa báo lỗi khi đang gõ; rời ô mà vẫn sai thì báo
  const loiSdtHien = loiSdt || (daRoiSdt && !isPhoneValid(nhap.soDienThoai) ? PHONE_ERROR_MESSAGE : "");

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent
        className="bg-bo-surface text-bo-foreground sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(oDauTien)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          <DialogDescription className="text-bo-muted">Email và tên đăng nhập không đổi được.</DialogDescription>
        </DialogHeader>

        <form id="form-chinh-sua-ho-so" onSubmit={luu} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="ho-ten" className={NHAN}>
              Họ và tên
            </label>
            <Input
              id="ho-ten"
              value={nhap.hoTen}
              // Không đặt maxLength: trình duyệt đếm theo đơn vị UTF-16 trước chuẩn hóa nên cắt mất chữ khi dán tên có dấu
              // viết tách; quá 100 ký tự thì báo ngay dưới ô
              autoComplete="name"
              disabled={dangLuu}
              aria-invalid={Boolean(loiTenHien)}
              aria-describedby={loiTenHien ? "ho-ten-loi" : undefined}
              onChange={(e) => {
                setNhap((cu) => ({ ...cu, hoTen: e.target.value }));
                setLoiTen("");
              }}
              onBlur={() => setLoiTen(loiHoTenDayDu)}
              className={cn(O_NHAP, loiTenHien && "border-bo-danger")}
            />
            {loiTenHien ? (
              <p id="ho-ten-loi" className="mt-1 text-xs text-bo-danger">
                {loiTenHien}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="so-dien-thoai" className={NHAN}>
              Số điện thoại
            </label>
            <Input
              id="so-dien-thoai"
              value={nhap.soDienThoai}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="VD: 0901234567"
              disabled={dangLuu}
              aria-invalid={Boolean(loiSdtHien)}
              aria-describedby="so-dien-thoai-goi-y"
              // Không đặt maxLength: dán "0987 654 321" hay "0987-654-321" (hơn 10 ký tự) vẫn giữ đủ 10 chữ số sau khi lọc
              onChange={(e) => {
                setNhap((cu) => ({ ...cu, soDienThoai: sanitizePhoneInput(e.target.value) }));
                setDaRoiSdt(false);
              }}
              onBlur={() => setDaRoiSdt(true)}
              className={cn(O_NHAP, "tabular-nums", loiSdtHien && "border-bo-danger")}
            />
            <p id="so-dien-thoai-goi-y" className={cn("mt-1 text-xs", loiSdtHien ? "text-bo-danger" : "text-bo-muted")}>
              {loiSdtHien || "Cũng dùng để đăng nhập. Để trống nếu không muốn lưu."}
            </p>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={dangLuu}
            onClick={() => onOpenChange(false)}
            className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="form-chinh-sua-ho-so"
            disabled={dangLuu || !coThayDoi || !hopLe}
            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {dangLuu ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
