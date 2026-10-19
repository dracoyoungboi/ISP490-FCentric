import { useState } from "react";
import { AlertCircle, CircleCheck, CirclePause, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { capNhatTrangThaiKhachHang } from "@/services/khachHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { TRANG_THAI_KHACH, laHoatDong } from "./tinhKhachHang";

/**
 * Xác nhận Ngừng hoạt động / Cho phép hoạt động lại một khách hàng — nói rõ hệ quả trước khi đổi
 * (cùng kiểu hộp thoại của nhà cung cấp). `soDonDangXuLy`: số đơn chưa kết thúc người xem thấy được,
 * `undefined` khi chưa biết thì nói chung. `onChanged(khachHang)` nhận khách hàng sau khi đổi.
 */
export default function TrangThaiKhachHangDialog({ khachHang, open, onOpenChange, onChanged, soDonDangXuLy }) {
  const [phien, setPhien] = useState(0);
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setPhien((n) => n + 1);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {khachHang ? (
        <NoiDung
          key={phien}
          khachHang={khachHang}
          onClose={() => onOpenChange(false)}
          onChanged={onChanged}
          soDonDangXuLy={soDonDangXuLy}
        />
      ) : null}
    </AlertDialog>
  );
}

function NoiDung({ khachHang: khachLucMo, onClose, onChanged, soDonDangXuLy }) {
  // Giữ nguyên nội dung lúc mở: đổi xong trang cha cập nhật trạng thái ngay, nhưng hộp thoại
  // đang chạy hiệu ứng đóng không được lật sang câu ngược lại.
  const [khachHang] = useState(khachLucMo);
  const dangHoatDong = laHoatDong(khachHang);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");

  const xacNhan = async () => {
    const trangThaiMoi = dangHoatDong ? TRANG_THAI_KHACH.NGUNG_HOAT_DONG : TRANG_THAI_KHACH.HOAT_DONG;
    setDangLuu(true);
    setLoi("");
    try {
      const moi = await capNhatTrangThaiKhachHang(khachHang.id, trangThaiMoi);
      onChanged?.(moi ?? { ...khachHang, trangThai: trangThaiMoi });
      onClose();
    } catch (err) {
      setLoi(getApiErrorMessage(err, "Không thể đổi trạng thái khách hàng. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  const ten = (
    <span className="font-semibold text-bo-foreground">
      {khachHang.tenKhachHang}
      {khachHang.maKhachHang ? <span className="font-mono font-normal text-bo-muted"> ({khachHang.maKhachHang})</span> : null}
    </span>
  );
  const soDon = Number(soDonDangXuLy) || 0;

  return (
    <AlertDialogContent
      className="border-bo-border bg-white sm:max-w-md"
      onEscapeKeyDown={(event) => {
        if (dangLuu) event.preventDefault();
      }}
    >
      <AlertDialogHeader className="text-left">
        <AlertDialogTitle className="flex items-center gap-2 text-base text-bo-foreground">
          {dangHoatDong ? (
            <CirclePause className="size-5 shrink-0 text-bo-warning" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-5 shrink-0 text-bo-success" aria-hidden="true" />
          )}
          {dangHoatDong ? "Ngừng hoạt động khách hàng?" : "Cho phép khách hàng hoạt động lại?"}
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2 text-sm leading-6 text-bo-muted">
            {dangHoatDong ? (
              <>
                <p>{ten} sẽ không chọn được khi tạo báo giá mới và khi bán tại quầy.</p>
                <ul className="list-disc space-y-1 pl-5">
                  {soDonDangXuLy === undefined ? (
                    <li>Đơn đang xử lý của khách vẫn nhặt hàng, giao hàng bình thường.</li>
                  ) : soDon > 0 ? (
                    <li>
                      Đang có <span className="font-semibold text-bo-foreground">{soDon} đơn chưa hoàn thành</span>: vẫn
                      nhặt hàng, giao hàng bình thường.
                    </li>
                  ) : null}
                  <li>Thông tin và lịch sử mua hàng giữ nguyên; có thể cho phép hoạt động lại bất cứ lúc nào.</li>
                </ul>
              </>
            ) : (
              <p>{ten} sẽ chọn lại được khi tạo báo giá và bán tại quầy.</p>
            )}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      {loi ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{loi}</span>
        </div>
      ) : null}

      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel
          disabled={dangLuu}
          className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          Hủy
        </AlertDialogCancel>
        <Button
          type="button"
          onClick={xacNhan}
          disabled={dangLuu}
          className={
            dangHoatDong
              ? "min-w-[150px] bg-bo-warning text-white hover:bg-bo-warning/90"
              : "min-w-[150px] bg-bo-success text-white hover:bg-bo-success/90"
          }
        >
          {dangLuu ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang lưu...
            </>
          ) : dangHoatDong ? (
            "Ngừng hoạt động"
          ) : (
            "Cho phép hoạt động"
          )}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
