import { useRef } from "react";
import { AlertCircle, FileText, History, Inbox, PackageCheck, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import HoatDongNcc from "@/components/supplier/chi-tiet/HoatDongNcc";
import {
  BangBaoGiaNcc,
  BangDonMuaNcc,
  BangPhieuNhapNcc,
  BangSanPhamGiaNcc,
  DangMoNcc,
} from "@/components/supplier/chi-tiet/BangGiaoDichNcc";

const TRONG = {
  "don-mua": {
    icon: Inbox,
    title: "Chưa có đơn mua hàng",
    description: "Khi duyệt báo giá của nhà cung cấp này, đơn mua hàng sẽ hiện ở đây kèm tiến độ nhận hàng.",
  },
  "bao-gia": {
    icon: FileText,
    title: "Chưa có báo giá nào",
    description: "Chọn nhà cung cấp này khi gửi yêu cầu báo giá từ một yêu cầu nhập hàng.",
  },
  "phieu-nhap": {
    icon: PackageCheck,
    title: "Chưa nhập kho lần nào",
    description: "Phiếu nhập kho của các đơn mua từ nhà cung cấp này sẽ hiện ở đây.",
  },
  "san-pham": {
    icon: Tags,
    title: "Chưa có giá nhập",
    description: "Giá theo từng biến thể sẽ có sau đơn mua đầu tiên, để so khi duyệt báo giá mới.",
  },
  "hoat-dong": {
    icon: History,
    title: "Chưa có hoạt động",
    description: "Việc gửi yêu cầu báo giá và nhập kho với nhà cung cấp này sẽ hiện ở đây.",
  },
};

function chuChan(tab, d) {
  switch (tab) {
    case "dang-mo":
      return "Việc gấp xếp lên trước · hết việc thì tab này tự ẩn";
    case "don-mua":
      return `${d.chot.length} đơn mua hàng đã chốt · bấm mã đơn để mở chi tiết`;
    case "bao-gia":
      return `${d.baoGia.length} báo giá chưa thành đơn mua · báo giá đã chốt nằm ở tab Đơn mua hàng`;
    case "phieu-nhap":
      return `${d.phieus?.length ?? 0} phiếu nhập kho, không tính phiếu đã hủy`;
    case "san-pham":
      return "Giá lấy từ các đơn mua đã chốt · dùng để so khi duyệt báo giá mới";
    default:
      return "Chỉ hiện việc có ngày giờ trên chứng từ: gửi yêu cầu báo giá, nhập kho · mới nhất ở trên";
  }
}

/**
 * Cột trái của thân khối: các tab giao dịch với nhà cung cấp.
 * - `tabs`: [{ ma, nhan, so, gap }] — `gap` tô đỏ số trên tab (có việc quá hạn).
 * - `d`: dữ liệu đã tính sẵn ở trang (việc đang mở, đơn chốt, báo giá, phiếu nhập, lịch sử giá, sự kiện).
 * - `loiDon`: lỗi tải đơn mua (chặn cả vùng, có Thử lại); `loiPhieu`: lỗi tải phiếu nhập (chỉ báo một dòng).
 */
export default function GiaoDichNcc({ tabs, tab, onDoiTab, dangTai, loiDon, onThuLaiDon, loiPhieu, onThuLaiPhieu, ghiChu, d }) {
  const nutTab = useRef({});

  // Mũi tên trái / phải chuyển tab như một nhóm tab chuẩn
  const doiBangPhim = (suKien, i) => {
    if (suKien.key !== "ArrowRight" && suKien.key !== "ArrowLeft") return;
    suKien.preventDefault();
    const tiep = tabs[(i + (suKien.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onDoiTab(tiep.ma);
    nutTab.current[tiep.ma]?.focus();
  };

  const coDong = {
    "dang-mo": d.viec.length > 0,
    "don-mua": d.chot.length > 0,
    "bao-gia": d.baoGia.length > 0,
    "phieu-nhap": (d.phieus?.length ?? 0) > 0,
    "san-pham": d.lichSuGia.length > 0,
    "hoat-dong": d.suKien.length > 0,
  }[tab];

  let noiDung;
  if (loiDon) {
    noiDung = (
      <ErrorState
        title="Không tải được giao dịch với nhà cung cấp"
        description={loiDon}
        onRetry={onThuLaiDon}
      />
    );
  } else if (dangTai) {
    noiDung = <LoadingState className="min-h-56" label="Đang tải giao dịch với nhà cung cấp" />;
  } else {
    if (!coDong) {
      const trong = TRONG[tab] ?? TRONG["hoat-dong"];
      noiDung = <EmptyState className="min-h-56" icon={trong.icon} title={trong.title} description={trong.description} />;
    } else if (tab === "dang-mo") noiDung = <DangMoNcc viec={d.viec} nutCuaDon={d.nutCuaDon} />;
    else if (tab === "don-mua") noiDung = <BangDonMuaNcc chot={d.chot} giaoTheoDon={d.giaoTheoDon} />;
    else if (tab === "bao-gia") noiDung = <BangBaoGiaNcc baoGia={d.baoGia} />;
    else if (tab === "phieu-nhap") noiDung = <BangPhieuNhapNcc phieus={d.phieus} />;
    else if (tab === "san-pham") noiDung = <BangSanPhamGiaNcc dong={d.lichSuGia} />;
    else noiDung = <HoatDongNcc suKien={d.suKien} />;
  }

  return (
    <section aria-label="Giao dịch với nhà cung cấp" className="flex min-w-0 flex-col">
      <div
        role="tablist"
        aria-label="Loại giao dịch"
        className="flex gap-5 overflow-x-auto border-b border-bo-border px-4 [scrollbar-width:thin] sm:px-6"
      >
        {tabs.map((t, i) => {
          const chon = t.ma === tab;
          return (
            <button
              key={t.ma}
              ref={(el) => {
                nutTab.current[t.ma] = el;
              }}
              type="button"
              role="tab"
              id={`tab-ncc-${t.ma}`}
              aria-selected={chon}
              aria-controls="vung-tab-ncc"
              tabIndex={chon ? 0 : -1}
              onClick={() => onDoiTab(t.ma)}
              onKeyDown={(e) => doiBangPhim(e, i)}
              className={cn(
                "-mb-px inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                chon ? "border-bo-primary font-semibold text-bo-foreground" : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
              )}
            >
              {t.nhan}
              {t.so > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    t.gap ? "bg-bo-danger-soft text-bo-danger" : chon ? "bg-bo-primary-soft text-bo-primary" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {t.so}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loiPhieu && !loiDon ? (
        <div
          role="alert"
          className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2 text-sm text-bo-danger sm:mx-6"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Không tải được phiếu nhập kho{loiPhieu === true ? "" : `: ${loiPhieu}`}. Giao đúng hạn tạm chưa tính.
          </span>
          <button type="button" onClick={onThuLaiPhieu} className="font-medium underline underline-offset-2 hover:no-underline">
            Thử lại
          </button>
        </div>
      ) : null}

      <div id="vung-tab-ncc" role="tabpanel" aria-labelledby={`tab-ncc-${tab}`} className="min-w-0 flex-1">
        {noiDung}
      </div>

      {/* Chân vùng tab: ghi chú của tab (bỏ khi tab trống, ô trống đã nói đủ) và phạm vi dữ liệu */}
      {!loiDon && !dangTai && (coDong || ghiChu) ? (
        <div className="mt-auto border-t border-slate-100 px-4 py-3 text-[13px] leading-5 text-bo-muted sm:px-6">
          {coDong ? <span className="block">{chuChan(tab, d)}</span> : null}
          {ghiChu ? <span className="block">{ghiChu}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
