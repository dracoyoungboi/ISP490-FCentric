import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Ban, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileText, Info, Layers, Printer, ScanBarcode, SearchX } from "lucide-react";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import ToKhop from "@/components/shared/ToKhop";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { AnhSanPham } from "@/components/channel/HienThiKenh";
import { NUT_PHU } from "@/components/channel/BottomActionBar";
import HopChonPhieuNhap from "@/components/tem-ma-vach/HopChonPhieuNhap";
import useTaiTrangTem from "@/components/tem-ma-vach/useTaiTrangTem";
import { moTatCaDaNho, nhoMoTatCa, nhoSoDong, soDongDaNho } from "@/components/tem-ma-vach/boNhoTem";
import {
  SO_NGAY_DOI_GIA,
  SO_SAN_PHAM_MOI_TRANG,
  TAB_TEM,
  chuanHoaTrang,
  coGia,
  dangHoatDong,
  dongCuaTrang,
  laMotPhanLoai,
  nhanPhanLoai,
  nhomDangMo,
  soThieuMaVach,
  timDongQuet,
  tomTatNhom,
  trangThaiChon,
  tuMoNhom,
} from "@/components/tem-ma-vach/nhomTem";
import { chuanHoaDongInTem } from "@/components/print/tinhTem";
import HopInTem from "@/pages/product/components/product/HopInTem";
import EditProductModal from "@/pages/product/components/product/EditProductModal";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { temSanPhamService } from "@/services/temSanPhamService";
import { hasAnyRole } from "@/utils/roles";
import { formatDate, formatNumberOrDash } from "@/utils/formatters";
import { t } from "@/i18n";
import { VAI_TRO_KHO, VAI_TRO_SUA_SAN_PHAM } from "@/constants/vaiTroTheoNghiepVu";

const TAB_MAS = TAB_TEM.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const NUT_DAU_TRANG = "h-9 gap-2 rounded-md border-bo-border bg-white px-3 text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
// Điện thoại / máy tính bảng dọc (cảm ứng): lớp after: phủ quanh ô 16px thành vùng chạm 44px
const CHECKBOX_CLASS =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white cam-ung:max-lg:relative cam-ung:max-lg:after:absolute cam-ung:max-lg:after:-inset-3.5";
const nhanBienThe = (d) => [d.tenMau, d.kichCo].filter(Boolean).join(" - ") || "—";

/** Chữ giá bán của hàng sản phẩm: một số, khoảng giá (xám), hoặc chưa có giá. */
function chuGiaNhom(giaBan) {
  if (giaBan.loai === "chua") return null;
  if (giaBan.loai === "khoang") {
    const chu = giaBan.thapNhat === giaBan.caoNhat
      ? formatNumberOrDash(giaBan.thapNhat)
      : `${formatNumberOrDash(giaBan.thapNhat)} – ${formatNumberOrDash(giaBan.caoNhat)}`;
    return { chu, xam: true, title: giaBan.thieuGia ? t("Có phân loại chưa có giá") : undefined };
  }
  return { chu: formatNumberOrDash(giaBan.gia) };
}

/** "● Đen - M": chấm màu + màu - kích cỡ. */
function NhanBienThe({ dong, className }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-[7px] whitespace-nowrap", className)}>
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full border border-slate-900/20"
        style={{ background: dong.maMauHex || "#e2e8f0" }}
      />
      <span className="truncate">{nhanBienThe(dong)}</span>
    </span>
  );
}

/**
 * Giá bán (giá in trên tem), chỉ để xem. Chưa có giá: chữ cam vì tem của SKU đó không in được; quản trị viên thấy thêm
 * nút "Đặt giá" mở form Sửa sản phẩm (giá bán chỉ đổi ở đó).
 */
function OGia({ chu, xam = false, title, onDatGia, giaCu }) {
  if (chu) {
    return (
      <span className="inline-flex flex-col items-end">
        <span title={title} className={cn("whitespace-nowrap tabular-nums", xam ? "text-bo-muted" : "font-medium text-bo-foreground")}>
          {chu}
        </span>
        {/* Tab Đổi giá gần đây: giá đang in trên tem cũ và ngày đổi, để biết tem nào cần bóc */}
        {giaCu ? (
          // Điện thoại: chỉ giá cũ gạch (đủ hẹp để màu - kích cỡ cùng hàng không bị cắt)
          <span className="whitespace-nowrap text-xs tabular-nums text-bo-muted">
            <span className="max-md:hidden">{t("trước")} </span>
            <s className="text-slate-400">{giaCu.gia}</s>
            {giaCu.ngay ? <span className="max-md:hidden">{` · ${giaCu.ngay}`}</span> : null}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    // Điện thoại: "Đặt giá" xuống dưới "Chưa có giá" để không lấn chỗ của màu - kích cỡ trên thẻ
    <span className="inline-flex items-center justify-end gap-x-2 whitespace-nowrap max-md:flex-col max-md:items-end">
      <span className="text-orange-700" title={t("Tem của SKU chưa có giá không in được")}>{t("Chưa có giá")}</span>
      {onDatGia ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDatGia();
          }}
          className="rounded text-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-md:min-h-11 cam-ung:min-h-11"
        >
          {t("Đặt giá")}
        </button>
      ) : null}
    </span>
  );
}

/**
 * Tem mã vạch (thay màn "Giá bán & tem mã vạch"): in tem mã vạch theo SKU, theo cả sản phẩm hoặc theo phiếu nhập cho
 * quản trị viên, quản lý kho, nhân viên kho, nhân viên bán hàng (SRS 4.4 "Barcode – Generate / Print", UC 2.7).
 * Không hiện tồn (BA bỏ cho đỡ rối): số tem do người in tự đặt, hoặc theo số lượng nhập khi in theo phiếu nhập. Tab theo
 * việc cần làm: Đổi giá gần đây (in lại tem giá cũ), Chưa có giá, Thiếu mã vạch; SKU ngừng hoạt động không hiện. Đổi tab
 * cho mượt: giữ số trên tab, nhớ trang đã xem, tải trước khi rê chuột lên tab (useTaiTrangTem).
 * Giá bán chỉ để xem (là giá in trên tem); đổi giá ở form Sửa sản phẩm — quản trị viên bấm "Đặt giá" ở SKU chưa có giá
 * để mở form đó ngay tại đây. Phân trang theo sản phẩm (máy chủ trả mỗi sản phẩm kèm đủ SKU khớp bộ lọc); mở / thu gọn,
 * chọn nhiều, tìm kiếm theo đúng khuôn màn Sản phẩm theo sàn. Quét mã vạch vào ô tìm: mở nhóm, cuộn tới và tô dòng đó.
 */
export default function TemMaVachPage() {
  const suaDuocSanPham = hasAnyRole(VAI_TRO_SUA_SAN_PHAM);
  // In theo phiếu nhập là chứng từ kho: nhân viên bán hàng không có
  const inTheoPhieuNhap = hasAnyRole(VAI_TRO_KHO);
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState(() => ({ page: 0, size: soDongDaNho(SO_DONG_MAC_DINH) }));
  // Mở/thu gọn (khuôn Sản phẩm theo sàn): mặc định thu gọn; `moTatCa` là chế độ (nhớ trong trình duyệt); `ngoaiLe` là
  // nhóm người dùng tự lật ngược chế độ; `boTuMo`: đã bấm Thu gọn tất cả ở tab / lần tìm này. Đổi tab / từ khóa thì xóa.
  const [moTatCa, setMoTatCa] = useState(() => moTatCaDaNho());
  const [ngoaiLe, setNgoaiLe] = useState(() => new Set());
  const [boTuMo, setBoTuMo] = useState(false);
  // "In lại tem" sau khi lưu giá ở form Sửa sản phẩm: mở tab Đổi giá gần đây, chọn sẵn các SKU vừa đổi
  const [chon, setChon] = useState(() => new Set(Array.isArray(location.state?.chonBienThe) ? location.state.chonBienThe : []));
  const [ngungQuet, setNgungQuet] = useState(null); // mã tìm / quét trúng SKU đã ngừng hoạt động
  // Bấm "In lại tem" lúc đang ở chính màn này (form Sửa mở từ nút Đặt giá): đường dẫn đổi, trang không dựng lại
  const [khoaDieuHuong, setKhoaDieuHuong] = useState(location.key);
  if (location.key !== khoaDieuHuong) {
    setKhoaDieuHuong(location.key);
    if (Array.isArray(location.state?.chonBienThe)) setChon(new Set(location.state.chonBienThe));
  }
  const [noiBat, setNoiBat] = useState(null); // id SKU vừa quét trúng
  const [choQuet, setChoQuet] = useState(null); // mã vừa quét, chờ dữ liệu của từ khóa đó
  const [hopChonPhieu, setHopChonPhieu] = useState(false);
  const [hopInTem, setHopInTem] = useState(null); // { nguon, dong, maPhieu? }
  const [spSua, setSpSua] = useState(null); // id sản phẩm đang mở form Sửa (Đặt giá)
  const bangRef = useRef(null);
  // Điện thoại vẽ danh sách thẻ thay cho bảng (chỉ vẽ một trong hai; id dòng dùng để cuộn tới)
  const isMobile = useIsMobile();

  const ds = useTaiTrangTem({ tab, tuKhoa, page: trang.page, size: trang.size });
  const duLieu = useMemo(() => chuanHoaTrang(ds.data), [ds.data]);
  const nhom = duLieu.nhom;
  const rows = useMemo(() => dongCuaTrang(duLieu.nhom), [duLieu]);

  /** Bỏ chọn, xóa ngoại lệ mở/gập và dòng tô sáng: mỗi khi đổi tab, từ khóa. */
  const datLaiBang = () => {
    setChon(new Set());
    setNgoaiLe(new Set());
    setBoTuMo(false);
    setNoiBat(null);
    setChoQuet(null);
  };
  const cuonLenDau = () => bangRef.current?.closest(".bo-table-body")?.scrollTo?.({ top: 0 });

  // Gõ tìm kiếm: chờ người dùng ngừng gõ rồi mới lọc (Enter / quét mã thì lọc ngay)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const moi = searchText.trim();
      if (moi === tuKhoa) return;
      setTuKhoa(moi);
      setTrang((cu) => ({ ...cu, page: 0 }));
      setChon(new Set());
      setNgoaiLe(new Set());
      setBoTuMo(false);
      setNoiBat(null);
      setChoQuet(null);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, tuKhoa]);

  // Trang đang xem vượt số trang thật sau khi tải lại → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (ds.loading) return;
    const trangCuoi = trangCuoiNeuVuot({ trang: trang.page, kichThuoc: trang.size, soDong: nhom.length, tong: duLieu.tongSanPham });
    if (trangCuoi != null) queueMicrotask(() => setTrang((cu) => ({ ...cu, page: trangCuoi })));
  }, [ds.loading, nhom.length, duLieu.tongSanPham, trang.page, trang.size]);

  // Quét mã: dữ liệu của từ khóa vừa quét về thì tìm SKU đúng mã, mở nhóm, cuộn tới và tô dòng đó
  useEffect(() => {
    if (!choQuet || ds.loading || choQuet !== tuKhoa) return;
    const trung = timDongQuet(nhom, choQuet);
    queueMicrotask(() => {
      setChoQuet(null);
      if (!trung) return;
      setNoiBat(trung.dong.id);
      setNgoaiLe(new Set());
      setBoTuMo(false);
      window.requestAnimationFrame(() =>
        document.getElementById(`tem-dong-${trung.dong.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    });
  }, [choQuet, ds.loading, tuKhoa, nhom]);

  // Tìm / quét mà không có SKU nào: tra đúng mã đó, trúng SKU đã ngừng hoạt động thì báo rõ thay vì "không khớp"
  const khongCoDong = !ds.loading && !ds.error && rows.length === 0;
  useEffect(() => {
    if (!tuKhoa || !khongCoDong) return undefined;
    let huy = false;
    temSanPhamService
      .traMa(tuKhoa)
      .then((d) => {
        if (!huy) setNgungQuet(d && Number(d.trangThai) !== 1 ? { ma: tuKhoa, maSku: d.maSku || tuKhoa } : null);
      })
      .catch(() => {
        if (!huy) setNgungQuet(null);
      });
    return () => {
      huy = true;
    };
  }, [tuKhoa, khongCoDong]);

  // Quay lại tab thì tải lại ngầm (giá do người khác đổi); không tải khi đang mở form Sửa sản phẩm
  useTaiLaiKhiQuayLai(() => ds.reload(), { bat: !ds.loading && spSua == null, lanCuoi: ds.capNhatLuc });

  // Rê chuột lên tab: dừng 100 ms mới tải trước (lướt ngang qua các tab thì không tải hết)
  const henTaiTruocRef = useRef(null);
  const taiTruocTab = (event) => {
    const nut = event.target.closest?.('[role="tab"]');
    if (!nut) return;
    const viTri = [...nut.parentElement.querySelectorAll('[role="tab"]')].indexOf(nut);
    const muc = statusTabs[viTri];
    window.clearTimeout(henTaiTruocRef.current);
    if (!muc || muc.value === tab) return;
    henTaiTruocRef.current = window.setTimeout(() => ds.taiTruoc(muc.value), 100);
  };
  useEffect(() => () => window.clearTimeout(henTaiTruocRef.current), []);

  const doiTab = (moi) => {
    setTab(moi);
    setTrang((cu) => ({ ...cu, page: 0 }));
    datLaiBang();
    cuonLenDau();
  };
  const xoaLoc = () => {
    setSearchText("");
    setTuKhoa("");
    setTrang((cu) => ({ ...cu, page: 0 }));
    datLaiBang();
    cuonLenDau();
  };
  /** Enter trong ô tìm: lọc ngay theo đúng chữ đã gõ / quét, khớp đúng mã thì mở nhóm và tô dòng; chọn sẵn chữ để quét tiếp. */
  const timNgay = (event) => {
    if (event.key === "Escape") {
      if (!searchText) return;
      event.preventDefault();
      setSearchText("");
      setTuKhoa("");
      setTrang((cu) => ({ ...cu, page: 0 }));
      datLaiBang();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const ma = event.currentTarget.value.trim();
    if (!ma) return;
    if (ma !== tuKhoa) {
      setTuKhoa(ma);
      setTrang((cu) => ({ ...cu, page: 0 }));
      datLaiBang();
    }
    setChoQuet(ma);
    event.currentTarget.select();
  };

  const doiChon = (ids, them) =>
    setChon((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (them ? moi.add(id) : moi.delete(id)));
      return moi;
    });
  const tuMo = (g) => tuMoNhom(g, { tab, tuKhoa, idNoiBat: noiBat });
  const laMo = (g) => nhomDangMo({ moTatCa, tuMo: tuMo(g), boTuMo, laNgoaiLe: ngoaiLe.has(g.khoa) });
  const doiGon = (khoa) =>
    setNgoaiLe((cu) => {
      const moi = new Set(cu);
      if (moi.has(khoa)) moi.delete(khoa);
      else moi.add(khoa);
      return moi;
    });
  const nhomNhieu = nhom.filter((g) => !laMotPhanLoai(g));
  const tatCaDangMo = nhomNhieu.length > 0 && nhomNhieu.every(laMo);
  /** Mở tất cả / Thu gọn tất cả: đổi chế độ cho mọi trang; thu gọn thì gập cả các nhóm đang tự mở. */
  const doiMoTatCa = () => {
    const mo = !tatCaDangMo;
    setMoTatCa(mo);
    nhoMoTatCa(mo);
    setBoTuMo(!mo);
    setNgoaiLe(new Set());
  };

  const moInTem = (nguon, dsDong, maPhieu) => setHopInTem({ nguon, dong: dsDong, maPhieu });
  /** "Đặt giá" (ở bảng hoặc hộp In tem): mở form Sửa sản phẩm của SKU đó; chỉ quản trị viên. */
  const datGia = suaDuocSanPham
    ? (d) => {
        if (d?.sanPhamId == null) return;
        setHopInTem(null);
        setSpSua(d.sanPhamId);
      }
    : undefined;

  // Số đếm giữ nguyên khi đổi tab / trang (chỉ phụ thuộc từ khóa), nên không nháy mất rồi hiện lại
  const dem = ds.dem;
  const statusTabs = TAB_TEM
    // "Thiếu mã vạch" chỉ hiện khi có SKU thiếu (máy chủ tự sinh mã khi tạo SKU) hoặc đang mở tab đó
    .filter((muc) => !muc.anKhiRong || muc.value === tab || (dem && Number(dem[muc.dem]) > 0))
    .map((muc) => ({
      value: muc.value,
      label: muc.label,
      tone: muc.tone,
      count: dem ? Number(dem[muc.dem]) || 0 : null,
    }));
  const daChon = rows.filter((r) => chon.has(r.id));
  const tatCaIds = rows.map((r) => r.id);

  /** Ô giá bán của một SKU: chỉ xem; SKU đang hoạt động chưa có giá thì quản trị viên có nút Đặt giá. */
  const oGiaDong = (d) => (
    <OGia
      chu={coGia(d.giaBan) ? formatNumberOrDash(d.giaBan) : null}
      giaCu={tab === "doi-gia" && coGia(d.giaBanCu) ? { gia: formatNumberOrDash(d.giaBanCu), ngay: d.ngayDoiGia ? formatDate(d.ngayDoiGia) : "" } : null}
      onDatGia={datGia && dangHoatDong(d) ? () => datGia(d) : undefined}
    />
  );
  /** Ô giá bán của hàng sản phẩm: một số / khoảng; chưa phân loại nào có giá thì như ô của SKU. */
  const oGiaNhom = (g, tt) => {
    const gia = chuGiaNhom(tt.giaBan);
    const dauTien = g.dong.find(dangHoatDong);
    return gia ? (
      <OGia chu={gia.chu} xam={gia.xam} title={gia.title} />
    ) : (
      <OGia onDatGia={datGia && dauTien ? () => datGia(dauTien) : undefined} />
    );
  };

  /**
   * Một dòng SKU. `trongNhom`: nằm dưới hàng sản phẩm (chỉ ghi màu - kích cỡ, thụt vào); không thì là sản phẩm một
   * phân loại (ảnh, tên, màu - kích cỡ).
   */
  const dongSku = (d, g, trongNhom) => {
    const ngung = !dangHoatDong(d);
    const tieuDiem = noiBat === d.id;
    return (
      <tr
        key={d.id}
        id={`tem-dong-${d.id}`}
        className={cn(
          "transition-colors hover:bg-bo-surface-subtle",
          chon.has(d.id) && "bg-bo-primary-soft/50",
          tieuDiem && "bg-bo-primary-soft shadow-[inset_3px_0_0_var(--color-bo-primary)] hover:bg-bo-primary-soft",
        )}
      >
        <td className="w-10 px-3 py-2.5">
          <Checkbox
            checked={chon.has(d.id)}
            onCheckedChange={(v) => doiChon([d.id], v === true)}
            aria-label={t("Chọn {{maSku}}", { maSku: d.maSku })}
            className={CHECKBOX_CLASS}
          />
        </td>
        <td className="max-w-[420px] px-3 py-2.5">
          {trongNhom ? (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-[42px]">
                <NhanBienThe dong={d} className="text-sm text-bo-foreground" />
                {ngung ? <StatusBadge /* i18n-giu-nguyen: StatusBadge tự dịch */ label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
              </div>
              {/* Máy tính bảng dọc: SKU · mã vạch thay cho cột đã ẩn */}
              <p className="hidden truncate pl-[42px] text-[12.5px] text-bo-muted cam-ung:max-lg:block">
                <ToKhop text={d.maSku || "—"} tu={tuKhoa} /> · {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
              </p>
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <AnhSanPham src={g.anh} />
              <div className="min-w-0">
                <p className="truncate font-medium text-bo-heading">
                  <ToKhop text={g.ten} tu={tuKhoa} />
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                  <NhanBienThe dong={d} className="text-[13px] text-bo-muted" />
                  {ngung ? <StatusBadge /* i18n-giu-nguyen: StatusBadge tự dịch */ label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
                </div>
                <p className="hidden truncate text-[12.5px] text-bo-muted cam-ung:max-lg:block">
                  <ToKhop text={d.maSku || "—"} tu={tuKhoa} /> · {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
                </p>
              </div>
            </div>
          )}
        </td>
        <td className="max-w-[250px] px-3 py-2.5 cam-ung:max-lg:hidden">
          <p className="truncate text-[13.5px] text-bo-foreground">
            <ToKhop text={d.maSku || "—"} tu={tuKhoa} />
          </p>
          <p className="truncate text-[12.5px] tabular-nums text-bo-muted">
            {t("Mã vạch")} {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
          </p>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right">{oGiaDong(d)}</td>
        <td className="w-16 px-2 py-2.5">
          <RowActions>
            <RowActionButton
              icon={Printer}
              label={ngung ? t("SKU ngừng hoạt động") : t("In tem {{maSku}}", { maSku: d.maSku })}
              disabled={ngung}
              onClick={() => moInTem("chon", [d])}
            />
          </RowActions>
        </td>
      </tr>
    );
  };

  /**
   * Hàng sản phẩm nhiều phân loại: bấm chỗ nào trên hàng cũng mở/gập; chọn cả nhóm (có lưng chừng); giá bán
   * một số / khoảng / chưa có; in tem cả sản phẩm. Đang mở thì hàng dính dưới tiêu đề cột.
   */
  const hangNhom = (g, mo) => {
    const ids = g.dong.map((d) => d.id);
    const tt = tomTatNhom(g);
    // Nhóm hiện thiếu phân loại vì tìm theo SKU (lọc theo tab không tính: phân loại ẩn là phân loại ngừng)
    const motPhan = Boolean(tuKhoa) && !g.khopTen && g.dong.length < g.tongPhanLoai;
    const dinh = mo && "sticky top-10 z-[5] shadow-[inset_0_-1px_0_var(--color-bo-border)]";
    const o = cn("bg-bo-row-group group-hover/nhom:bg-bo-row-group-hover", dinh);
    return (
      <tr key={g.khoa} onClick={() => doiGon(g.khoa)} className="group/nhom cursor-pointer">
        <td className={cn("w-10 px-3 py-2.5", o)} onClick={(event) => event.stopPropagation()}>
          <Checkbox checked={trangThaiChon(ids, chon)} onCheckedChange={(v) => doiChon(ids, v === true)} aria-label={t("Chọn cả {{ten}}", { ten: g.ten })} className={CHECKBOX_CLASS} />
        </td>
        <td className={cn("max-w-[420px] px-3 py-2.5", o)}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                doiGon(g.khoa);
              }}
              aria-expanded={mo}
              aria-label={mo ? t("Thu gọn các phân loại của {{ten}}", { ten: g.ten }) : t("Mở các phân loại của {{ten}}", { ten: g.ten })}
              className="grid size-[22px] shrink-0 place-items-center rounded text-bo-muted hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              <ChevronRight className={cn("size-3.5 transition-transform duration-150 motion-reduce:transition-none", mo && "rotate-90")} />
            </button>
            <AnhSanPham src={g.anh} />
            <div className="min-w-0">
              <p className="truncate font-medium text-bo-heading">
                <ToKhop text={g.ten} tu={tuKhoa} />
              </p>
              <p className="text-[13px] text-bo-muted">{nhanPhanLoai(g, motPhan, formatNumberOrDash)}</p>
            </div>
          </div>
        </td>
        {/* Mã sản phẩm (cha của các mã SKU bên dưới) để cột SKU · Mã vạch không trống ở hàng sản phẩm */}
        <td className={cn("max-w-[250px] px-3 py-2.5 cam-ung:max-lg:hidden", o)}>
          <p className="truncate text-[13.5px] text-bo-foreground">
            <ToKhop text={g.maSanPham || "—"} tu={tuKhoa} />
          </p>
          {soThieuMaVach(g) ? (
            <p className="truncate text-[12.5px] text-orange-700">{t("{{so}} SKU thiếu mã vạch", { count: soThieuMaVach(g), so: formatNumberOrDash(soThieuMaVach(g)) })}</p>
          ) : (
            <p className="truncate text-[12.5px] text-bo-muted">
              {t("Mã sản phẩm · {{so}} SKU", { count: g.dong.length, so: formatNumberOrDash(g.dong.length) })}
            </p>
          )}
        </td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right", o)}>{oGiaNhom(g, tt)}</td>
        <td className={cn("w-16 px-2 py-2.5", o)}>
          <RowActions>
            <RowActionButton icon={Printer} label={t("In tem cả sản phẩm {{ten}}", { ten: g.ten })} onClick={() => moInTem("chon", g.dong)} />
          </RowActions>
        </td>
      </tr>
    );
  };

  /* ── Điện thoại: thẻ thay cho dòng bảng ───────────────────────────────── */
  /** Ô chọn của thẻ: vùng chạm 44px bọc checkbox. */
  const oChon = (checked, onChange, ariaLabel) => (
    <span className="grid size-11 shrink-0 place-items-center">
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} className={CHECKBOX_CLASS} />
    </span>
  );
  /** Nút In tem 44px của thẻ. */
  const nutIn = (label, onClick, disabled = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-primary disabled:opacity-40"
    >
      <Printer className="size-[18px]" aria-hidden="true" />
    </button>
  );

  /**
   * Thẻ một SKU: ô chọn, (ảnh + tên khi là sản phẩm một phân loại); màu - cỡ cùng hàng với giá bán và In tem; dưới đó
   * SKU · mã vạch. `trongNhom`: nằm dưới thẻ sản phẩm nhiều phân loại (thụt vào, không ảnh).
   */
  const theSku = (d, g, trongNhom) => {
    const ngung = !dangHoatDong(d);
    return (
      <li
        key={d.id}
        id={`tem-dong-${d.id}`}
        className={cn(
          "flex items-start gap-1 py-1 pr-1",
          trongNhom ? "pl-7" : "pl-1",
          chon.has(d.id) && "bg-bo-primary-soft/50",
          noiBat === d.id && "bg-bo-primary-soft shadow-[inset_3px_0_0_var(--color-bo-primary)]",
        )}
      >
        {oChon(chon.has(d.id), (v) => doiChon([d.id], v === true), t("Chọn {{maSku}}", { maSku: d.maSku }))}
        {trongNhom ? null : <AnhSanPham src={g.anh} size={44} />}
        <div className={cn("min-w-0 flex-1 pb-1.5", !trongNhom && "pl-2 pt-1.5")}>
          {trongNhom ? null : (
            <p className="line-clamp-2 font-medium leading-5 text-bo-heading">
              <ToKhop text={g.ten} tu={tuKhoa} />
            </p>
          )}
          <div className="flex min-h-11 items-center justify-between gap-2">
            <NhanBienThe dong={d} className={cn("flex-1", trongNhom ? "text-sm text-bo-foreground" : "text-[13px] text-bo-muted")} />
            <div className="flex shrink-0 items-center gap-1 text-sm">
              {oGiaDong(d)}
              {nutIn(ngung ? t("SKU ngừng hoạt động") : t("In tem {{maSku}}", { maSku: d.maSku }), () => moInTem("chon", [d]), ngung)}
            </div>
          </div>
          {/* Dòng riêng dưới màu - cỡ: cùng hàng thì nhãn không co được và đè lên ô giá */}
          {ngung ? <StatusBadge /* i18n-giu-nguyen: StatusBadge tự dịch */ label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
          <p className="truncate text-[12.5px] text-bo-muted">
            <ToKhop text={d.maSku || "—"} tu={tuKhoa} /> · {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
          </p>
        </div>
      </li>
    );
  };

  /**
   * Thẻ sản phẩm nhiều phân loại: ô chọn cả nhóm, bấm phần tên để mở / thu gọn các phân loại; số phân loại,
   * giá bán cả sản phẩm (một số / khoảng / chưa có) và In tem cả sản phẩm. Đang mở thì các SKU nằm ngay dưới.
   */
  const theNhom = (g, mo) => {
    const ids = g.dong.map((d) => d.id);
    const tt = tomTatNhom(g);
    const motPhan = Boolean(tuKhoa) && !g.khopTen && g.dong.length < g.tongPhanLoai;
    return (
      <li key={g.khoa}>
        <div className="bg-bo-row-group pb-1 pl-1 pr-1 pt-1">
          <div className="flex items-start gap-1">
            {oChon(trangThaiChon(ids, chon), (v) => doiChon(ids, v === true), t("Chọn cả {{ten}}", { ten: g.ten }))}
            <button
              type="button"
              onClick={() => doiGon(g.khoa)}
              aria-expanded={mo}
              className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-1 pr-1 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
            >
              <AnhSanPham src={g.anh} size={44} />
              <span className="min-w-0 flex-1 pl-1">
                <span className="line-clamp-2 font-medium leading-5 text-bo-heading">
                  <ToKhop text={g.ten} tu={tuKhoa} />
                </span>
                <span className="block text-[13px] tabular-nums text-bo-muted">
                  {nhanPhanLoai(g, motPhan, formatNumberOrDash)}
                </span>
              </span>
              <span className="grid size-11 shrink-0 place-items-center text-bo-muted">
                <ChevronRight className={cn("size-[18px] transition-transform duration-150 motion-reduce:transition-none", mo && "rotate-90")} aria-hidden="true" />
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end gap-1 pl-[52px] text-sm">
            {oGiaNhom(g, tt)}
            {nutIn(t("In tem cả sản phẩm {{ten}}", { ten: g.ten }), () => moInTem("chon", g.dong))}
          </div>
        </div>
        {mo ? <ul className="divide-y divide-[#eef1f5] border-t border-[#eef1f5]">{g.dong.map((d) => theSku(d, g, true))}</ul> : null}
      </li>
    );
  };

  const nutPhu = "h-8 gap-1.5 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          inTheoPhieuNhap ? (
            <Button type="button" variant="outline" onClick={() => setHopChonPhieu(true)} className={NUT_DAU_TRANG}>
              <FileText className="size-4" aria-hidden="true" />
              {t("In tem theo phiếu nhập")}
            </Button>
          ) : null
        }
      />

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={
                <div onPointerOver={taiTruocTab} onPointerLeave={() => window.clearTimeout(henTaiTruocRef.current)}>
                  <StatusTabs label={t("Lọc SKU theo trạng thái")} tabs={statusTabs} value={tab} onChange={doiTab} />
                </div>
              }
              // Không truyền hasFilter / onClear: màn chỉ lọc bằng ô tìm, dấu × trong ô đã xóa từ khóa — thêm nút "Xóa lọc" là
              // hai nút một việc đứng sát nhau
            >
              {/* Máy tính: nút vuông có viền, cao bằng ô tìm (hai thứ thẳng hàng), chữ hiện khi rê chuột. Điện thoại: nút nằm
                  riêng một hàng trên ô tìm nên ghi cả chữ cho dễ hiểu */}
              <Button
                type="button"
                variant="outline"
                onClick={doiMoTatCa}
                disabled={nhomNhieu.length === 0}
                aria-label={tatCaDangMo ? t("Thu gọn tất cả") : t("Mở tất cả")}
                title={
                  nhomNhieu.length === 0 && rows.length > 0
                    ? t("Trang này không có sản phẩm nhiều phân loại")
                    : tatCaDangMo
                      ? t("Thu gọn tất cả")
                      : t("Mở tất cả")
                }
                className="h-9 shrink-0 gap-1.5 border-bo-border bg-bo-surface text-slate-600 hover:bg-bo-surface-subtle hover:text-bo-foreground md:w-9 md:p-0 max-md:h-11 max-md:px-3"
              >
                {tatCaDangMo ? <ChevronsDownUp className="size-4" aria-hidden="true" /> : <ChevronsUpDown className="size-4" aria-hidden="true" />}
                <span className="md:hidden">{tatCaDangMo ? t("Thu gọn tất cả") : t("Mở tất cả")}</span>
              </Button>
              <SearchInput
                label={t("Tìm SKU")}
                // Điện thoại: ô hẹp hơn nên chữ gợi ý ngắn hơn; biểu tượng súng quét vẫn báo ô nhận máy quét
                placeholder={t("Tên, SKU hoặc quét mã vạch")}
                bieuTuongCuoi={<ScanBarcode />}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={timNgay}
                onClear={() => {
                  setSearchText("");
                  setTuKhoa("");
                  setTrang((cu) => ({ ...cu, page: 0 }));
                  datLaiBang();
                }}
                className="sm:w-[360px]"
              />
            </ListToolbar>
            {tab === "doi-gia" || tab === "chua-gia" ? (
              <p className="flex items-start gap-2 border-b border-bo-border bg-[#f8fbff] px-3 py-2 text-[13px] text-slate-600 sm:px-4">
                <Info className="mt-0.5 size-[15px] shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  {tab === "doi-gia"
                    ? t("SKU đổi giá bán trong {{soNgay}} ngày qua. Tem đang dán còn giá cũ, cần in lại.", { soNgay: SO_NGAY_DOI_GIA })
                    : suaDuocSanPham
                      ? t("Tem in kèm giá nên SKU chưa có giá không in được. Bấm Đặt giá để mở form Sửa sản phẩm.")
                      : t("Tem in kèm giá nên SKU chưa có giá không in được. Báo quản trị viên đặt giá bán.")}
                </span>
              </p>
            ) : null}
            {/* Đang tải trang chưa xem: vạch mảnh dưới hàng tab, chỉ hiện nếu chờ quá 200 ms (index.css .bo-vach-tai) */}
            {ds.dangTaiMoi ? (
              <div className="relative h-0" aria-hidden="true">
                <div className="bo-vach-tai" />
              </div>
            ) : null}
            {daChon.length ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-bo-border bg-bo-primary-soft px-3 py-2 text-sm text-bo-primary-strong sm:px-4">
                <span className="mr-1">
                  <strong className="font-semibold tabular-nums">{formatNumberOrDash(daChon.length)}</strong> {t("SKU đã chọn trên trang này", { count: daChon.length })}
                </span>
                <Button type="button" variant="outline" onClick={() => moInTem("chon", daChon)} className={nutPhu}>
                  <Printer className="size-3.5" aria-hidden="true" />
                  {t("In tem")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setChon(new Set())}
                  className="ml-auto h-8 rounded-lg px-3 text-[13px] text-bo-primary-strong hover:bg-white/70 max-sm:h-11"
                >
                  {t("Bỏ chọn")}
                </Button>
              </div>
            ) : null}
          </>
        }
        footer={
          (!ds.error || ds.loiTaiLai) && duLieu.tongSanPham > 0 ? (
            <TablePagination
              page={trang.page}
              size={trang.size}
              total={duLieu.tongSanPham}
              sizeLabel={t("sản phẩm")}
              totalLabel={t("sản phẩm")}
              sizeOptions={SO_SAN_PHAM_MOI_TRANG}
              sizeMenuTitle={t("Số sản phẩm mỗi trang")}
              sizeMenuNote={t("Đếm theo sản phẩm; mỗi sản phẩm luôn kèm đủ phân loại nên không bị cắt sang trang sau.")}
              totalNote={`${formatNumberOrDash(duLieu.tongSku)} SKU`}
              onPageChange={(page) => {
                if (page < 0 || page === trang.page) return;
                setTrang((cu) => ({ ...cu, page }));
                setChon(new Set());
                setNoiBat(null);
                cuonLenDau();
              }}
              onSizeChange={(size) => {
                if (size === trang.size) return;
                nhoSoDong(size);
                setTrang({ page: 0, size });
                setChon(new Set());
                cuonLenDau();
              }}
            />
          ) : null
        }
      >
        {ds.initialLoading || (ds.loading && rows.length === 0 && !ds.dungKhoa) ? (
          <LoadingState label={t("Đang tải danh sách SKU")} />
        ) : ds.error && !ds.loiTaiLai ? (
          <ErrorState description={t("Không tải được danh sách SKU. Vui lòng thử lại.")} onRetry={ds.reload} />
        ) : rows.length === 0 ? (
          tuKhoa && ngungQuet?.ma === tuKhoa ? (
            <EmptyState
              icon={Ban}
              title={t("SKU {{maSku}} đã ngừng hoạt động", { maSku: ngungQuet.maSku })}
              description={
                suaDuocSanPham
                  ? t("SKU ngừng hoạt động không in tem. Mở lại SKU ở form Sửa sản phẩm nếu vẫn bán.")
                  : t("SKU ngừng hoạt động không in tem. Báo quản trị viên mở lại SKU nếu vẫn bán.")
              }
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>{t("Xóa lọc")}</Button>}
            />
          ) : tuKhoa ? (
            <EmptyState
              icon={SearchX}
              title={t("Không có SKU khớp “{{tuKhoa}}”", { tuKhoa })}
              description={t("Kiểm tra lại mã vừa quét hoặc từ khóa.")}
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>{t("Xóa lọc")}</Button>}
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={Layers}
              title={tab === "doi-gia" ? t("Không có SKU đổi giá trong {{soNgay}} ngày qua", { soNgay: SO_NGAY_DOI_GIA }) : t("Không có SKU nào ở mục này")}
              description={tab === "doi-gia" ? t("Tem trên hàng đang khớp giá bán.") : t("Chọn tab Tất cả để xem mọi SKU.")}
              action={<Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>{t("Xem tất cả")}</Button>}
            />
          ) : (
            <EmptyState icon={Layers} title={t("Chưa có SKU")} description={t("SKU được tạo khi thêm sản phẩm ở trang Sản phẩm.")} />
          )
        ) : isMobile ? (
          // Điện thoại: mỗi sản phẩm một thẻ (nhiều phân loại thì mở / thu gọn như bảng), không vuốt ngang
          <ul ref={bangRef} aria-label={t("SKU cần in tem")} aria-busy={ds.dangTaiMoi || undefined} className={cn("divide-y divide-bo-border md:hidden", ds.dangTaiMoi && "bo-bang-cho")}>
            {nhom.map((g) => (laMotPhanLoai(g) ? theSku(g.dong[0], g, false) : theNhom(g, laMo(g))))}
          </ul>
        ) : (
          // Máy tính bảng dọc (cảm ứng): bỏ cột SKU · Mã vạch (SKU xuống dưới tên), nút In tem 44px — để bảng vừa
          // khung, không vuốt ngang
          // Đang tải tab chưa xem: bảng cũ mờ đi sau 200 ms (index.css .bo-bang-cho) để thấy là đang đổi, không tưởng bấm hỏng
          <table
            ref={bangRef}
            aria-label={t("SKU cần in tem")}
            aria-busy={ds.dangTaiMoi || undefined}
            // Viền tách (border-separate), kẻ đường ở từng ô: bảng gộp viền thì Chrome vẽ chữ của dòng đang cuộn lọt
            // lên mép dưới tiêu đề cột khi hàng sản phẩm đang mở dính dưới tiêu đề
            className={cn("w-full min-w-[820px] border-separate border-spacing-0 text-sm max-md:hidden cam-ung:max-lg:min-w-0", ds.dangTaiMoi && "bo-bang-cho")}
          >
            <thead className="sticky top-0 z-10">
              <tr className="bg-bo-surface-subtle [&>th]:border-b [&>th]:border-bo-border">
                <th className={`${TH} w-10 text-left`}>
                  <Checkbox
                    checked={trangThaiChon(tatCaIds, chon)}
                    onCheckedChange={(v) => doiChon(tatCaIds, v === true)}
                    aria-label={t("Chọn mọi SKU trên trang này")}
                    className={CHECKBOX_CLASS}
                  />
                </th>
                {/* Cột Sản phẩm giới hạn ~46% để cột SKU · Mã vạch đứng sát bên, không để khoảng trống giữa bảng (máy tính bảng dọc
                    đã ẩn cột SKU nên cột này lấy hết chỗ) */}
                <th className={`${TH} w-[46%] text-left cam-ung:max-lg:w-auto`}>{t("Sản phẩm")}</th>
                <th className={`${TH} text-left cam-ung:max-lg:hidden`}>{t("SKU · Mã vạch")}</th>
                <th className={`${TH} w-44 text-right`} title={t("Giá in trên tem. Đổi giá ở Danh sách sản phẩm.")}>
                  {t("Giá bán")}
                </th>
                <th className={`${TH} w-16`}>
                  <span className="sr-only">{t("Thao tác")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="[&>tr:not(:first-child)>td]:border-t [&>tr>td]:border-[#eef1f5]">
              {nhom.map((g) => {
                if (laMotPhanLoai(g)) return dongSku(g.dong[0], g, false);
                const mo = laMo(g);
                return (
                  <Fragment key={g.khoa}>
                    {hangNhom(g, mo)}
                    {mo ? g.dong.map((d) => dongSku(d, g, true)) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </TableShell>

      <HopChonPhieuNhap
        open={hopChonPhieu}
        onOpenChange={setHopChonPhieu}
        onTiepTuc={({ maPhieu, dong }) => {
          setHopChonPhieu(false);
          moInTem("phieu", dong.map(chuanHoaDongInTem), maPhieu);
        }}
      />

      <HopInTem
        open={Boolean(hopInTem)}
        onOpenChange={(mo) => !mo && setHopInTem(null)}
        nguon={hopInTem?.nguon}
        dong={hopInTem?.dong ?? []}
        maPhieu={hopInTem?.maPhieu}
        hienGiaCu={hopInTem?.nguon !== "phieu"}
        onDatGia={datGia}
        onDaIn={() => setChon(new Set())}
      />

      {/* "Đặt giá": form Sửa sản phẩm ngay tại đây (giá bán chỉ đổi ở form này); lưu xong tải lại để thấy giá mới */}
      {suaDuocSanPham ? (
        <EditProductModal
          isOpen={spSua != null}
          onClose={() => setSpSua(null)}
          onSuccess={() => ds.reload()}
          productId={spSua}
        />
      ) : null}
    </PageContainer>
  );
}
