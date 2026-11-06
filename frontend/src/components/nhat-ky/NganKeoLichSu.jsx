import { useCallback, useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DongThoiGianNhatKy from "@/components/nhat-ky/DongThoiGianNhatKy";
import { getApiErrorStatus } from "@/utils/apiError";

/**
 * Ngăn kéo "Lịch sử thay đổi" của một mục danh mục dữ liệu (sản phẩm, giá bán, danh mục, thuộc tính, nhà cung cấp, kho,
 * vị trí kệ, khách hàng) — cùng kiểu ngăn Lịch sử chỉnh sửa của mẫu in: trượt từ phải, rộng 440px (điện thoại: hết bề
 * ngang). Chỉ gọi máy chủ khi mở; mở lại thì tải lại để thấy thao tác vừa làm.
 * - `tai`: () => Promise<NhatKyDto[]>.
 * - `tieuDe` / `moTa`: vd. "Lịch sử sản phẩm AK2610051".
 * - `nhanDoiTuong`: (dong) => chữ phụ sau tên hành động (vd. SKU của dòng đổi giá), xem DongThoiGianNhatKy.
 */
export default function NganKeoLichSu({ open, onOpenChange, tieuDe = "Lịch sử thay đổi", moTa, tai, nhanDoiTuong }) {
  const [trangThai, setTrangThai] = useState({ dang: "tai", ds: [], loi: null });
  // Trang cha thường đặt đối tượng về null khi đóng: giữ tiêu đề / mô tả của lần mở cuối để lúc ngăn trượt ra không
  // nhảy sang chữ dự phòng
  const [chuCuoi, setChuCuoi] = useState({ tieuDe, moTa });
  if (open && (tieuDe !== chuCuoi.tieuDe || moTa !== chuCuoi.moTa)) setChuCuoi({ tieuDe, moTa });
  const tieuDeHien = open ? tieuDe : chuCuoi.tieuDe;
  const moTaHien = open ? moTa : chuCuoi.moTa;
  // Vừa mở lại (vd. đóng lịch sử kho A rồi mở kho B): về trạng thái đang tải ngay trong lần dựng này, không để khung
  // hình đầu thoáng hiện danh sách cũ trong lúc chờ tải
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setTrangThai({ dang: "tai", ds: [], loi: null });
  }
  const lanTaiRef = useRef(0);
  // Giữ hàm tải mới nhất mà không tải lại mỗi lần trang cha dựng lại (trang cha thường truyền hàm viết tại chỗ)
  const taiRef = useRef(tai);
  useEffect(() => {
    taiRef.current = tai;
  }, [tai]);

  const taiLai = useCallback(async () => {
    const lan = ++lanTaiRef.current;
    setTrangThai({ dang: "tai", ds: [], loi: null });
    try {
      const ds = await taiRef.current();
      if (lan !== lanTaiRef.current) return;
      setTrangThai({ dang: "xong", ds: Array.isArray(ds) ? ds : [], loi: null });
    } catch (loi) {
      if (lan !== lanTaiRef.current) return;
      setTrangThai({ dang: "loi", ds: [], loi });
    }
  }, []);

  useEffect(() => {
    if (!open) {
      lanTaiRef.current += 1;
      return;
    }
    queueMicrotask(() => taiLai());
  }, [open, taiLai]);

  const maLoi = trangThai.loi ? getApiErrorStatus(trangThai.loi) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 bg-bo-surface p-0 sm:max-w-[440px] [&>button:last-child]:hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-bo-border px-5 py-4">
          <div className="min-w-0">
            <SheetTitle className="truncate text-base font-semibold leading-6 text-bo-foreground">{tieuDeHien}</SheetTitle>
            <SheetDescription className="mt-0.5 text-[13px] leading-5 text-bo-muted">
              {moTaHien || "Ai đã làm gì, lúc nào, đổi gì và vì sao. Mới nhất ở trên."}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Đóng lịch sử"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[env(safe-area-inset-bottom)]">
          {trangThai.dang === "tai" ? (
            <LoadingState className="min-h-48" label="Đang tải lịch sử" />
          ) : trangThai.dang === "loi" ? (
            <ErrorState
              className="min-h-48"
              title="Không tải được lịch sử"
              description={
                maLoi === 403
                  ? "Tài khoản của bạn không có quyền xem lịch sử này."
                  : "Không đọc được lịch sử từ máy chủ. Vui lòng thử lại."
              }
              onRetry={maLoi === 403 ? undefined : taiLai}
            />
          ) : trangThai.ds.length === 0 ? (
            <EmptyState
              className="min-h-48"
              icon={History}
              title="Chưa có lịch sử"
              description="Các thao tác thêm, sửa, đổi trạng thái, xóa sẽ được ghi lại ở đây."
            />
          ) : (
            <DongThoiGianNhatKy ds={trangThai.ds} nhanDoiTuong={nhanDoiTuong} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
