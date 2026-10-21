import { useEffect, useRef } from "react";
import { AlertCircle, LockKeyhole, RefreshCcw, SearchX, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { KHO_LAM_VIEC_EVENT } from "@/utils/khoLamViec";
import { CAU_LOI_MAY_CHU, CAU_MAT_KET_NOI, chuLoiTai, phanLoaiLoiTai } from "./loiTai.js";

const KHUNG = "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm";
const NUT_VIEN = "border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle";

function Xuong({ className }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded bg-slate-100 motion-reduce:animate-none", className)} />;
}

/**
 * Đang tải màn chi tiết chứng từ: khung xương đúng hình khối (đầu khối, tiến trình, bảng, cột phải) thay cho vòng quay.
 * `nhan`: câu cho trình đọc màn hình, vd. "Đang tải phiếu nhặt hàng". `coTienTrinh = false` khi màn không có tiến trình.
 * Không "nhận" tiêu đề trang: PageContainer vẫn vẽ tiêu đề của layout (đúng một h1).
 */
export function KhungDangTai({ nhan = "Đang tải dữ liệu", coTienTrinh = true, className }) {
  return (
    <div role="status" aria-busy="true" className={cn(KHUNG, className)}>
      <span className="sr-only">{nhan}</span>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <Xuong className="size-9 shrink-0 rounded-md" />
          <div className="grid gap-2">
            <Xuong className="h-6 w-44 sm:w-56" />
            <Xuong className="h-3.5 w-56 max-w-[60vw] sm:w-80" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Xuong className="h-9 w-28 rounded-md" />
          <Xuong className="size-9 rounded-md" />
        </div>
      </div>
      {coTienTrinh ? (
        <div className="border-t border-bo-border bg-bo-surface-subtle px-4 py-4 sm:px-6 sm:py-5">
          <Xuong className="h-11 bg-slate-200/60" />
        </div>
      ) : null}
      <div className="grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-3.5 px-4 py-5 sm:px-6">
          <Xuong className="h-[18px] w-44" />
          <Xuong className="h-11" />
          <Xuong className="h-11" />
          <Xuong className="h-11" />
        </div>
        <div className="grid content-start gap-3.5 border-t border-bo-border bg-bo-surface-subtle px-4 py-5 sm:px-6 xl:border-l xl:border-t-0">
          <Xuong className="h-16 bg-slate-200/60" />
          <Xuong className="h-24 bg-slate-200/60" />
        </div>
      </div>
    </div>
  );
}

// So hai câu bỏ qua hoa thường, khoảng trắng và dấu chấm cuối (câu máy chủ trùng mô tả thì không hiện lại)
const chuanCau = (chu) => String(chu ?? "").toLowerCase().replace(/\s+/g, " ").replace(/[.!\s]+$/, "").trim();

/**
 * Không tìm thấy chứng từ (máy chủ trả 404, hoặc 400 "Không tìm thấy …"): cùng cách Chi tiết đơn mua hàng.
 * `moTa` mặc định "… không tồn tại hoặc đã bị xóa khỏi hệ thống.". `cauMayChu`: câu của máy chủ (đã lọc chữ của màn),
 * hiện thành dòng nhỏ dưới mô tả — chỉ khi khác mô tả. `nhanNut` + `onNut`: nút chính, vd. "Về danh sách phiếu nhặt hàng".
 * `icon`: biểu tượng (mặc định kính lúp gạch chéo; KhungLoiChungTu dùng ổ khóa cho "không có quyền", kho cho "kho khác").
 * `onTaiLai`: thêm nút viền "Tải lại" trước nút chính (vd. sau khi đổi nơi làm việc).
 */
export function KhungKhongThay({ tieuDe, moTa, cauMayChu, nhanNut, onNut, onTaiLai, icon = SearchX, className }) {
  const moTaHien = moTa ?? "Chứng từ không tồn tại hoặc đã bị xóa khỏi hệ thống.";
  const hienCauMayChu = Boolean(cauMayChu) && chuanCau(cauMayChu) !== chuanCau(moTaHien);
  const nutChinh = nhanNut && onNut ? (
    <Button
      type="button"
      onClick={onNut}
      className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
    >
      {nhanNut}
    </Button>
  ) : null;
  return (
    <div className={cn(KHUNG, className)}>
      <EmptyState
        icon={icon}
        className="flex-1"
        title={tieuDe}
        description={
          <>
            {moTaHien}
            {hienCauMayChu ? (
              <span className="mt-1 block text-[13px] leading-5 text-slate-500">{cauMayChu}</span>
            ) : null}
          </>
        }
        action={
          onTaiLai ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" className={NUT_VIEN} onClick={onTaiLai}>
                <RefreshCcw aria-hidden="true" />
                Tải lại
              </Button>
              {nutChinh}
            </div>
          ) : (
            nutChinh
          )
        }
      />
    </div>
  );
}

/**
 * Không tải được chứng từ (lỗi mạng, lỗi máy chủ): `moTa` (mặc định "Không kết nối được máy chủ. Kiểm tra mạng rồi thử
 * lại."; nên truyền `moTaLoi` của phanLoaiLoiTai) và nút "Thử lại". Có `onVeDanhSach` thì thêm nút về danh sách cạnh
 * "Thử lại" (`nhanVeDanhSach`, mặc định "Về danh sách").
 */
export function KhungLoiTai({ tieuDe, moTa = CAU_MAT_KET_NOI, onThuLai, nhanVeDanhSach, onVeDanhSach, className }) {
  if (!onVeDanhSach) {
    return (
      <div className={cn(KHUNG, className)}>
        <ErrorState className="flex-1" title={tieuDe} description={moTa} onRetry={onThuLai} />
      </div>
    );
  }
  // ErrorState chỉ có nút "Thử lại": cần thêm nút về danh sách thì vẽ cùng kiểu, hai nút cạnh nhau
  return (
    <div className={cn(KHUNG, className)}>
      <div role="alert" className="flex min-h-64 flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger">
          <AlertCircle className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-bo-foreground">{tieuDe}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">{moTa}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onThuLai ? (
            <Button type="button" variant="outline" className={NUT_VIEN} onClick={onThuLai}>
              <RefreshCcw aria-hidden="true" />
              Thử lại
            </Button>
          ) : null}
          <Button type="button" variant="outline" className={NUT_VIEN} onClick={onVeDanhSach}>
            {nhanVeDanhSach || "Về danh sách"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Một dòng cho mọi trường hợp khi chưa có chứng từ để vẽ (tải xong mà rỗng, hoặc lỗi): tự phân loại bằng
 * phanLoaiLoiTai rồi vẽ khung với chữ theo tên chứng từ:
 *   thuộc kho khác → KhungKhongThay (câu riêng; có `onThuLai` thì thêm nút "Tải lại" và tự tải lại khi đổi nơi làm
 *   việc — KHO_LAM_VIEC_EVENT); 403 → KhungKhongThay "Bạn không có quyền xem …" (câu máy chủ, không "Thử lại");
 *   không tìm thấy → KhungKhongThay; còn lại → KhungLoiTai ("Thử lại" + nút về danh sách).
 *
 * - `loi`: lỗi của lần tải (axios); `null` = tải xong nhưng không có dữ liệu → "Không tìm thấy".
 * - `tenChungTu`: tên đầy đủ viết thường, vd. "phiếu nhặt hàng" → "Không tìm thấy phiếu nhặt hàng",
 *   "Về danh sách phiếu nhặt hàng", "Không tải được phiếu nhặt hàng".
 * - `onVeDanhSach`: có thì mọi khung có nút về danh sách; `nhanVeDanhSach` (tùy chọn): thay chữ nút đó ở mọi khung
 *   (mặc định "Về danh sách <tên chứng từ>").
 * - `tuyChonLoi`: tùy chọn của phanLoaiLoiTai (`mauKhongThay`, `coi500LaKhongThay`).
 * - `locCauMayChu(cau) → cau | null`: lọc chữ của màn trước khi hiện câu máy chủ (vd. đổi "Pick List"); trả null để ẩn.
 * - `moTaKhongThay`: thay câu mặc định "<Tên> không tồn tại hoặc đã bị xóa khỏi hệ thống." (chỉ khung không tìm thấy;
 *   chứng từ thuộc kho khác có câu riêng).
 */
export function KhungLoiChungTu({
  loi,
  tenChungTu,
  onVeDanhSach,
  nhanVeDanhSach,
  onThuLai,
  tuyChonLoi,
  locCauMayChu,
  moTaKhongThay,
  className,
}) {
  const loai = phanLoaiLoiTai(loi, tuyChonLoi);
  const chu = chuLoiTai(tenChungTu);
  const loc = (cau) => (cau && locCauMayChu ? locCauMayChu(cau) : cau);
  const nhanVe = onVeDanhSach ? nhanVeDanhSach || chu.nhanVeDanhSach : undefined;

  // Chứng từ thuộc kho khác: đổi "Nơi làm việc" (sidebar, ô chọn kho ở trang) thì tự tải lại. Giữ onThuLai mới nhất qua
  // ref (nơi gọi hay truyền hàm viết tại chỗ) để không gỡ / gắn lại lắng nghe sau mỗi lần vẽ
  const ngheDoiKho = loai.khoKhac && Boolean(onThuLai);
  const thuLaiRef = useRef(onThuLai);
  useEffect(() => {
    thuLaiRef.current = onThuLai;
  });
  useEffect(() => {
    if (!ngheDoiKho) return undefined;
    const nghe = () => thuLaiRef.current?.();
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, [ngheDoiKho]);

  if (loai.khoKhac) {
    // Chứng từ có thật nhưng ở kho khác kho đang làm việc: không nói "không tồn tại"; đổi nơi làm việc rồi tải lại
    return (
      <KhungKhongThay
        icon={Warehouse}
        tieuDe={chu.tieuDeKhoKhac}
        moTa={chu.moTaKhoKhac}
        cauMayChu={loc(loai.cauMayChu)}
        nhanNut={nhanVe}
        onNut={onVeDanhSach}
        onTaiLai={onThuLai}
        className={className}
      />
    );
  }
  if (loai.khongQuyen) {
    // 403: hiện câu máy chủ (không có quyền xem, không thuộc kho, phiên hết hạn…); thử lại vô ích nên chỉ có nút về danh sách
    return (
      <KhungKhongThay
        icon={LockKeyhole}
        tieuDe={chu.tieuDeKhongQuyen}
        moTa={loc(loai.cauMayChu) || chu.moTaKhongQuyen}
        nhanNut={nhanVe}
        onNut={onVeDanhSach}
        className={className}
      />
    );
  }
  if (loai.khongThay) {
    return (
      <KhungKhongThay
        tieuDe={chu.tieuDeKhongThay}
        moTa={moTaKhongThay ?? chu.moTaKhongThay}
        cauMayChu={loc(loai.cauMayChu)}
        nhanNut={nhanVe}
        onNut={onVeDanhSach}
        className={className}
      />
    );
  }
  return (
    <KhungLoiTai
      tieuDe={chu.tieuDeLoi}
      moTa={loai.cauMayChu ? loc(loai.moTaLoi) || CAU_LOI_MAY_CHU : loai.moTaLoi}
      onThuLai={onThuLai}
      nhanVeDanhSach={nhanVe}
      onVeDanhSach={onVeDanhSach}
      className={className}
    />
  );
}
