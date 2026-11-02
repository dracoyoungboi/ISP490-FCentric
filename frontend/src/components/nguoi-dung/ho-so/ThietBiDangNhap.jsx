import { useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import NganKeoThietBi, { NUT_DO_VIEN } from "@/components/nguoi-dung/ho-so/NganKeoThietBi";
import TheThietBi, { TheThietBiDayDu } from "@/components/nguoi-dung/ho-so/TheThietBi";
import {
  GIO_HIEU_LUC_PHIEN,
  SO_THE_DIEN_THOAI,
  SO_THE_TREN_TRANG,
  chuanBiPhien,
} from "@/components/nguoi-dung/ho-so/thietBiHoSo";
import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

// Màn cảm ứng: nút dạng chữ vẫn chạm được 44px nhờ đệm dọc, lề âm bù lại nên dòng không giãn (lớp cảm ứng chung nâng mọi nút
// lên 44px, làm khoảng cách giữa dòng đếm thiết bị và các thẻ lệch nhau)
const NUT_CHU = "rounded text-[13px] font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40 cam-ung:min-h-0! cam-ung:py-[calc((44px-1lh)/2)] cam-ung:-my-[calc((44px-1lh)/2)]";

/**
 * Mục "Thiết bị đang đăng nhập" ở Hồ sơ (chốt PA5, 31/10/2026).
 * - Trên trang: lưới tối đa 6 thẻ (thiết bị này trước, rồi mới hoạt động trước). Nút Đăng xuất từng thẻ chỉ hiện khi
 *   rê chuột hoặc Tab tới thẻ, để trang không lặp lại nhiều chữ "Đăng xuất". Thao tác chính: "Đăng xuất các thiết bị khác".
 * - Không có dòng tóm tắt dưới tiêu đề (số thiết bị đã ở tiêu đề). Bỏ đếm "hoạt động hôm nay" / "không dùng hơn 7 ngày"
 *   (01/11/2026): phiên chỉ sống 24 giờ nên hai số đó luôn là "tất cả" và 0.
 * - Nhiều hơn 6 thiết bị: nút "Xem tất cả thiết bị" mở ngăn kéo có ô tìm, gom "Thiết bị này" / "Thiết bị khác".
 * - Chỉ có thiết bị đang dùng: một thẻ đầy đủ trải hết chiều ngang (kèm lúc đăng nhập, địa chỉ IP).
 * - Thiết bị hiện tại không có nút đăng xuất ở đây (thoát bằng nút Đăng xuất trên thanh trên cùng).
 * Mọi lần đăng xuất đều hỏi lại; xong thì tải lại danh sách.
 * - Điện thoại (PA A, 02/11/2026): các thẻ gộp thành một khung danh sách, chỉ hiện SO_THE_DIEN_THOAI thiết bị kèm dòng
 *   "Xem tất cả N thiết bị" (mở ngăn kéo); nút "Đăng xuất các thiết bị khác" chuyển xuống dưới khung.
 */
export default function ThietBiDangNhap({ khoaTaiLai = 0 }) {
  // khoaTaiLai đổi (vd. vừa đổi mật khẩu, máy chủ đã đăng xuất các thiết bị khác) thì tải lại danh sách
  const phienQ = useTaiDuLieu(() => nguoiDungService.layPhien(), String(khoaTaiLai));
  // Mốc tính "x phút trước" là lúc tải danh sách, để số liệu không đổi giữa các lần vẽ
  const bayGio = phienQ.capNhatLuc ? phienQ.capNhatLuc.getTime() : 0;
  const ds = chuanBiPhien(phienQ.data, bayGio);
  const khac = ds.filter((p) => !p.thietBiNay);

  const [moNgan, setMoNgan] = useState(false);
  const [tuKhoa, setTuKhoa] = useState("");

  // xacNhan giữ NỘI DUNG; moXacNhan điều khiển mở/đóng TÁCH RIÊNG để khi đóng không bị nháy chữ
  const [xacNhan, setXacNhan] = useState(null);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);

  const moHoi = (noiDung) => {
    setXacNhan(noiDung);
    setMoXacNhan(true);
  };
  const dongXacNhan = () => {
    if (!dangXuLy) setMoXacNhan(false);
  };
  const moNganKeo = () => {
    setTuKhoa("");
    setMoNgan(true);
  };

  const thucHien = async () => {
    if (!xacNhan) return;
    setDangXuLy(true);
    try {
      if (xacNhan.kieu === "mot") {
        await nguoiDungService.dangXuatPhien(xacNhan.id);
        toast.success(`Đã đăng xuất ${xacNhan.ten}.`);
      } else if (xacNhan.kieu === "khac") {
        await nguoiDungService.dangXuatThietBiKhac();
        toast.success("Đã đăng xuất các thiết bị khác.");
        setMoNgan(false);
      }
      setMoXacNhan(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không đăng xuất được. Vui lòng thử lại."));
    } finally {
      setDangXuLy(false);
      phienQ.reload();
    }
  };

  const nhieu = ds.length > SO_THE_TREN_TRANG;
  const nhieuDienThoai = ds.length > SO_THE_DIEN_THOAI;
  // Nói điều người dùng chưa biết (vì sao không thấy thiết bị cũ), thay cho số "hoạt động hôm nay" luôn bằng tổng
  const tomTatNgan = `${ds.length} thiết bị · Tự đăng xuất sau ${GIO_HIEU_LUC_PHIEN} giờ`;

  const hoiMot = (p) => moHoi({ kieu: "mot", id: p.id, ten: p.ten });
  const hoiKhac = () => moHoi({ kieu: "khac", so: khac.length });

  let tieuDeHoi = "";
  let moTaHoi = "";
  let nutHoi = "Đăng xuất";
  if (xacNhan?.kieu === "mot") {
    tieuDeHoi = `Đăng xuất ${xacNhan.ten}?`;
    // Lời khuyên an ninh đặt đúng lúc người dùng định đăng xuất một thiết bị, không treo sẵn trên trang
    moTaHoi = "Thiết bị đó sẽ phải đăng nhập lại. Nếu bạn không nhận ra thiết bị này, hãy đổi mật khẩu ngay sau đó.";
  } else if (xacNhan?.kieu === "khac") {
    tieuDeHoi = `Đăng xuất ${xacNhan.so} thiết bị khác?`;
    moTaHoi = "Mọi thiết bị trừ thiết bị bạn đang dùng sẽ phải đăng nhập lại.";
    nutHoi = `Đăng xuất ${xacNhan.so} thiết bị`;
  }

  return (
    <section aria-labelledby="ho-so-thiet-bi" className="px-4 py-5 max-sm:py-[18px] sm:px-6 sm:py-[22px]">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 max-sm:mb-3">
        <h2 id="ho-so-thiet-bi" className="min-w-0 text-[15px] font-semibold leading-[22px] text-bo-foreground">
          Thiết bị đang đăng nhập
          {ds.length ? <span className="font-normal text-bo-muted"> ({ds.length})</span> : null}
        </h2>
        {khac.length ? (
          <button type="button" onClick={hoiKhac} className={`${NUT_CHU} py-0.5 text-bo-danger max-sm:hidden`}>
            Đăng xuất các thiết bị khác
          </button>
        ) : null}
      </div>

      {phienQ.initialLoading ? (
        <LoadingState label="Đang tải thiết bị" className="min-h-[88px]" />
      ) : phienQ.error && !phienQ.data ? (
        <ErrorState
          title="Không tải được danh sách thiết bị"
          description={getApiErrorMessage(phienQ.error, "Kiểm tra kết nối rồi thử lại.")}
          onRetry={phienQ.reload}
        />
      ) : ds.length === 0 ? (
        <p className="text-sm text-bo-muted">Không có thiết bị nào đang đăng nhập.</p>
      ) : ds.length === 1 && ds[0].thietBiNay ? (
        // Chỉ thiết bị đang dùng: một thẻ đầy đủ trải hết chiều ngang thay vì nửa ô lưới
        <TheThietBiDayDu phien={ds[0]} />
      ) : (
        <>
          <div className="@container">
            <ul className="m-0 grid list-none gap-2.5 p-0 max-sm:grid-cols-1! max-sm:gap-0 max-sm:overflow-hidden max-sm:rounded-lg max-sm:border max-sm:border-bo-border @lg:grid-cols-2">
              {ds.slice(0, SO_THE_TREN_TRANG).map((p, i) => (
                <TheThietBi
                  key={p.id}
                  phien={p}
                  onDangXuat={hoiMot}
                  className={cn(
                    "max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:border-slate-100 max-sm:py-2.5 max-sm:last:border-b-0",
                    i >= SO_THE_DIEN_THOAI && "max-sm:hidden",
                  )}
                />
              ))}
              {nhieuDienThoai ? (
                <li className="sm:hidden">
                  <button
                    type="button"
                    onClick={moNganKeo}
                    className="flex h-11 w-full items-center justify-center gap-1 text-[13px] font-medium text-bo-primary outline-none hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40"
                  >
                    Xem tất cả {ds.length} thiết bị
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          {/* Điện thoại: nút viền đỏ rộng bằng khung danh sách, cùng kiểu nút trong ngăn kéo (góp ý 02/11: chữ đỏ lệch trái) */}
          {khac.length ? (
            <Button type="button" variant="outline" size="sm" onClick={hoiKhac} className={cn(NUT_DO_VIEN, "mt-3 w-full sm:hidden")}>
              <LogOut className="size-3.5" aria-hidden="true" />
              Đăng xuất các thiết bị khác
            </Button>
          ) : null}
          {nhieu ? (
            <div className="mt-3 flex justify-center max-sm:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={moNganKeo}
                className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
              >
                Xem tất cả thiết bị
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </>
      )}

      <NganKeoThietBi
        open={moNgan}
        onOpenChange={setMoNgan}
        ds={ds}
        tomTat={tomTatNgan}
        tuKhoa={tuKhoa}
        onTuKhoaChange={setTuKhoa}
        coThietBiKhac={khac.length > 0}
        onDangXuatMot={hoiMot}
        onDangXuatTatCaKhac={hoiKhac}
      />

      <ConfirmModal
        isOpen={moXacNhan}
        onClose={dongXacNhan}
        onConfirm={thucHien}
        isLoading={dangXuLy}
        variant="danger"
        title={tieuDeHoi}
        description={moTaHoi}
        confirmText={nutHoi}
        cancelText="Hủy"
      />
    </section>
  );
}
