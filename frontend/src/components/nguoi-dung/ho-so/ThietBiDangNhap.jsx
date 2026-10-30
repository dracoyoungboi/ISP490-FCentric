import { useState } from "react";
import { Monitor, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import HangCoBieuTuong from "@/components/nguoi-dung/ho-so/HangCoBieuTuong";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { nguoiDungService } from "@/services/nguoiDungService";
import { moTaThietBi, thoiGianTuongDoi } from "@/utils/thietBi";
import { getApiErrorMessage } from "@/utils/apiError";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";

const ICON_LOAI = { "dien-thoai": Smartphone, "may-tinh-bang": Tablet, "may-tinh": Monitor };
// Nút nguy hiểm dạng viền (đồng bộ với nút Chỉnh sửa/Đổi mật khẩu ở trang Hồ sơ, nhưng tông đỏ)
const NUT_VIEN_DANGER = "border-red-200 bg-white text-bo-danger shadow-none hover:bg-bo-danger-soft hover:text-bo-danger";

/**
 * Mục "Thiết bị đang đăng nhập" trong Hồ sơ cá nhân: liệt kê các phiên còn hiệu lực của chính mình, cho đăng xuất
 * từng thiết bị hoặc tất cả thiết bị khác. Thiết bị hiện tại được đánh dấu và không có nút đăng xuất (muốn thoát thì
 * dùng nút Đăng xuất trên thanh trên cùng). Tự tải lại danh sách sau mỗi thao tác.
 */
export default function ThietBiDangNhap() {
  const phienQ = useTaiDuLieu(() => nguoiDungService.layPhien(), "");
  const ds = phienQ.data ?? [];

  // xacNhan giữ NỘI DUNG (kieu, id, ten); moXacNhan điều khiển mở/đóng TÁCH RIÊNG để khi đóng không bị nháy chữ
  // (giữ nội dung trong lúc hộp chạy hiệu ứng đóng, giống cách BackofficeHeader xử lý hộp "còn lượt quét")
  const [xacNhan, setXacNhan] = useState(null);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);

  const soThietBiKhac = ds.filter((p) => !p.thietBiNay).length;

  const moHoi = (noiDung) => {
    setXacNhan(noiDung);
    setMoXacNhan(true);
  };
  const dongXacNhan = () => {
    if (!dangXuLy) setMoXacNhan(false);
  };

  const thucHien = async () => {
    if (!xacNhan) return;
    setDangXuLy(true);
    try {
      if (xacNhan.kieu === "mot") {
        await nguoiDungService.dangXuatPhien(xacNhan.id);
        toast.success("Đã đăng xuất thiết bị.");
      } else {
        await nguoiDungService.dangXuatThietBiKhac();
        toast.success("Đã đăng xuất các thiết bị khác.");
      }
      setMoXacNhan(false);
      phienQ.reload();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không đăng xuất được. Vui lòng thử lại."));
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <section aria-labelledby="ho-so-thiet-bi" className="border-b border-slate-100 py-5 sm:py-[22px]">
      <HangCoBieuTuong
        icon={MonitorSmartphone}
        tieuDeId="ho-so-thiet-bi"
        tieuDe={
          <>
            Thiết bị đang đăng nhập
            {ds.length > 1 ? <span className="font-normal text-bo-muted"> ({ds.length})</span> : null}
          </>
        }
        moTa="Các thiết bị đang mở tài khoản của bạn."
        hanhDong={
          soThietBiKhac > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => moHoi({ kieu: "khac" })}
              className={`max-sm:h-10 max-sm:w-full ${NUT_VIEN_DANGER}`}
            >
              Đăng xuất tất cả thiết bị khác
            </Button>
          ) : null
        }
      />

      <div className="mt-3.5">
        {phienQ.initialLoading ? (
          <LoadingState label="Đang tải thiết bị" className="min-h-[88px]" />
        ) : phienQ.error && ds.length === 0 ? (
          <ErrorState
            title="Không tải được danh sách thiết bị"
            description={getApiErrorMessage(phienQ.error, "Kiểm tra kết nối rồi thử lại.")}
            onRetry={phienQ.reload}
          />
        ) : ds.length === 0 ? (
          <p className="text-sm text-bo-muted">Không có thiết bị nào đang đăng nhập.</p>
        ) : (
          // Nhiều thiết bị: giới hạn chiều cao ~5 dòng rồi cuộn trong khung để trang Hồ sơ không phình dài
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {ds.map((p) => {
              const { ten, loai } = moTaThietBi(p.userAgent);
              const Icon = ICON_LOAI[loai] || Monitor;
              const tuongDoi = thoiGianTuongDoi(p.truyCapCuoi);
              const dong = [tuongDoi ? `Hoạt động ${tuongDoi}` : null, p.viTri, p.diaChiIp]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-bo-foreground">{ten}</span>
                      {p.thietBiNay ? (
                        <span className="rounded-full border border-green-200 bg-bo-success-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-bo-success">
                          Thiết bị này
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] leading-[18px] text-bo-muted">{dong || "—"}</p>
                  </div>
                  {!p.thietBiNay ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Đăng xuất ${ten}`}
                      onClick={() => moHoi({ kieu: "mot", id: p.id, ten })}
                      className={`shrink-0 max-sm:h-9 ${NUT_VIEN_DANGER}`}
                    >
                      Đăng xuất
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={moXacNhan}
        onClose={dongXacNhan}
        onConfirm={thucHien}
        isLoading={dangXuLy}
        variant="danger"
        title={xacNhan?.kieu === "khac" ? "Đăng xuất tất cả thiết bị khác?" : "Đăng xuất thiết bị này?"}
        description={
          xacNhan?.kieu === "khac"
            ? "Mọi thiết bị khác (trừ thiết bị này) sẽ phải đăng nhập lại."
            : `Thiết bị ${xacNhan?.ten ?? ""} sẽ phải đăng nhập lại.`
        }
        confirmText="Đăng xuất"
        cancelText="Hủy"
      />
    </section>
  );
}
