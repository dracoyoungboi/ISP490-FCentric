import { useId } from "react";
import { ChevronDown, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { GHI_CHU_TOI_DA, MOC_NGAY_GIAO, isoNgay, moTaNgayGiao, sauNgay } from "./tinhTaoYeuCau";

const O_CHON_KHO = cn(O_NHAP, "cursor-pointer appearance-none pr-9 font-medium");

/**
 * Cột phải của màn Tạo yêu cầu nhập hàng (dính lại khi cuộn từ 1280px): Kho nhận (Kho tổng; nhiều Kho tổng thì chọn được),
 * ngày giao dự kiến (bắt buộc, nút chọn nhanh Sau 7 / 14 / 30 ngày, dòng "Thứ…, dd/MM/yyyy · còn n ngày"), ghi chú
 * (tối đa GHI_CHU_TOI_DA ký tự) và Tóm tắt cho người duyệt (số sản phẩm, biến thể, tổng, theo số đề xuất, cần chú ý,
 * số lượng theo nhóm hàng).
 * `khoChon`: Kho tổng vừa chọn (danh mục có thể còn đang tải theo kho mới); `dangTaiKho`: đang tải hàng của kho đó.
 */
export default function CotThongTinYeuCau({
  kho: khoTai,
  khoChon,
  dangTaiKho = false,
  dsKhoTong = [],
  onDoiKho,
  khoDeXuatTen,
  ngayGiao,
  onDoiNgay,
  ghiChu,
  onDoiGhiChu,
  khoa = false,
  tomTat,
  homNay = new Date(),
}) {
  const id = useId();
  // Vừa đổi kho: hiện ngay kho đã chọn (tên, quản lý lấy từ danh sách Kho tổng) dù danh mục chưa tải xong
  const kho = dsKhoTong.find((k) => String(k.id) === String(khoChon ?? khoTai?.id)) ?? khoTai;
  const moTa = moTaNgayGiao(ngayGiao, homNay);
  const lonNhat = Math.max(1, ...(tomTat?.theoNhom ?? []).map((x) => x.soLuong));

  return (
    <CotThuocTinh
      nhan="Thông tin yêu cầu nhập hàng"
      // Khung chứng từ của màn này không cắt tràn (để đầu khối dính khi cuộn): tự bo góc dưới cho nền xám của cột
      className="rounded-b-lg xl:rounded-bl-none xl:[&>div]:sticky xl:[&>div]:top-[92px]"
    >
      <div className="contents xl:block">
        <NhomThuocTinh nhan="Kho nhận">
          {dsKhoTong.length > 1 && !khoa ? (
            <label className="relative block">
              <span className="sr-only">Chọn Kho tổng nhận hàng</span>
              <select value={kho?.id ?? ""} aria-busy={dangTaiKho || undefined} onChange={(e) => onDoiKho?.(e.target.value)} className={O_CHON_KHO}>
                {dsKhoTong.map((k) => <option key={k.id} value={k.id}>{k.tenKho}{k.maKho ? ` (${k.maKho})` : ""}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-bo-muted" aria-hidden="true" />
            </label>
          ) : (
            <div className="flex items-center gap-2.5 rounded-md border border-bo-border bg-bo-surface px-2.5 py-2">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-bo-primary-soft text-bo-primary">
                <Warehouse className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-5 text-bo-foreground">
                  {kho?.tenKho || "Chưa có Kho tổng"}
                  {kho?.maKho ? <span className="ml-1.5 font-mono text-xs font-normal text-bo-muted">{kho.maKho}</span> : null}
                </span>
                <span className="block text-xs leading-4 text-bo-muted">Nhận hàng từ nhà cung cấp</span>
              </span>
            </div>
          )}
          <p className="mt-2 text-xs leading-[18px] text-bo-muted" aria-live="polite">
            {dangTaiKho ? (
              <>Đang tải hàng của {kho?.tenKho || "Kho tổng"}…</>
            ) : khoDeXuatTen ? (
              <>
                Hàng bổ sung cho <b className="font-semibold text-bo-foreground">{khoDeXuatTen}</b> (kho bán hàng). Hàng nhập
                về {kho?.tenKho || "Kho tổng"}, sau đó chuyển sang {khoDeXuatTen} bằng phiếu chuyển kho.
              </>
            ) : (
              <>
                Chỉ Kho tổng nhận hàng từ nhà cung cấp.
                {kho?.quanLy ? <> Quản lý kho <span className="text-bo-foreground">{kho.quanLy}</span> duyệt yêu cầu này.</> : " Quản lý Kho tổng duyệt yêu cầu này."}
              </>
            )}
          </p>
        </NhomThuocTinh>

        <NhomThuocTinh>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-ngay`} className={NHAN_O}>
              Giao dự kiến <span className="text-bo-danger" aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-ngay`}
              type="date"
              required
              value={ngayGiao}
              min={isoNgay(homNay)}
              disabled={khoa}
              onChange={(e) => onDoiNgay?.(e.target.value)}
              aria-describedby={`${id}-ngay-goi-y`}
              aria-invalid={moTa.loi ? true : undefined}
              className={cn(O_NHAP, moTa.loi && "border-bo-danger")}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh ngày giao">
              {MOC_NGAY_GIAO.map((n) => {
                const iso = sauNgay(n, homNay);
                const dangChon = ngayGiao === iso;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={khoa}
                    aria-pressed={dangChon}
                    onClick={() => onDoiNgay?.(iso)}
                    className={cn(
                      "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      dangChon
                        ? "border-bo-primary bg-bo-primary-soft text-bo-primary-strong"
                        : "border-bo-border bg-bo-surface text-slate-600 hover:border-slate-300 hover:text-bo-foreground",
                    )}
                  >
                    Sau {n} ngày
                  </button>
                );
              })}
            </div>
            <p id={`${id}-ngay-goi-y`} className={GOI_Y_O}>
              <span className={moTa.loi ? "font-medium text-bo-danger" : ngayGiao ? "font-medium text-bo-foreground" : ""}>{moTa.trai}</span>
              <span>{moTa.phai}</span>
            </p>
          </div>
        </NhomThuocTinh>

        <NhomThuocTinh>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-ghi-chu`} className={NHAN_O}>Ghi chú</label>
            <textarea
              id={`${id}-ghi-chu`}
              aria-describedby={`${id}-ghi-chu-goi-y`}
              value={ghiChu}
              maxLength={GHI_CHU_TOI_DA}
              disabled={khoa}
              onChange={(e) => onDoiGhiChu?.(e.target.value.slice(0, GHI_CHU_TOI_DA))}
              placeholder="Lý do cần nhập, vd. bổ sung size M, L trước đợt khuyến mãi"
              className={O_NHAP_NHIEU_DONG}
            />
            <p id={`${id}-ghi-chu-goi-y`} className={GOI_Y_O}>
              <span>Không bắt buộc</span>
              <span>{ghiChu.length}/{GHI_CHU_TOI_DA} ký tự</span>
            </p>
          </div>
        </NhomThuocTinh>

        {tomTat?.soDong ? (
          <NhomThuocTinh nhan="Tóm tắt cho người duyệt">
            <BangThuocTinh
              rongNhan={128}
              muc={[
                { ma: "sp", nhan: "Sản phẩm", giaTri: <span className="tabular-nums">{soVN(tomTat.soSp)}</span> },
                { ma: "bt", nhan: "Biến thể", giaTri: <span className="tabular-nums">{soVN(tomTat.soDong)}</span> },
                { ma: "tong", nhan: "Tổng số lượng", giaTri: <b className="font-semibold tabular-nums">{soVN(tomTat.tongSl)}</b> },
                { ma: "dx", nhan: "Theo số đề xuất", giaTri: <span className="tabular-nums">{soVN(tomTat.theoDeXuat)}/{soVN(tomTat.soDong)} dòng</span> },
                {
                  ma: "cy",
                  nhan: "Cần chú ý",
                  an: !tomTat.soChuY,
                  giaTri: <span className="font-medium tabular-nums text-bo-warning">{soVN(tomTat.soChuY)} mã</span>,
                },
              ]}
            />
            {tomTat.theoNhom?.length ? (
              <ul className="m-0 mt-3.5 grid list-none gap-2 p-0" aria-label="Số lượng theo nhóm hàng">
                {tomTat.theoNhom.map((x) => (
                  <li key={x.ten} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-xs leading-4">
                    <span className="truncate text-slate-700" title={x.ten}>{x.ten}</span>
                    <span className="font-medium tabular-nums text-bo-foreground">{soVN(x.soLuong)}</span>
                    <span className="col-span-2 h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-bo-primary"
                        // data-viz: độ dài thanh theo số lượng của nhóm
                        style={{ width: `${Math.max(4, Math.round((x.soLuong / lonNhat) * 100))}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </NhomThuocTinh>
        ) : null}
      </div>
    </CotThuocTinh>
  );
}
