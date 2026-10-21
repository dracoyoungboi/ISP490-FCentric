import {
  Archive, BadgeCheck, Ban, Banknote, CalendarCheck, CalendarClock, CalendarOff, Camera, CheckCheck, ChevronsUp, CircleCheckBig, CircleHelp, CircleOff, CirclePause, ClipboardCheck, ClipboardList, Clock, Database, Flag, Grid2x2, Hand, Hourglass, KeyRound, Link, Lock, Mail, MessageSquareX, OctagonAlert, Package, PackageCheck, PackageMinus, PackageOpen, PackageX, PencilLine, Pin, PinOff, Radio, Receipt, RefreshCw, RotateCcw, ScanBarcode, Search, Send, SkipForward, Trash2, TrendingDown, TrendingUp, TriangleAlert, Truck, Undo2, Unlink, UserCheck, Video, Warehouse, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NHOM_TRANG_THAI, layCachVe, nhomCuaNhan } from "@/constants/trangThai";

/**
 * Thẻ trạng thái (chốt 21/10/2026: "chỉ bọc khi cần", vẽ đúng bản demo "Bộ thẻ trạng thái · bản chốt").
 * Màu tra theo TÊN nhãn ở constants/trangThai.js.
 *
 * - Cần chú ý / Có vấn đề → ô nền nhạt bo 6px + biểu tượng (mắt bắt ngay).
 * - Bình thường / Còn hàng → cùng ô nhưng chỉ viền mảnh xanh lá, không nền (thẳng cột, nhẹ hơn cảnh báo).
 * - Chứng từ có quy trình (`quyTrinh`) → vòng tiến trình lấp đầy theo bước + chữ, không nền.
 * - Còn lại → biểu tượng nghiệp vụ tô màu + chữ, không nền; việc đang chạy thật → chấm nhịp.
 *
 * Props:
 * - `label`: tên trạng thái (chuỗi).
 * - `quyTrinh`: loại chứng từ ("donBan", "phieuNhat", "phieuXuat", "chuyenKho", "phieuNhap", "kiemDem", "kiemKe",
 *   "yeuCauNhap", "yeuCauBaoGia", "donMua", "baoGiaBan") — xem QUY_TRINH.
 * - `doiTuong`: "nguoi" | "kho" — đổi biểu tượng của nhãn dùng chung (vd. "Hoạt động").
 * - `nhom`: ép nhóm màu (cho, dang, canChuY, xong, dong, loi, thuong). Thường không cần truyền.
 * - `tone`: chỉ dùng cho giá trị không phải trạng thái, khi nhãn không có trong bảng.
 * - `size`: "md" (trong bảng) hoặc "lg" (đầu trang chi tiết).
 */

/** Nửa vòng (Một phần / Chưa đủ) và kệ hàng (Cất về kệ): vẽ riêng như bản demo, cùng nét với lucide. */
function NuaVong({ className, strokeWidth = 2, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
    </svg>
  );
}

function KeHang({ className, strokeWidth = 2, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 3v18M20 3v18M4 8h16M4 15h16" />
    </svg>
  );
}

const BIEU_TUONG = {
  Archive, BadgeCheck, Ban, Banknote, CalendarCheck, CalendarClock, CalendarOff, Camera, CheckCheck, ChevronsUp, CircleCheckBig, CircleHelp, CircleOff, CirclePause, ClipboardCheck, ClipboardList, Clock, Database, Flag, Grid2x2, Hand, Hourglass, KeHang, KeyRound, Link, Lock, Mail, MessageSquareX, NuaVong, OctagonAlert, Package, PackageCheck, PackageMinus, PackageOpen, PackageX, PencilLine, Pin, PinOff, Radio, Receipt, RefreshCw, RotateCcw, ScanBarcode, Search, Send, SkipForward, Trash2, TrendingDown, TrendingUp, TriangleAlert, Truck, Undo2, Unlink, UserCheck, Video, Warehouse, Wrench,
};

// Số đo (chốt 21/10, mục B review), cỡ md: mọi thẻ chữ 13px đậm 600 để khác chữ dữ liệu; khung cao 24px, khe 6px;
// thẻ không khung khe 7px; icon 15px ở cả hai kiểu để cùng cột thẳng hàng.
// Cỡ lg (đầu trang chi tiết): khung cao 26px chữ 13px icon 14px; không khung chữ 14px icon 16px.
const CO = {
  md: { khung: "h-6 gap-1.5 pl-1.5 pr-2 text-[13px] leading-5", tron: "gap-[7px] text-[13px] leading-5", icon: "size-[15px]", iconTron: "size-[15px]", vong: 14, cham: 10 },
  lg: { khung: "h-[26px] gap-1.5 pl-2 pr-2.5 text-[13px] leading-4", tron: "gap-2 text-sm leading-6", icon: "size-3.5", iconTron: "size-4", vong: 16, cham: 12 },
};

// Chu vi vòng trong (r = 2.25) của vòng tiến trình.
const CHU_VI = 2 * Math.PI * 2.25;

function VongTienTrinh({ kieu, tiLe, kichThuoc, className }) {
  return (
    <svg width={kichThuoc} height={kichThuoc} viewBox="0 0 14 14" className={cn("shrink-0", className)} aria-hidden="true">
      {kieu === "xong" ? (
        <>
          <circle cx="7" cy="7" r="6.75" fill="currentColor" />
          <path className="bo-tt-tick" d="M4.3 7.2l1.8 1.8 3.7-3.9" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={kieu === "nhap" ? "2.2 2" : undefined} />
          {kieu === "vong" && tiLe > 0 ? (
            <circle
              cx="7" cy="7" r="2.25" fill="none" stroke="currentColor" strokeWidth="4.5"
              strokeDasharray={`${(tiLe * CHU_VI).toFixed(2)} 20`} transform="rotate(-90 7 7)"
            />
          ) : null}
          {kieu === "huy" ? <path d="M2.9 11.1L11.1 2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : null}
        </>
      )}
    </svg>
  );
}

function Cham({ nhip, kichThuoc, className }) {
  return (
    <svg width={kichThuoc} height={kichThuoc} viewBox="0 0 14 14" className={cn("shrink-0 overflow-visible", className)} aria-hidden="true">
      {nhip ? <circle className="bo-tt-nhip" cx="7" cy="7" r="6.5" fill="currentColor" /> : null}
      <circle cx="7" cy="7" r="3.5" fill="currentColor" />
    </svg>
  );
}

// Mỗi nhãn chưa khai báo chỉ cảnh báo một lần (bảng nhiều dòng không làm ngập console).
const DA_CANH_BAO = new Set();

/** Đọc thêm bước cho trình đọc màn hình (vòng tiến trình chỉ là hình). */
function chuBuoc(viTri) {
  if (!viTri || viTri.kieu !== "vong" || viTri.buoc == null) return null;
  const buoc = Number.isInteger(viTri.buoc) ? `bước ${viTri.buoc}` : `giữa bước ${Math.floor(viTri.buoc)} và ${Math.ceil(viTri.buoc)}`;
  return <span className="sr-only">{`, ${buoc} trên ${viTri.tong}`}</span>;
}

export default function StatusBadge({ label, quyTrinh, doiTuong, nhom, tone, size = "md", className }) {
  const co = CO[size] ?? CO.md;
  const cachVe = layCachVe(label, { nhom, tone, quyTrinh, doiTuong });
  const mau = NHOM_TRANG_THAI[cachVe.nhom];
  const Icon = cachVe.bieuTuong ? BIEU_TUONG[cachVe.bieuTuong] : null;

  if (label == null || label === "") return null;

  if (import.meta.env?.DEV && typeof label === "string" && !nhom && !tone && !nhomCuaNhan(label) && !DA_CANH_BAO.has(label)) {
    DA_CANH_BAO.add(label);
    console.warn(`[StatusBadge] Nhãn "${label}" chưa có trong constants/trangThai.js — đang tô Xám.`);
  }

  if (cachVe.kieu === "khung" || cachVe.kieu === "vien") {
    return (
      <span
        data-nhom={cachVe.nhom}
        className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-semibold", co.khung, mau.khung, className)}
      >
        {Icon ? <Icon className={cn("shrink-0", co.icon)} strokeWidth={2.1} aria-hidden="true" /> : <Cham kichThuoc={co.cham} />}
        {label}
      </span>
    );
  }

  let hinh;
  if (cachVe.kieu === "vong") {
    // Nhãn "chờ" của chứng từ đã vào quy trình (qua bước 0) là đang được xử lý: vòng tô xanh dương, không lùi về xám.
    // Chỉ đổi màu vòng; chữ và nhóm màu của nhãn giữ nguyên.
    const dangChay = cachVe.nhom === "cho" && cachVe.quyTrinh.kieu === "vong" && cachVe.quyTrinh.tiLe > 0;
    hinh = <VongTienTrinh kieu={cachVe.quyTrinh.kieu} tiLe={cachVe.quyTrinh.tiLe} kichThuoc={co.vong} className={dangChay ? NHOM_TRANG_THAI.dang.hinh : mau.hinh} />;
  }
  else if (cachVe.kieu === "bieuTuong" && Icon) hinh = <Icon className={cn("shrink-0", co.iconTron, mau.icon)} strokeWidth={2.1} aria-hidden="true" />;
  else hinh = <Cham nhip={cachVe.kieu === "nhip"} kichThuoc={co.cham} className={mau.hinh} />;

  return (
    <span
      data-nhom={cachVe.nhom}
      className={cn("inline-flex shrink-0 items-center whitespace-nowrap font-semibold", co.tron, mau.chu, className)}
    >
      {hinh}
      {label}
      {cachVe.kieu === "vong" ? chuBuoc(cachVe.quyTrinh) : null}
    </span>
  );
}
