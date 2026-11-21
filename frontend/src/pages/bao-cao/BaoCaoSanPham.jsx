import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ChevronDown, Package, SearchX, Shirt } from "lucide-react";
import { Area, ComposedChart, CartesianGrid, Line, Tooltip, XAxis, YAxis } from "recharts";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import TableShell from "@/components/shared/TableShell";
import ListToolbar from "@/components/shared/ListToolbar";
import StatusTabs from "@/components/shared/StatusTabs";
import StatusBadge from "@/components/shared/StatusBadge";
import SearchInput from "@/components/shared/SearchInput";
import FilterSelect from "@/components/shared/FilterSelect";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { parseRoles } from "@/components/settings/settings.config";
import { laKhoAo } from "@/pages/warehouse/loaiKho";
import { khoService, getMineKhoList } from "@/services/khoService";
import { baoCaoSanPhamService } from "@/services/baoCaoSanPhamService";
import { MAU2 } from "@/pages/dashboard/admin/tong-quan-moi/mau";
import NutXuatExcel from "@/components/shared/NutXuatExcel";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/thongBaoNhanh";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { MOC_NGAY, khoangMoc, ngayMay, ngayVN } from "./tinhBaoCaoDoanhThu";
import {
  N, NHOM, TINH_TRANG, boLocTuUrl, chuoiBoLocUrl, demNhom, doiHang, ghiBoLocLenUrl, khongPhanLoai, locNhom, loiKhoang, maTran, oSapHet,
  tenTepExcel, timKiem, tyLeTang, xep,
} from "./tinhBaoCaoSanPham";
import { t, tDuLieu } from "@/i18n";

/*
 * Báo cáo sản phẩm (bố cục như Báo cáo tồn kho, mẫu 2 chốt 05/11/2026):
 * - Một hàng: tab nhóm (Tất cả / Có bán / Sắp hết hàng / Dư hàng / Không bán), kỳ, kho, kênh, tìm kiếm.
 * - Bảng theo sản phẩm, bấm "Chi tiết" mở ma trận màu × size (bán / còn), tỷ trọng kênh, bán mỗi ngày.
 * - Chân bảng: dòng tổng của nhóm đang xem, phân trang, giờ cập nhật. Xuất Excel do máy chủ dựng (cùng số với màn).
 * - Tab, kỳ, kho, kênh nằm trên đường dẫn (?nhom, ?ky | ?tu&den, ?kho, ?kenh): thẻ Bán chạy ở Tổng quan mở đúng kỳ và kho.
 * - Dòng phụ ghi hạng theo số lượng kèm lên / xuống so với kỳ trước (FO-091 bảng xếp hạng bán chạy).
 * Số bán tính như Báo cáo doanh thu (ngày giao hàng, đơn đã xuất / hoàn thành); so với kỳ liền trước cùng số ngày.
 */

const TH = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const O_NGAY = "h-9 min-w-0 rounded-md border border-bo-border bg-white px-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";
const SAP_HET = 14;

const loiCua = (e) => e?.response?.data?.message || e?.message || "";
// Chữ thay thế máy chủ điền khi trống (BaoCaoSanPhamService, Excel dùng chung nên máy chủ giữ tiếng Việt) → dịch; tên thật giữ nguyên
const tenDanhMuc = (p) => (p.danhMuc === "Chưa phân loại" ? t("Chưa phân loại") : p.danhMuc);
const tenThuongHieu = (p) => (p.thuongHieu === "Chưa gắn" ? t("Chưa gắn", { context: "thuong_hieu" }) : p.thuongHieu);

function SoVoi({ nay, truoc }) {
  // Số bán âm: kỳ chỉ có hàng khách trả (hàng bán ở kỳ trước), "giảm 133%" không có nghĩa — nói rõ lý do số âm
  if (N(nay) < 0) return <span className="text-bo-muted">{t("chỉ có hàng trả")}</span>;
  const tt = tyLeTang(nay, truoc);
  if (tt == null) return N(nay) ? <span className="text-bo-muted">{t("mới bán")}</span> : null;
  const tang = tt >= 0;
  return (
    <span className={cn("font-medium", tang ? "text-bo-success" : "text-bo-danger")}>
      <span aria-hidden="true">{tang ? "▲" : "▼"}</span>
      <span className="sr-only">{tang ? t("Tăng") : t("Giảm")}</span> {formatPercent(Math.abs(tt))}
    </span>
  );
}

/**
 * Đủ bán bao nhiêu ngày: dưới 7 đỏ, dưới 14 cam; hết hàng mà có bán thì "đã hết". So ngưỡng trên số máy chủ gửi (cùng
 * phép so của nhãn tình trạng), số hiện ra làm tròn xuống: 13,7 ngày là "13 ngày" màu cam, khớp nhãn Sắp hết hàng.
 */
function DuBan({ p }) {
  if (p.duBanNgay == null) return <span className="text-bo-muted">{N(p.khaDung) ? t("không bán") : "—"}</span>;
  if (!N(p.khaDung)) return <span className="font-semibold text-bo-danger">{t("đã hết")}</span>;
  const d = N(p.duBanNgay);
  const n = Math.floor(d);
  return (
    <span className={cn("whitespace-nowrap", d < 7 ? "font-semibold text-bo-danger" : d < SAP_HET ? "font-semibold text-bo-warning" : "text-slate-700")}>
      {d < 1 ? t("dưới 1 ngày") : n > 365 ? t("hơn 1 năm") : t("{{n}} ngày", { n: formatNumber(n) })}
    </span>
  );
}

/** "Hạng 3 ▲2 · " ở dòng phụ: hạng theo số lượng bán, kèm lên / xuống so với kỳ trước, "mới vào" khi kỳ trước không bán. */
function Hang({ p, coBanKyTruoc }) {
  if (!p.hang) return null;
  const d = doiHang(p.hang, p.hangTruoc, coBanKyTruoc);
  const truoc = p.hangTruoc ? t("Kỳ trước hạng {{hangTruoc}}", { hangTruoc: p.hangTruoc }) : t("Kỳ trước không bán");
  let doi = null;
  if (d?.loai === "len" || d?.loai === "xuong") {
    const len = d.loai === "len";
    doi = (
      <span className={cn("font-medium", len ? "text-bo-success" : "text-bo-danger")} title={truoc}>
        <span aria-hidden="true">{len ? "▲" : "▼"}{d.so}</span>
        <span className="sr-only">{len ? t(" (lên {{so}} hạng so với kỳ trước)", { so: d.so, count: d.so }) : t(" (xuống {{so}} hạng so với kỳ trước)", { so: d.so, count: d.so })}</span>
      </span>
    );
  } else if (d?.loai === "moi") {
    doi = <span className="font-medium text-bo-primary" title={truoc}>{t("mới vào")}</span>;
  }
  return <>{t("Hạng {{hang}}", { hang: p.hang })}{doi ? <>{" "}{doi}</> : null} · </>;
}

function TinhTrang({ ma }) {
  const tt = TINH_TRANG[ma];
  return tt ? <StatusBadge label={tt.label} nhom={tt.nhom} /> : null;
}

function Anh({ p, co = "size-12" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bo-border bg-slate-100", co)}>
      {p.anh ? <img src={p.anh} alt="" loading="lazy" className="size-full object-cover" /> : <Package className="size-5 text-slate-300" aria-hidden="true" />}
    </span>
  );
}

/**
 * Đường bán theo ngày trong ô bảng. Kỳ một ngày: vẽ đường ngang. Ngày có hàng trả tại quầy nhiều hơn hàng bán thì số
 * âm: trục kéo xuống dưới 0, vùng tô tính từ mức 0.
 */
function DuongNho({ arr }) {
  const w = 96, h = 28;
  let ds = (arr ?? []).map(N);
  if (!ds.length) return null;
  if (ds.length === 1) ds = [ds[0], ds[0]];
  const max = Math.max(1, ...ds), min = Math.min(0, ...ds);
  const y = (v) => (h - 3 - ((v - min) / (max - min)) * (h - 6)).toFixed(1);
  const dx = w / (ds.length - 1);
  const d = ds.map((v, i) => `${i ? "L" : "M"}${(i * dx).toFixed(1)} ${y(v)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden="true">
      <path d={`${d} L${w} ${y(0)} L0 ${y(0)} Z`} fill={MAU2.nenVung} />
      <path d={d} fill="none" stroke={MAU2.chinh} strokeWidth="1.5" />
    </svg>
  );
}

/** Chú thích khi rê chuột của một ô / một mã: "SKU: bán 5, còn 12", ô gộp nhiều mã thì mỗi mã một dòng. */
const moTaMa = (ds) => ds.map((b) => t("{{maSku}}: bán {{ban}}, còn {{con}}", { maSku: b.maSku, ban: formatNumber(N(b.soLuong)), con: formatNumber(N(b.khaDung)) })).join("\n");

/** Chú thích dưới ma trận / danh sách mã: mức đậm theo số bán, viền đỏ khi còn dưới 7 ngày bán. */
function ChuThichMaTran() {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bo-muted">
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[3px]" style={{ background: "rgba(13, 97, 228, 0.38)" }} aria-hidden="true" />{t("đậm = bán nhiều")}</span>
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[3px] bg-white ring-1 ring-inset ring-red-300" aria-hidden="true" />{t("còn dưới 7 ngày bán")}</span>
    </p>
  );
}

/** Ô bán / còn của ma trận (hoặc một mã): số bán đậm theo mức bán, viền đỏ và chữ cho trình đọc màn hình khi sắp hết. */
function OBanCon({ o, max, as = "td", className }) {
  const Tag = as;
  const ban = N(o.soLuong), con = N(o.khaDung);
  const thieu = oSapHet(o);
  return (
    <Tag title={moTaMa(o.dong)}
      className={cn("h-10 min-w-[56px] whitespace-nowrap rounded-md px-1.5 text-center leading-tight", thieu && "ring-1 ring-inset ring-red-300", className)}
      style={{ background: ban > 0 ? `rgba(13, 97, 228, ${(0.06 + (ban / max) * 0.32).toFixed(2)})` : "#f8fafc" }}>
      <b className={cn("block text-[13px]", ban > 0 ? "text-bo-foreground" : "font-normal text-bo-muted")}>{formatNumber(ban)}</b>
      <span className={cn("block text-[11px]", thieu ? "font-semibold text-bo-danger" : "text-bo-muted")}>{t("còn {{con}}", { con: formatNumber(con) })}</span>
      {thieu ? <span className="sr-only">{t(" (còn dưới 7 ngày bán)")}</span> : null}
      {o.dong.length > 1 ? <span className="sr-only">{`: ${moTaMa(o.dong)}`}</span> : null}
    </Tag>
  );
}

function MaTran({ p }) {
  const m = useMemo(() => maTran(p.bienThe), [p.bienThe]);
  if (!m.mau.length) return <p className="text-[13px] text-bo-muted">{t("Các mã SKU của sản phẩm đã ngừng và không còn hàng.")}</p>;
  // Sản phẩm không chia màu, size: ma trận chỉ còn một ô "—" khó hiểu, liệt kê từng mã
  if (khongPhanLoai(p.bienThe)) {
    return (
      <div>
        <ul className="flex max-w-[320px] flex-col gap-1.5">
          {p.bienThe.map((b) => (
            <li key={b.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[13px] text-bo-foreground" title={b.maSku}>{b.maSku}</span>
              <OBanCon as="span" className="inline-block" o={{ dong: [b], soLuong: b.soLuong, khaDung: b.khaDung, duBanNgay: b.duBanNgay }} max={m.max} />
            </li>
          ))}
        </ul>
        <ChuThichMaTran />
      </div>
    );
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs tabular-nums">
          <thead>
            <tr>
              {/* Cột màu dính bên trái khi ma trận nhiều size phải cuộn ngang (điện thoại) */}
              <th scope="col" className="sticky left-0 z-[1] bg-[#fbfcfd]"><span className="sr-only">{t("Màu")}</span></th>
              {m.size.map((s) => <th key={s} scope="col" className="px-1 text-center font-medium text-bo-muted">{s}</th>)}
              <th scope="col" className="pl-2 text-right font-medium text-bo-muted">{t("Cộng")}</th>
            </tr>
          </thead>
          <tbody>
            {m.mau.map((mau) => {
              const dong = m.size.map((s) => m.o(mau.ten, s));
              return (
                <tr key={mau.ten}>
                  <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-[#fbfcfd] pr-2 text-left font-normal text-bo-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {/* Mã không có màu ("—"): không vẽ chấm, kẻo trông như một màu xám thật */}
                      {mau.ten !== "—" ? <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: mau.hex || "#cbd5e1" }} aria-hidden="true" /> : null}
                      {mau.ten}
                    </span>
                  </th>
                  {dong.map((o, j) => (o
                    ? <OBanCon key={m.size[j]} o={o} max={m.max} />
                    : <td key={m.size[j]} className="h-10 min-w-[56px] rounded-md bg-bo-surface-subtle text-center text-bo-muted"><span aria-hidden="true">·</span><span className="sr-only">{t("Không có mã")}</span></td>))}
                  <td className="pl-2 text-right font-semibold">{formatNumber(dong.reduce((a, o) => a + (o ? o.soLuong : 0), 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ChuThichMaTran />
    </div>
  );
}

function TyTrongKenh({ ds }) {
  const tong = ds.reduce((a, d) => a + N(d.soLuong), 0) || 1;
  if (!ds.length) return <p className="text-[13px] text-bo-muted">{t("Không bán trong kỳ.")}</p>;
  return (
    <ul className="flex flex-col gap-2.5 text-sm">
      {ds.map((d) => (
        <li key={d.ten} className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-3">
          <span className="truncate text-bo-foreground" title={t("{{soLuong}} sản phẩm · {{doanhThu}}", { soLuong: formatNumber(d.soLuong), doanhThu: formatCurrency(d.doanhThu), count: N(d.soLuong) })}>{tDuLieu(d.ten) /* tên kênh: "Bán tại quầy", "Đơn bán trực tiếp" do máy chủ đặt thì dịch, tên sàn người dùng đặt giữ nguyên */}</span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-[#eef1f5]" aria-hidden="true">
            <span className="block h-full rounded-full bg-bo-primary" style={{ width: `${(N(d.soLuong) / tong) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-bo-muted">{formatPercent(N(d.soLuong) / tong, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

function BieuDoNgay({ p, tuNgay }) {
  const rows = useMemo(() => {
    const dau = new Date(`${tuNgay}T00:00:00`);
    return (p.theoNgay ?? []).map((v, i) => {
      const d = new Date(dau);
      d.setDate(d.getDate() + i);
      return { nhan: `${d.getDate()}/${d.getMonth() + 1}`, sl: N(v) };
    });
  }, [p.theoNgay, tuNgay]);
  if (!rows.length) return <p className="text-[13px] text-bo-muted">{t("Không bán trong kỳ.")}</p>;
  return (
    <div className="h-[150px]">
      <KhungBieuDo>
        <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={MAU2.luoi} vertical={false} />
          <XAxis dataKey="nhan" tick={{ fill: MAU2.chu, fontSize: 12 }} tickLine={false} axisLine={{ stroke: MAU2.truc }} interval="preserveStartEnd" minTickGap={24} tickMargin={6} />
          <YAxis allowDecimals={false} tick={{ fill: MAU2.chu, fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip isAnimationActive={false} formatter={(v) => [t("{{soLuong}} sản phẩm", { soLuong: formatNumber(v), count: v }), t("Đã bán")]} labelFormatter={(l) => t("Ngày {{l}}", { l })}
            contentStyle={{ borderRadius: 8, borderColor: "#e1e6ec", fontSize: 12 }} />
          {/* Lớp nền chỉ để tô vùng: không vào ô gợi ý, không chấm khi rê chuột (đường Line đã có) */}
          <Area dataKey="sl" type="linear" stroke="none" fill={MAU2.nenVung} tooltipType="none" activeDot={false} isAnimationActive={false} />
          {/* Kỳ một ngày chỉ có một điểm: không có đoạn nào để vẽ, hiện chấm cho thấy số */}
          <Line dataKey="sl" type="linear" stroke={MAU2.chinh} strokeWidth={2} dot={rows.length === 1 ? { r: 4, fill: MAU2.chinh } : false} isAnimationActive={false} />
        </ComposedChart>
      </KhungBieuDo>
    </div>
  );
}

function ChiTietMoRong({ p, bc }) {
  // Bình quân một ngày chia cho số ngày bán của máy chủ (hàng về giữa kỳ: từ ngày về), cùng số với cột Đủ bán
  const soNgayBan = N(p.soNgayBan) || bc.soNgay;
  const binhQuan = N(p.soLuong) / soNgayBan;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h3 className="mb-2 text-xs font-semibold text-bo-muted">
          {khongPhanLoai(p.bienThe) ? t("Theo mã SKU · bán / còn khả dụng") : t("Theo màu và size · bán / còn khả dụng")}
        </h3>
        <MaTran p={p} />
      </div>
      <div className="min-w-0">
        <h3 className="mb-2.5 text-xs font-semibold text-bo-muted">{t("Theo kênh bán")}</h3>
        <TyTrongKenh ds={p.theoKenh ?? []} />
        <p className="mt-4 text-xs text-bo-muted">
          {N(p.soDon) ? t("{{soDon}} đơn · ", { soDon: formatNumber(p.soDon), count: N(p.soDon) }) : ""}
          {N(p.soLuongHoan) ? t("{{soLuongHoan}} hoàn · ", { soLuongHoan: formatNumber(p.soLuongHoan) }) : ""}
          {p.ngayBanCuoi ? t("bán gần nhất {{ngayBanCuoi}}", { ngayBanCuoi: ngayVN(p.ngayBanCuoi) }) : t("chưa từng bán")}
        </p>
      </div>
      <div className="min-w-0">
        <h3 className="mb-1 text-xs font-semibold text-bo-muted">
          {t("Bán mỗi ngày")}
          {binhQuan > 0 ? t(" · bình quân {{binhQuan}} sản phẩm/ngày", { binhQuan: binhQuan.toLocaleString("vi-VN", { maximumFractionDigits: 1 }), count: Math.round(binhQuan * 10) / 10 }) : ""}
          {binhQuan > 0 && soNgayBan < bc.soNgay ? t(" ({{n}} ngày từ khi hàng về)", { n: soNgayBan, count: soNgayBan }) : ""}
        </h3>
        <BieuDoNgay p={p} tuNgay={bc.tuNgay} />
      </div>
    </div>
  );
}

function SummaryItem({ label, value, valueClass = "text-bo-foreground" }) {
  return (
    <div className="flex items-baseline gap-2 max-md:justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wide text-bo-muted">{label}:</span>
      <span className={cn("text-sm font-bold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
const Vach = () => <span className="h-4 w-px bg-bo-border max-md:hidden" aria-hidden="true" />;

/** Kỳ mặc định (30 ngày qua) đứng đầu: ô lọc coi lựa chọn đầu là "chưa lọc" (chip trên điện thoại, nút ×). */
const MOC_KY = [...MOC_NGAY.filter((m) => m.value === "30"), ...MOC_NGAY.filter((m) => m.value !== "30")];

const NUT_MO = "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-bo-border bg-bo-surface px-2.5 text-xs font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";

export default function BaoCaoSanPham() {
  const coQuyenXuat = useCoQuyenXuatBaoCao();
  const vaiTro = parseRoles(localStorage.getItem("role"));
  const laQtv = vaiTro.includes("quan_tri_vien");
  // Xuất Excel Báo cáo sản phẩm: máy chủ chỉ cho quản trị viên, quản lý kho (nhân viên bán hàng có quyền Xuất báo cáo để
  // tải Báo cáo tồn kho vẫn không xuất được ở đây)
  const xuatDuoc = coQuyenXuat && (laQtv || vaiTro.includes("quan_ly_kho"));
  const [nhom, setNhom] = useTabTrenUrl(NHOM.map((n) => n.value), "tat-ca", { ten: "nhom" });
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // Bộ lọc mở sẵn từ đường dẫn (vd. "Xem tất cả" ở Tổng quan mang theo kỳ, kho); giá trị lạ thì về mặc định
  const [dau] = useState(() => boLocTuUrl(searchParams));
  const [boLoc, datBoLoc] = useState(dau);
  const setBoLoc = useCallback((x) => datBoLoc((cu) => ({ ...cu, ...x })), []);
  const [tuKhoa, setTuKhoa] = useState("");
  const [theo, setTheo] = useState("sl");
  const [mo, setMo] = useState(() => new Set());
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const [dsKho, setDsKho] = useState([]);
  const [kq, setKq] = useState({ data: null, khoa: null, loading: true, loi: null, luc: null });
  // Hai ô ngày của kỳ tùy chọn: giữ bản nhập riêng, chỉ đưa lên bộ lọc khi hợp lệ (báo lỗi dưới ô, không gọi máy chủ)
  const [nhapKhoang, setNhapKhoang] = useState(dau.khoang);
  const [lan, setLan] = useState(0);
  // Danh sách kho: "dang" (đang tải), "xong", "loi" (không tải được: giữ kho đang lọc, để máy chủ tự kiểm quyền)
  const [taiKho, setTaiKho] = useState("dang");
  const [khoBiBo, setKhoBiBo] = useState(0);

  // Kho cho bộ lọc: quản trị viên mọi kho; quản lý kho các kho mình phụ trách. Bỏ kho ảo, kho ngừng hoạt động.
  useEffect(() => {
    let huy = false;
    const tai = laQtv ? khoService.getAllKho().then((body) => body?.data?.content ?? []) : getMineKhoList();
    tai.then((ds) => {
      if (huy) return;
      setDsKho(ds.filter((k) => !laKhoAo(k) && Number(k.trangThai ?? 1) === 1));
      setTaiKho("xong");
    }).catch(() => { if (!huy) setTaiKho("loi"); });
    return () => { huy = true; };
  }, [laQtv]);

  // Đường dẫn đổi mà không do trang tự ghi (nút Quay lại / Tiến, bấm lại mục menu): đọc lại kỳ, kho, kênh từ đường dẫn
  const urlLoc = chuoiBoLocUrl(searchParams);
  const [urlDaThay, setUrlDaThay] = useState(urlLoc);
  if (urlLoc !== urlDaThay) {
    setUrlDaThay(urlLoc);
    if (urlLoc !== chuoiBoLocUrl(ghiBoLocLenUrl(new URLSearchParams(), boLoc))) {
      const moi = boLocTuUrl(searchParams);
      datBoLoc(moi);
      setNhapKhoang(moi.khoang);
    }
  }

  // Kho (từ đường dẫn) không nằm trong các kho được xem: bỏ lọc kho, báo một dòng, không để máy chủ trả 403
  if (taiKho === "xong" && boLoc.khoId && !dsKho.some((k) => String(k.id) === boLoc.khoId)) {
    setBoLoc({ khoId: "" });
    setKhoBiBo((n) => n + 1);
  }
  useEffect(() => {
    if (khoBiBo) toast.info(t("Không xem được kho trong đường dẫn, đang hiện {{phamVi}}.", { phamVi: laQtv ? t("tất cả kho") : t("nơi làm việc của bạn") }), { id: "bcsp-kho" });
  }, [khoBiBo, laQtv]);
  // Đang lọc một kho mà danh sách kho chưa về: chờ kiểm xong rồi mới tải số
  const choKho = Boolean(boLoc.khoId) && taiKho === "dang";

  // Bộ lọc ghi lên đường dẫn (thay mục lịch sử hiện tại): F5, quay lại từ trang sản phẩm, gửi link đều giữ kỳ, kho, kênh
  useEffect(() => {
    const moi = ghiBoLocLenUrl(searchParams, boLoc);
    if (moi.toString() !== searchParams.toString()) setSearchParams(moi, { replace: true, state: location.state });
  }, [boLoc, searchParams, setSearchParams, location.state]);

  const thamSo = useMemo(() => ({ ...boLoc.khoang, khoId: boLoc.khoId, kenh: boLoc.kenh }), [boLoc.khoang, boLoc.khoId, boLoc.kenh]);
  const khoa = JSON.stringify(thamSo);

  useEffect(() => {
    if (choKho) return undefined;
    const ctrl = new AbortController();
    const k = JSON.stringify(thamSo);
    queueMicrotask(() => { if (!ctrl.signal.aborted) setKq((cu) => ({ ...cu, loading: true, loi: null })); });
    baoCaoSanPhamService.lay(thamSo, { signal: ctrl.signal })
      .then((d) => { if (!ctrl.signal.aborted) setKq({ data: d, khoa: k, loading: false, loi: null, luc: new Date() }); })
      // Giữ lỗi gốc (loiGoc) để ô lỗi phân biệt 403 (không có quyền: không "Thử lại")
      .catch((e) => { if (!ctrl.signal.aborted) setKq((cu) => ({ ...cu, loading: false, loi: loiCua(e) || t("Không tải được báo cáo"), loiGoc: e })); });
    return () => ctrl.abort();
  }, [thamSo, lan, choKho]);

  // Đổi bộ lọc / tab / tìm kiếm thì về trang đầu (đặt lại ngay lúc dựng, không qua effect)
  const [locTruoc, setLocTruoc] = useState({ thamSo, nhom, tuKhoa, theo });
  if (locTruoc.thamSo !== thamSo || locTruoc.nhom !== nhom || locTruoc.tuKhoa !== tuKhoa || locTruoc.theo !== theo) {
    setLocTruoc({ thamSo, nhom, tuKhoa, theo });
    setTrang(0);
  }

  const chon = (moc) => {
    const k = khoangMoc(moc, new Date(), boLoc.khoang);
    setNhapKhoang(k);
    setBoLoc({ moc, khoang: k });
  };
  const doiNgay = (x) => {
    const moi = { ...nhapKhoang, ...x };
    setNhapKhoang(moi);
    if (!loiKhoang(moi.tuNgay, moi.denNgay)) setBoLoc({ khoang: moi });
  };
  // Ô ngày đổi. Bấm × ở chip "Từ ngày …" / "Đến ngày …" trên điện thoại: ListToolbar gọi onChange bằng sự kiện giả (không
  // có nativeEvent) với giá trị rỗng → bỏ kỳ tùy chọn, về 30 ngày qua (không thì chip mất mà bảng vẫn lọc khoảng cũ, câu
  // lỗi nằm trong sheet đang đóng). Xóa ô ngày trên máy tính vẫn báo lỗi ngay dưới ô như cũ.
  const doiONgay = (truong) => (e) => {
    if (!e.nativeEvent && !e.target.value) chon("30");
    else doiNgay({ [truong]: e.target.value });
  };
  const loiNgay = boLoc.moc === "tuy-chon" ? loiKhoang(nhapKhoang.tuNgay, nhapKhoang.denNgay) : "";

  // Số trên màn chỉ dùng khi đúng bộ lọc đang chọn: đổi kho / kênh / kỳ thì chờ số mới, không hiện số cũ dưới bộ lọc mới
  const dungBoLoc = kq.khoa === khoa;
  const bc = dungBoLoc ? kq.data : null;
  // Kênh lấy từ đường dẫn mà không có trong danh sách kênh (sai id, kênh không còn đơn): bỏ lọc kênh
  if (bc && boLoc.kenh && !(bc.dsKenh ?? []).some((k) => k.ma === boLoc.kenh)) setBoLoc({ kenh: "" });
  const coBanKyTruoc = N(bc?.tong?.soSanPhamCoBanTruoc) > 0;
  const ds = useMemo(() => bc?.sanPham ?? [], [bc]);
  const dem = useMemo(() => demNhom(timKiem(ds, tuKhoa)), [ds, tuKhoa]);
  const dong = useMemo(() => xep(locNhom(timKiem(ds, tuKhoa), nhom), theo), [ds, tuKhoa, nhom, theo]);
  const soTrang = Math.max(1, Math.ceil(dong.length / soDong));
  const trangAnToan = Math.min(trang, soTrang - 1);
  const trangDong = dong.slice(trangAnToan * soDong, trangAnToan * soDong + soDong);
  const cong = (k) => dong.reduce((a, p) => a + N(p[k]), 0);
  const tabs = NHOM.map((n) => ({ value: n.value, label: n.label, count: bc && !kq.loading ? dem[n.value] : null, tone: n.tone }));

  // Tên kênh máy chủ đặt ("Bán tại quầy", "Đơn bán trực tiếp") thì dịch, tên kênh sàn người dùng đặt giữ nguyên
  const dsKenh = [{ value: "", label: t("Tất cả kênh") }, ...(kq.data?.dsKenh ?? []).map((k) => ({ value: k.ma, label: tDuLieu(k.ten) }))];
  const dsKhoChon = [{ value: "", label: laQtv ? t("Tất cả kho") : t("Tất cả nơi làm việc") }, ...dsKho.map((k) => ({ value: String(k.id), label: k.tenKho }))];
  // Không tải được danh sách kho mà đường dẫn đang lọc một kho: số vẫn theo kho đó, ô Kho ghi rõ thay vì hiện "Tất cả kho"
  if (taiKho === "loi" && boLoc.khoId) dsKhoChon.push({ value: boLoc.khoId, label: t("Kho #{{id}}", { id: boLoc.khoId }) });
  // Người không phải quản trị viên chỉ có một kho: bỏ ô Kho (hai lựa chọn như nhau), đầu trang ghi "Kho: <tên>" (PQ-17)
  const motKho = !laQtv && taiKho === "xong" && dsKho.length === 1 ? dsKho[0] : null;
  // Kho đang ẩn ô lọc (một kho) không tính là đang lọc, kẻo hiện nút Xóa lọc mà không thấy ô nào để xóa
  const coLoc = Boolean(tuKhoa) || (Boolean(boLoc.khoId) && !motKho) || Boolean(boLoc.kenh) || boLoc.moc !== "30";
  const xoaLoc = () => { setTuKhoa(""); setNhapKhoang(khoangMoc("30")); setBoLoc({ moc: "30", khoang: khoangMoc("30"), khoId: "", kenh: "" }); };
  const homNay = ngayMay(new Date());
  const doiMo = (id) => setMo((c) => { const m = new Set(c); if (m.has(id)) m.delete(id); else m.add(id); return m; });


  // Nhân viên bán hàng: máy chủ không gửi giá vốn / lợi nhuận (coGiaVon = false) nên bỏ cột Lợi nhuận gộp (FO-090)
  const coGiaVon = bc?.coGiaVon !== false;
  const cot = coGiaVon ? [["sl", t("Đã bán")], ["dt", t("Doanh thu")], ["ln", t("Lợi nhuận gộp")]] : [["sl", t("Đã bán")], ["dt", t("Doanh thu")]];
  const capNhat = { thoiDiem: kq.luc, dangTai: kq.loading, loi: kq.loi, taiLai: () => setLan((n) => n + 1) };

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        scope={motKho ? t("Kho: {{tenKho}}", { tenKho: motKho.tenKho }) : null}
        actions={xuatDuoc ? (
          <NutXuatExcel taiTep={() => baoCaoSanPhamService.xuatExcel(thamSo)} tenTep={() => tenTepExcel(thamSo)} disabled={!bc} />
        ) : null}
      />

      <TableShell
        fill
        toolbar={(
          <ListToolbar tabs={<StatusTabs label={t("Nhóm sản phẩm")} tabs={tabs} value={nhom} onChange={(v) => setNhom(v)} />} hasFilter={coLoc} onClear={xoaLoc}>
            <FilterSelect label={t("Kỳ")} value={boLoc.moc} options={MOC_KY} className="sm:w-[170px]" onChange={chon} onClear={() => chon("30")} clearLabel={t("Về 30 ngày qua")} />
            {/* Kỳ tùy chọn: mỗi ô ngày một label (điện thoại: vào sheet Bộ lọc, chip ghi rõ ngày) */}
            {boLoc.moc === "tuy-chon" ? (
              <label className="flex items-center">
                <input aria-label={t("Từ ngày")} type="date" className={O_NGAY} value={nhapKhoang.tuNgay} min="2000-01-01" max={nhapKhoang.denNgay || homNay}
                  aria-invalid={loiNgay ? true : undefined} aria-describedby={loiNgay ? "bcsp-loi" : undefined} onChange={doiONgay("tuNgay")} />
              </label>
            ) : null}
            {boLoc.moc === "tuy-chon" ? (
              <label className="flex !h-auto flex-col items-start gap-1">
                <input aria-label={t("Đến ngày")} type="date" className={O_NGAY} value={nhapKhoang.denNgay} min={nhapKhoang.tuNgay || "2000-01-01"} max={homNay}
                  aria-invalid={loiNgay ? true : undefined} aria-describedby={loiNgay ? "bcsp-loi" : undefined} onChange={doiONgay("denNgay")} />
                {loiNgay ? <span id="bcsp-loi" role="alert" className="text-xs text-bo-danger">{loiNgay}</span> : null}
              </label>
            ) : null}
            {!motKho ? (
              <FilterSelect label={t("Kho")} value={boLoc.khoId} options={dsKhoChon} className="sm:w-[180px]" onChange={(v) => setBoLoc({ khoId: v })} onClear={() => setBoLoc({ khoId: "" })} clearLabel={t("Bỏ lọc kho")} />
            ) : null}
            <FilterSelect label={t("Kênh bán")} value={boLoc.kenh} options={dsKenh} className="sm:w-[170px]" onChange={(v) => setBoLoc({ kenh: v })} onClear={() => setBoLoc({ kenh: "" })} clearLabel={t("Bỏ lọc kênh")} />
            <SearchInput label={t("Tìm sản phẩm")} placeholder={t("Mã SP, SKU, tên sản phẩm...")} value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} onClear={() => setTuKhoa("")} className="sm:w-[260px]" />
          </ListToolbar>
        )}
        footer={bc ? (
          <div className="flex flex-col gap-3">
            {dong.length ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 max-md:grid max-md:gap-y-1">
                <SummaryItem label={t("Đã bán")} value={formatNumber(cong("soLuong"))} />
                <Vach />
                <SummaryItem label={t("Doanh thu")} value={formatCurrency(cong("doanhThu"))} valueClass="text-bo-success" />
                <Vach />
                {coGiaVon ? (
                  <>
                    <SummaryItem label={t("Lợi nhuận gộp")} value={formatCurrency(cong("loiNhuan"))} />
                    <Vach />
                  </>
                ) : null}
                <SummaryItem label={t("Hoàn")} value={formatNumber(cong("soLuongHoan"))} valueClass={cong("soLuongHoan") ? "text-bo-danger" : "text-bo-foreground"} />
                <Vach />
                <SummaryItem label={t("Kỳ")} value={t("{{tuNgay}} – {{denNgay}}, so với {{tuNgayTruoc}} – {{denNgayTruoc}}", { tuNgay: ngayVN(bc.tuNgay), denNgay: ngayVN(bc.denNgay), tuNgayTruoc: ngayVN(bc.tuNgayTruoc), denNgayTruoc: ngayVN(bc.denNgayTruoc) })} />
              </div>
            ) : null}
            <TablePagination page={trangAnToan} size={soDong} total={dong.length} onPageChange={setTrang} onSizeChange={(s) => { setSoDong(s); setTrang(0); }} capNhat={capNhat} />
          </div>
        ) : null}
      >
        {!bc && !kq.loi ? (
          <LoadingState label={t("Đang tải báo cáo sản phẩm")} />
        ) : !bc ? (
          <ErrorState description={kq.loi} error={kq.loiGoc} onRetry={() => setLan((n) => n + 1)} />
        ) : !dong.length ? (
          tuKhoa ? (
            <EmptyState icon={SearchX} title={t("Không tìm thấy sản phẩm phù hợp")} description={t("Thử từ khóa khác, hoặc xóa lọc để xem mọi sản phẩm.")}
              action={<button type="button" className={NUT_MO} onClick={() => setTuKhoa("")}>{t("Xóa tìm kiếm")}</button>} />
          ) : nhom !== "tat-ca" ? (
            <EmptyState icon={Shirt} title={t("Không có sản phẩm nào ở nhóm \"{{label}}\"", { label: NHOM.find((n) => n.value === nhom)?.label })} description={t("Chọn tab Tất cả để xem mọi sản phẩm trong kỳ.")}
              action={<button type="button" className={NUT_MO} onClick={() => setNhom("tat-ca")}>{t("Xem tất cả")}</button>} />
          ) : (
            <EmptyState icon={Shirt} title={t("Chưa có sản phẩm")} description={t("Thêm sản phẩm ở màn Sản phẩm để theo dõi số bán.")} />
          )
        ) : (
          <>
            {/* Điện thoại: mỗi sản phẩm một thẻ */}
            <ul className="divide-y divide-bo-border md:hidden">
              {trangDong.map((p) => {
                const dangMo = mo.has(p.id);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Anh p={p} co="size-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/products/${p.id}`} className="line-clamp-2 min-w-0 font-semibold leading-5 text-bo-foreground">{p.tenSanPham}</Link>
                          <TinhTrang ma={p.tinhTrang} />
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-bo-muted"><Hang p={p} coBanKyTruoc={coBanKyTruoc} />{p.maSanPham} · {tenDanhMuc(p)}</p>
                      </div>
                    </div>
                    {/* Cột chia theo độ dài số: Doanh thu ("123,4 triệu ₫") và Đủ bán ("dưới 1 ngày") rộng hơn Đã bán, Khả dụng,
                        kẻo bốn cột bằng nhau ở khổ 375px cắt mất chữ */}
                    <dl className="mt-2.5 grid grid-cols-[0.7fr_1.3fr_0.8fr_1.2fr] gap-1 rounded-lg bg-bo-surface-subtle px-2 py-2 text-center">
                      {[[t("Đã bán"), formatNumber(p.soLuong)], [t("Doanh thu"), formatCurrencyCompact(p.doanhThu)], [t("Khả dụng"), formatNumber(p.khaDung)], [t("Đủ bán"), <DuBan key="d" p={p} />]].map(([nhan, gt]) => (
                        <div key={nhan} className="min-w-0">
                          <dt className="truncate text-[11px] leading-4 text-bo-muted">{nhan}</dt>
                          <dd className="truncate text-[14px] font-semibold leading-6 tabular-nums">{gt}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 flex min-h-9 items-center justify-between gap-3 text-[13px]">
                      <span className="text-bo-muted"><SoVoi nay={p.soLuong} truoc={p.soLuongTruoc} />{N(p.soLuongTruoc) ? t(" so với kỳ trước") : ""}</span>
                      <button type="button" className={cn(NUT_MO, "h-9")} aria-expanded={dangMo} aria-label={dangMo ? t("Thu gọn chi tiết {{ten}}", { ten: p.tenSanPham }) : t("Xem chi tiết {{ten}}", { ten: p.tenSanPham })} onClick={() => doiMo(p.id)}>
                        {t("Chi tiết")}<ChevronDown className={cn("size-3.5 transition-transform", dangMo && "rotate-180")} aria-hidden="true" />
                      </button>
                    </div>
                    {dangMo ? <div className="mt-3 rounded-lg border border-bo-border bg-[#fbfcfd] p-3"><ChiTietMoRong p={p} bc={bc} /></div> : null}
                  </li>
                );
              })}
            </ul>

            <table className="w-full min-w-[1220px] text-sm max-md:hidden">
              <thead className="sticky top-0 z-10 bg-bo-surface-subtle">
                <tr className="border-b border-bo-border">
                  <th scope="col" className={cn(TH, "w-12 text-center")}>{t("STT")}</th>
                  <th scope="col" className={cn(TH, "w-[72px] text-left")}>{t("Hình ảnh")}</th>
                  <th scope="col" className={cn(TH, "text-left")}>{t("Sản phẩm")}</th>
                  {cot.map(([k, tt]) => (
                    <th key={k} scope="col" className={cn(TH, "text-right")} aria-sort={theo === k ? "descending" : "none"}>
                      <button type="button" onClick={() => setTheo(k)} title={t("Xếp theo {{cot}}", { cot: tt.toLowerCase() })}
                        className={cn("inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30", theo === k && "text-bo-foreground")}>
                        {theo === k ? <span aria-hidden="true">↓</span> : null}{tt}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className={cn(TH, "text-left")}>{t("Theo ngày")}</th>
                  <th scope="col" className={cn(TH, "text-right")}>{t("Khả dụng")}</th>
                  <th scope="col" className={cn(TH, "text-right")} title={t("Khả dụng chia số bán bình quân một ngày của mọi kênh")}>{t("Đủ bán")}</th>
                  <th scope="col" className={cn(TH, "text-left")}>{t("Tình trạng")}</th>
                  <th scope="col" className={cn(TH, "text-center")}>{t("Thao tác")}</th>
                </tr>
              </thead>
              <tbody>
                {trangDong.map((p, i) => {
                  const dangMo = mo.has(p.id);
                  const stt = trangAnToan * soDong + i + 1;
                  return (
                    <Fragment key={p.id}>
                      <tr className={cn("border-b border-[#eef1f5] hover:bg-bo-surface-subtle", dangMo && "bg-bo-surface-subtle")}>
                        <td className="px-3 py-3 text-center tabular-nums text-bo-muted">{stt}</td>
                        <td className="px-3 py-3"><Anh p={p} /></td>
                        <td className="max-w-[300px] px-3 py-3">
                          <Link to={`/products/${p.id}`} className="block truncate font-medium text-bo-foreground hover:text-bo-primary" title={p.tenSanPham}>{p.tenSanPham}</Link>
                          <span className="block truncate text-xs text-bo-muted"><Hang p={p} coBanKyTruoc={coBanKyTruoc} />{p.maSanPham} · {tenDanhMuc(p)} · {tenThuongHieu(p)}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <b className={cn("font-semibold", N(p.soLuong) ? "text-bo-foreground" : "font-normal text-bo-muted")}>{formatNumber(p.soLuong)}</b>
                          <span className="block text-xs"><SoVoi nay={p.soLuong} truoc={p.soLuongTruoc} /></span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <span className={N(p.doanhThu) ? undefined : "text-bo-muted"}>{formatCurrency(p.doanhThu)}</span>
                          {/* Tỷ trọng, biên chỉ khi doanh thu dương: kỳ chỉ có hàng trả thì doanh thu âm, tỷ lệ không có nghĩa */}
                          {N(bc.tong?.doanhThu) > 0 && N(p.doanhThu) > 0 ? <span className="block text-xs text-bo-muted">{t("{{tyLe}} doanh thu", { tyLe: formatPercent(N(p.doanhThu) / N(bc.tong.doanhThu)) })}</span> : null}
                        </td>
                        {coGiaVon ? (
                          <td className="px-3 py-3 text-right tabular-nums">
                            <span className={N(p.loiNhuan) < 0 ? "text-bo-danger" : N(p.loiNhuan) ? undefined : "text-bo-muted"}>{formatCurrency(p.loiNhuan)}</span>
                            {N(p.doanhThu) > 0 ? <span className="block text-xs text-bo-muted">{t("biên {{bien}}", { bien: formatPercent(N(p.loiNhuan) / N(p.doanhThu)) })}</span> : null}
                          </td>
                        ) : null}
                        <td className="px-3 py-3">
                          {N(p.soLuong) > 0 && p.theoNgay?.length ? <DuongNho arr={p.theoNgay} /> : <span className="text-xs text-bo-muted">{p.ngayBanCuoi ? t("bán gần nhất {{ngayBanCuoi}}", { ngayBanCuoi: ngayVN(p.ngayBanCuoi) }) : t("chưa từng bán")}</span>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <b className={cn("font-semibold", N(p.khaDung) ? "text-bo-foreground" : "text-bo-muted")}>{formatNumber(p.khaDung)}</b>
                          {N(p.dangVe) ? <span className="block text-xs text-bo-primary">{t("+{{dangVe}} đang về", { dangVe: formatNumber(p.dangVe) })}</span> : null}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums"><DuBan p={p} /></td>
                        <td className="px-3 py-3"><TinhTrang ma={p.tinhTrang} /></td>
                        <td className="px-3 py-3 text-center">
                          <button type="button" className={NUT_MO} aria-expanded={dangMo} aria-label={dangMo ? t("Thu gọn chi tiết {{ten}}", { ten: p.tenSanPham }) : t("Xem chi tiết {{ten}}", { ten: p.tenSanPham })} onClick={() => doiMo(p.id)}>
                            {t("Chi tiết")}<ChevronDown className={cn("size-3.5 transition-transform", dangMo && "rotate-180")} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {dangMo ? (
                        <tr className="border-b border-[#eef1f5] bg-[#fbfcfd]">
                          <td colSpan={coGiaVon ? 11 : 10} className="px-5 py-4"><ChiTietMoRong p={p} bc={bc} /></td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-[#eef1f5] px-5 py-3 text-xs text-bo-muted max-md:px-4">
              {t("Tính theo ngày giao hàng, đơn đã xuất kho hoặc hoàn thành; hàng khách trả tại quầy trừ vào ngày trả. Doanh thu đã trừ giảm giá, gồm thuế GTGT, chưa gồm phí vận chuyển. Khả dụng là số hiện tại, đã trừ hàng đang giữ cho đơn chưa xuất và phiếu chuyển kho. Đủ bán = khả dụng chia số bán bình quân một ngày của mọi kênh; hàng về kho giữa kỳ thì tính từ ngày về.")}
            </p>
          </>
        )}
      </TableShell>
    </PageContainer>
  );
}
