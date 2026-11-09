import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleCheck, FileText, History, Layers, Pencil, Printer, SearchX, X } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
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
import OGiaBan, { ChuGia } from "@/components/gia-ban/OGiaBan";
import HopDoiGiaNhieu from "@/components/gia-ban/HopDoiGiaNhieu";
import HopChonPhieuNhap from "@/components/gia-ban/HopChonPhieuNhap";
import { lyDoDaNho, moTatCaDaNho, nhoLyDo, nhoMoTatCa, nhoSoDong, soDongDaNho } from "@/components/gia-ban/boNhoGiaBan";
import {
  SO_SAN_PHAM_MOI_TRANG,
  TAB_GIA_BAN,
  chuanHoaTrang,
  dangHoatDong,
  dongCuaTrangGiaBan,
  dongInLaiSauDoiGia,
  duoiGiaVon,
  laMotPhanLoai,
  nhanPhanLoai,
  nhomDangMo,
  timDongQuet,
  tomTatNhom,
  trangThaiChon,
  tuMoNhom,
} from "@/components/gia-ban/nhomGiaBan";
import { chuanHoaDongInTem } from "@/components/print/tinhTem";
import HopInTem from "@/pages/product/components/product/HopInTem";
import NganKeoLichSu from "@/components/nhat-ky/NganKeoLichSu";
import { layLichSuGiaBienThe } from "@/services/nhatKyService";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { productService } from "@/services/productService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { formatNumberOrDash } from "@/utils/formatters";
import { t } from "@/i18n";

const TAB_MAS = TAB_GIA_BAN.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const NUT_DAU_TRANG = "h-9 gap-2 rounded-md border-bo-border bg-white px-3 text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
// Điện thoại / máy tính bảng dọc (cảm ứng): lớp after: phủ quanh ô 16px thành vùng chạm 44px
const CHECKBOX_CLASS =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white cam-ung:max-lg:relative cam-ung:max-lg:after:absolute cam-ung:max-lg:after:-inset-3.5";
const nhanBienThe = (d) => [d.tenMau, d.kichCo].filter(Boolean).join(" - ") || "—";

/** Chữ giá ở ô Giá bán của một SKU. */
function hienThiGiaDong(d) {
  if (!(Number(d.giaBan) > 0)) return { chu: t("Chưa có giá"), mau: "chua" };
  return duoiGiaVon(d) ? { chu: formatNumberOrDash(d.giaBan), mau: "duoiVon", title: t("Thấp hơn giá vốn") } : { chu: formatNumberOrDash(d.giaBan), mau: "thuong" };
}

/**
 * Chữ giá ở hàng sản phẩm: một số, khoảng giá (xám), hoặc chưa có giá (cam). Một phần phân loại chưa có giá mà các
 * phân loại còn lại cùng một giá thì ghi một số màu xám kèm chú thích (không ghi "450.000 – 450.000").
 */
function hienThiGiaNhom(giaBan) {
  if (giaBan.loai === "chua") return { chu: t("Chưa có giá"), mau: "chua" };
  if (giaBan.loai === "khoang") {
    const title = giaBan.thieuGia ? t("Có phân loại chưa có giá") : undefined;
    if (giaBan.thapNhat === giaBan.caoNhat) return { chu: formatNumberOrDash(giaBan.thapNhat), mau: "khoang", title };
    return { chu: `${formatNumberOrDash(giaBan.thapNhat)} – ${formatNumberOrDash(giaBan.caoNhat)}`, mau: "khoang", title };
  }
  return { chu: formatNumberOrDash(giaBan.gia), mau: "thuong" };
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
 * Giá bán & tem mã vạch (thay màn "Biến thể SKU & giá"): giá bán từng SKU nhóm theo sản phẩm, đổi giá có lý do và lịch
 * sử (chỉ quản trị viên), in tem mã vạch theo SKU, theo phiếu nhập hoặc sau khi đổi giá (quản lý kho xem và in tem).
 * Giá vốn chỉ đọc (SRS 2.4.1). Phân trang theo sản phẩm (máy chủ trả mỗi sản phẩm kèm đủ SKU khớp bộ lọc); mở / thu gọn,
 * chọn nhiều, tìm kiếm theo đúng khuôn màn Sản phẩm theo sàn. Quét mã vạch vào ô tìm: mở nhóm, cuộn tới và tô dòng đó.
 * Mở kèm `state.datGiaMa` (nút "Đặt giá" ở hộp In tem của phiếu nhập): tìm đúng SKU đó và mở ô giá.
 */
export default function GiaBanTemPage() {
  const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const location = useLocation();
  const navigate = useNavigate();
  const [maDatGia] = useState(() => (typeof location.state?.datGiaMa === "string" ? location.state.datGiaMa.trim() : ""));
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const [searchText, setSearchText] = useState(maDatGia);
  const [tuKhoa, setTuKhoa] = useState(maDatGia);
  const [canXuLy, setCanXuLy] = useState(false);
  const [trang, setTrang] = useState(() => ({ page: 0, size: soDongDaNho(SO_DONG_MAC_DINH) }));
  // Mở/thu gọn (khuôn Sản phẩm theo sàn): mặc định thu gọn; `moTatCa` là chế độ (nhớ trong trình duyệt); `ngoaiLe` là
  // nhóm người dùng tự lật ngược chế độ; `boTuMo`: đã bấm Thu gọn tất cả ở tab / lần tìm này. Đổi tab / từ khóa thì xóa.
  const [moTatCa, setMoTatCa] = useState(() => moTatCaDaNho());
  const [ngoaiLe, setNgoaiLe] = useState(() => new Set());
  const [boTuMo, setBoTuMo] = useState(false);
  const [chon, setChon] = useState(() => new Set());
  // SKU đang xem lịch sử giá (ngăn Lịch sử thay đổi); null = đóng. Trang chỉ mở cho quản trị viên, quản lý kho
  const [lichSuGia, setLichSuGia] = useState(null);
  const [noiBat, setNoiBat] = useState(null); // id SKU vừa quét trúng
  const [choQuet, setChoQuet] = useState(() => (maDatGia ? { ma: maDatGia, moGia: laQuanTriVien } : null)); // { ma, moGia? } chờ dữ liệu của từ khóa vừa quét
  const [popGia, setPopGia] = useState(null); // khóa ô giá đang mở: "dong-<id>" | "nhom-<khoa>"
  const [dangLuuGia, setDangLuuGia] = useState(false);
  const [lyDoTruoc, setLyDoTruoc] = useState(() => lyDoDaNho());
  const [hopDoiGia, setHopDoiGia] = useState(false);
  const [hopChonPhieu, setHopChonPhieu] = useState(false);
  const [hopInTem, setHopInTem] = useState(null); // { nguon, dong, maPhieu? }
  const bangRef = useRef(null);
  // Điện thoại vẽ danh sách thẻ thay cho bảng (chỉ vẽ một trong hai: ô giá mở theo popGia, id dòng dùng để cuộn tới)
  const isMobile = useIsMobile();

  const ds = useTaiDuLieu(
    () => productService.locGiaBan({ page: trang.page, size: trang.size, tuKhoa, trangThai: tab, canXuLyGia: canXuLy }),
    `${tab}|${tuKhoa}|${canXuLy}|${trang.page}|${trang.size}`,
  );
  const duLieu = useMemo(() => chuanHoaTrang(ds.data), [ds.data]);
  const nhom = duLieu.nhom;
  const rows = useMemo(() => dongCuaTrangGiaBan(duLieu.nhom), [duLieu]);
  const dangLoc = Boolean(tuKhoa) || canXuLy;

  /** Bỏ chọn, xóa ngoại lệ mở/gập và dòng tô sáng: mỗi khi đổi tab, từ khóa, bộ lọc. */
  const datLaiBang = () => {
    setChon(new Set());
    setNgoaiLe(new Set());
    setBoTuMo(false);
    setNoiBat(null);
    setPopGia(null);
    setChoQuet(null);
  };
  const cuonLenDau = () => bangRef.current?.closest(".bo-table-body")?.scrollTo?.({ top: 0 });

  // Đã nhận state.datGiaMa (giữ trong maDatGia) thì bỏ khỏi lịch sử: F5 / Quay lại không tự tìm và mở ô giá lại
  useEffect(() => {
    if (location.state?.datGiaMa === undefined) return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    // Chỉ chạy một lần khi vào màn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setPopGia(null);
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
    if (!choQuet || ds.loading || choQuet.ma !== tuKhoa) return;
    const trung = timDongQuet(nhom, choQuet.ma);
    queueMicrotask(() => {
      setChoQuet(null);
      if (!trung) {
        // Đến từ "Đặt giá": báo rõ thay vì im lặng (Enter tìm theo tên thì danh sách đã lọc là đủ)
        if (choQuet.moGia) toast.info(t("Không thấy SKU {{ma}} trong kết quả tìm", { ma: choQuet.ma }));
        return;
      }
      setNoiBat(trung.dong.id);
      setNgoaiLe(new Set());
      setBoTuMo(false);
      if (choQuet.moGia && dangHoatDong(trung.dong)) setPopGia(`dong-${trung.dong.id}`);
      window.requestAnimationFrame(() =>
        document.getElementById(`gia-ban-dong-${trung.dong.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    });
  }, [choQuet, ds.loading, tuKhoa, nhom]);

  // Quay lại tab thì tải lại ngầm (giá, tồn do người khác đổi); không tải khi đang mở ô giá / hộp thoại
  useTaiLaiKhiQuayLai(() => ds.reload(), { bat: !ds.loading && !popGia && !dangLuuGia, lanCuoi: ds.capNhatLuc });

  const doiTab = (moi) => {
    setTab(moi);
    setTrang((cu) => ({ ...cu, page: 0 }));
    datLaiBang();
    cuonLenDau();
  };
  const xoaLoc = () => {
    setSearchText("");
    setTuKhoa("");
    setCanXuLy(false);
    setTrang((cu) => ({ ...cu, page: 0 }));
    datLaiBang();
    cuonLenDau();
  };
  const batCanXuLy = (bat) => {
    setCanXuLy(bat);
    if (bat) setTab(TAB_MAC_DINH);
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
    setChoQuet({ ma });
    event.currentTarget.select();
  };

  const doiChon = (ids, them) =>
    setChon((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (them ? moi.add(id) : moi.delete(id)));
      return moi;
    });
  const tuMo = (g) => tuMoNhom(g, { tab, canXuLy, tuKhoa, idNoiBat: noiBat });
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

  const moInTem = (nguon, dsDong, maPhieu) => {
    setPopGia(null);
    setHopInTem({ nguon, dong: dsDong, maPhieu });
  };

  /** Lưu giá (ô giá một SKU, cả sản phẩm, hay chọn nhiều): toast 8 giây kèm "In lại X tem" khi còn hàng mang giá cũ. */
  const luuGia = async ({ ids, gia, lyDo, nhieu = false }) => {
    if (dangLuuGia) return;
    setDangLuuGia(true);
    try {
      const kq = await productService.doiGiaBan({ items: ids.map((bienTheId) => ({ bienTheId, giaBan: gia })), lyDo });
      setLyDoTruoc(lyDo);
      nhoLyDo(lyDo);
      setPopGia(null);
      setHopDoiGia(false);
      // Đổi giá cho các SKU đã chọn thì bỏ chọn; sửa một ô giá thì giữ các SKU đang chọn (vd. để in)
      if (nhieu) setChon(new Set());
      const daDoi = kq?.daDoi ?? [];
      const boQua = kq?.boQua ?? [];
      const inLai = dongInLaiSauDoiGia(daDoi, rows);
      const soTem = inLai.reduce((tong, d) => tong + d.tonKho, 0);
      // "Bỏ qua 2 SKU ngừng hoạt động, 1 SKU giá bán không đổi." — đúng các lý do máy chủ trả
      const theoLyDo = new Map();
      boQua.forEach((b) => theoLyDo.set(b.lyDo, (theoLyDo.get(b.lyDo) ?? 0) + 1));
      const ghiChu = boQua.length
        ? t("Bỏ qua {{dsLyDo}}.", { dsLyDo: [...theoLyDo].map(([lyDo, so]) => `${formatNumberOrDash(so)} SKU ${String(lyDo).toLocaleLowerCase("vi")}`).join(", ") })
        : undefined;
      // Hiện giá mới ngay (lần tải lại sau đó có lỗi thì bảng vẫn đúng giá vừa lưu)
      const giaMoi = new Map(daDoi.map((x) => [x.id, x.giaBanMoi]));
      const bayGio = new Date().toISOString();
      ds.setData((cu) =>
        cu?.content
          ? {
              ...cu,
              content: cu.content.map((g) => ({
                ...g,
                bienThe: g.bienThe.map((b) => (giaMoi.has(b.id) ? { ...b, giaBan: giaMoi.get(b.id), ngayDoiGiaGanNhat: bayGio } : b)),
              })),
            }
          : cu,
      );
      if (daDoi.length) {
        toast.success(t("Đã đổi giá bán {{so}} SKU", { count: daDoi.length, so: formatNumberOrDash(daDoi.length) }), {
          // Mỗi lần lưu một thông báo riêng (không gộp "×2"), để nút "In lại" của lần trước không bị thay mất
          id: `doi-gia-${Date.now()}`,
          description: ghiChu,
          action: soTem > 0 ? { label: t("In lại {{so}} tem", { count: soTem, so: formatNumberOrDash(soTem) }), onClick: () => moInTem("doi-gia", inLai) } : undefined,
        });
      } else {
        toast.info(t("Không có SKU nào đổi giá"), { description: ghiChu });
      }
      ds.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("Không đổi được giá bán")));
    } finally {
      setDangLuuGia(false);
    }
  };

  /** "Đặt giá" ở hộp In tem: đóng hộp, đưa SKU lên bảng (tìm theo SKU nếu không có ở trang này) rồi mở ô giá của nó. */
  const datGiaTuHopIn = (d) => {
    setHopInTem(null);
    if (rows.some((r) => r.id === d.id)) {
      // Dòng tô sáng làm nhóm chứa nó tự mở; nhóm đó vẫn gập (đã Thu gọn tất cả / tự gập) thì lật riêng nhóm đó,
      // không đụng cách mở / gập các nhóm khác
      const g = nhom.find((x) => x.dong.some((r) => r.id === d.id));
      setNoiBat(d.id);
      if (g && !laMotPhanLoai(g) && !nhomDangMo({ moTatCa, tuMo: true, boTuMo, laNgoaiLe: ngoaiLe.has(g.khoa) })) doiGon(g.khoa);
      window.setTimeout(() => {
        document.getElementById(`gia-ban-dong-${d.id}`)?.scrollIntoView({ block: "center" });
        setPopGia(`dong-${d.id}`);
      }, 250);
      return;
    }
    // Không có ở trang này: tìm đúng SKU ở tab Tất cả (SKU chưa có giá luôn đang hoạt động)
    const ma = d.maSku || d.maVachSku;
    setSearchText(ma);
    setTuKhoa(ma);
    setCanXuLy(false);
    setTab(TAB_MAC_DINH);
    setTrang((cu) => ({ ...cu, page: 0 }));
    datLaiBang();
    setChoQuet({ ma, moGia: true });
  };

  const statusTabs = TAB_GIA_BAN.map((tab) => ({
    value: tab.value,
    label: tab.label,
    count: (ds.loading && !ds.dungKhoa) || !duLieu.demTheoTab
      ? null
      : tab.value === "tat-ca"
        ? duLieu.demTheoTab.tatCa
        : tab.value === "hoat-dong"
          ? duLieu.demTheoTab.hoatDong
          : duLieu.demTheoTab.ngungHoatDong,
  }));
  const soCanXuLy = (Number(duLieu.canXuLy?.chuaCoGia) || 0) + (Number(duLieu.canXuLy?.duoiGiaVon) || 0);
  const daChon = rows.filter((r) => chon.has(r.id));
  const tatCaIds = rows.map((r) => r.id);

  /** Ô giá bán của một SKU: quản trị viên sửa được (SKU đang hoạt động); quản lý kho và SKU ngừng chỉ xem chữ. */
  const oGiaDong = (d) => {
    const hienThi = hienThiGiaDong(d);
    if (!laQuanTriVien || !dangHoatDong(d)) return <ChuGia hienThi={hienThi} />;
    const khoa = `dong-${d.id}`;
    return (
      <OGiaBan
        dsDong={[d]}
        hienThi={hienThi}
        tieuDe={t("Giá bán · {{bienThe}}", { bienThe: nhanBienThe(d) })}
        phu={d.maSku}
        ariaLabel={t("Đổi giá bán {{maSku}}", { maSku: d.maSku })}
        open={popGia === khoa}
        onOpenChange={(mo) => setPopGia(mo ? khoa : null)}
        lyDoMacDinh={lyDoTruoc}
        dangLuu={dangLuuGia}
        onLuu={luuGia}
        onXemLichSu={() => {
          setPopGia(null);
          setLichSuGia(d);
        }}
      />
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
        id={`gia-ban-dong-${d.id}`}
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
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", Number(d.tonKho) === 0 ? "text-slate-400" : "text-bo-foreground")}>
          {formatNumberOrDash(d.tonKho)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-muted cam-ung:max-lg:hidden">{formatNumberOrDash(d.giaVon)}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right">
          {oGiaDong(d)}
          <p className="hidden text-xs tabular-nums text-bo-muted cam-ung:max-lg:block">{t("Vốn {{giaVon}}", { giaVon: formatNumberOrDash(d.giaVon) })}</p>
        </td>
        <td className="w-24 px-2 py-2.5">
          <RowActions>
            <RowActionButton icon={History} label={t("Lịch sử giá {{maSku}}", { maSku: d.maSku })} onClick={() => setLichSuGia(d)} />
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
   * Hàng sản phẩm nhiều phân loại: bấm chỗ nào trên hàng cũng mở/gập; chọn cả nhóm (có lưng chừng); tổng tồn; giá vốn khi
   * mọi phân loại bằng nhau; giá bán một số / khoảng / chưa có; in tem cả sản phẩm. Đang mở thì hàng dính dưới tiêu đề cột.
   */
  const hangNhom = (g, mo) => {
    const ids = g.dong.map((d) => d.id);
    const tt = tomTatNhom(g);
    const hienThi = hienThiGiaNhom(tt.giaBan);
    const soHoatDong = g.dong.filter(dangHoatDong).length;
    const khoa = `nhom-${g.khoa}`;
    // Nhóm hiện thiếu phân loại vì tìm theo SKU / cần xử lý giá (lọc theo tab không tính: phân loại ẩn là phân loại ngừng)
    const motPhan = ((Boolean(tuKhoa) && !g.khopTen) || canXuLy) && g.dong.length < g.tongPhanLoai;
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
        <td className={cn("px-3 py-2.5 cam-ung:max-lg:hidden", o)} />
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-bo-heading", o)}>{formatNumberOrDash(tt.tongTon)}</td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-muted cam-ung:max-lg:hidden", o)}>
          {tt.giaVonChung !== null ? formatNumberOrDash(tt.giaVonChung) : null}
        </td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right", o)}>
          {laQuanTriVien && soHoatDong > 0 ? (
            <OGiaBan
              dsDong={g.dong}
              hienThi={hienThi}
              tieuDe={motPhan ? t("Giá bán các phân loại đang hiện") : t("Giá bán cả sản phẩm")}
              phu={t("Áp dụng cho {{so}} phân loại đang hoạt động", { count: soHoatDong, so: formatNumberOrDash(soHoatDong) })}
              ariaLabel={t("Đổi giá bán cả sản phẩm {{ten}}", { ten: g.ten })}
              open={popGia === khoa}
              onOpenChange={(moPop) => setPopGia(moPop ? khoa : null)}
              lyDoMacDinh={lyDoTruoc}
              dangLuu={dangLuuGia}
              onLuu={luuGia}
            />
          ) : (
            <ChuGia hienThi={hienThi} />
          )}
          {tt.giaVonChung !== null ? (
            <p className="hidden text-xs tabular-nums text-bo-muted cam-ung:max-lg:block">{t("Vốn {{giaVon}}", { giaVon: formatNumberOrDash(tt.giaVonChung) })}</p>
          ) : null}
        </td>
        <td className={cn("w-24 px-2 py-2.5", o)}>
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
      className="grid size-9 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-primary disabled:opacity-40"
    >
      <Printer className="size-[18px]" aria-hidden="true" />
    </button>
  );

  /**
   * Thẻ một SKU: ô chọn, (ảnh + tên khi là sản phẩm một phân loại); màu - cỡ cùng hàng với giá bán (bấm để đổi như ô giá
   * của bảng) và In tem; dưới đó SKU · mã vạch, tồn · giá vốn trải hết bề ngang. `trongNhom`: nằm dưới thẻ sản phẩm nhiều
   * phân loại (thụt vào, không ảnh).
   */
  const theSku = (d, g, trongNhom) => {
    const ngung = !dangHoatDong(d);
    return (
      <li
        key={d.id}
        id={`gia-ban-dong-${d.id}`}
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
          <div className="flex min-h-9 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
              <NhanBienThe dong={d} className={trongNhom ? "text-sm text-bo-foreground" : "text-[13px] text-bo-muted"} />
              {ngung ? <StatusBadge /* i18n-giu-nguyen: StatusBadge tự dịch */ label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
            </div>
            <div className="flex shrink-0 items-center text-sm">
              {oGiaDong(d)}
              {nutIn(ngung ? t("SKU ngừng hoạt động") : t("In tem {{maSku}}", { maSku: d.maSku }), () => moInTem("chon", [d]), ngung)}
              <button
                type="button"
                aria-label={t("Lịch sử giá {{maSku}}", { maSku: d.maSku })}
                title={t("Lịch sử giá {{maSku}}", { maSku: d.maSku })}
                onClick={() => setLichSuGia(d)}
                className="grid size-9 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-primary"
              >
                <History className="size-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="truncate text-[12.5px] text-bo-muted">
            <ToKhop text={d.maSku || "—"} tu={tuKhoa} /> · {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
          </p>
          <p className="text-[12.5px] tabular-nums text-bo-muted">
            {t("Tồn")} <span className={Number(d.tonKho) === 0 ? "text-slate-400" : "font-medium text-bo-foreground"}>{formatNumberOrDash(d.tonKho)}</span>
            {" · "}{t("Vốn {{giaVon}}", { giaVon: formatNumberOrDash(d.giaVon) })}
          </p>
        </div>
      </li>
    );
  };

  /**
   * Thẻ sản phẩm nhiều phân loại: ô chọn cả nhóm, bấm phần tên để mở / thu gọn các phân loại; số phân loại · tổng tồn,
   * giá vốn chung, giá bán cả sản phẩm (một số / khoảng / chưa có) và In tem cả sản phẩm. Đang mở thì các SKU nằm ngay dưới.
   */
  const theNhom = (g, mo) => {
    const ids = g.dong.map((d) => d.id);
    const tt = tomTatNhom(g);
    const hienThi = hienThiGiaNhom(tt.giaBan);
    const soHoatDong = g.dong.filter(dangHoatDong).length;
    const khoa = `nhom-${g.khoa}`;
    const motPhan = ((Boolean(tuKhoa) && !g.khopTen) || canXuLy) && g.dong.length < g.tongPhanLoai;
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
                  {t("{{phanLoai}} · Tồn {{tongTon}}", { phanLoai: nhanPhanLoai(g, motPhan, formatNumberOrDash), tongTon: formatNumberOrDash(tt.tongTon) })}
                </span>
              </span>
              <span className="grid size-11 shrink-0 place-items-center text-bo-muted">
                <ChevronRight className={cn("size-[18px] transition-transform duration-150 motion-reduce:transition-none", mo && "rotate-90")} aria-hidden="true" />
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pl-[52px]">
            <span className="min-w-0 truncate text-[12.5px] tabular-nums text-bo-muted">
              {tt.giaVonChung !== null ? t("Vốn {{giaVon}}", { giaVon: formatNumberOrDash(tt.giaVonChung) }) : null}
            </span>
            <span className="flex shrink-0 items-center text-sm">
              {laQuanTriVien && soHoatDong > 0 ? (
                <OGiaBan
                  dsDong={g.dong}
                  hienThi={hienThi}
                  tieuDe={motPhan ? t("Giá bán các phân loại đang hiện") : t("Giá bán cả sản phẩm")}
                  phu={t("Áp dụng cho {{so}} phân loại đang hoạt động", { count: soHoatDong, so: formatNumberOrDash(soHoatDong) })}
                  ariaLabel={t("Đổi giá bán cả sản phẩm {{ten}}", { ten: g.ten })}
                  open={popGia === khoa}
                  onOpenChange={(moPop) => setPopGia(moPop ? khoa : null)}
                  lyDoMacDinh={lyDoTruoc}
                  dangLuu={dangLuuGia}
                  onLuu={luuGia}
                />
              ) : (
                <span className="px-2">
                  <ChuGia hienThi={hienThi} />
                </span>
              )}
              {nutIn(t("In tem cả sản phẩm {{ten}}", { ten: g.ten }), () => moInTem("chon", g.dong))}
            </span>
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
          <Button type="button" variant="outline" onClick={() => setHopChonPhieu(true)} className={NUT_DAU_TRANG}>
            <FileText className="size-4" aria-hidden="true" />
            {t("In tem theo phiếu nhập")}
          </Button>
        }
      />

      {laQuanTriVien && !canXuLy ? (
        <AttentionBar
          count={soCanXuLy}
          tone="warning"
          actionLabel={t("Xem các SKU này")}
          onAction={() => {
            // Số đếm là của cả hệ thống: bỏ từ khóa đang tìm để thấy đủ các SKU này
            setSearchText("");
            setTuKhoa("");
            batCanXuLy(true);
          }}
        >
          {[
            Number(duLieu.canXuLy?.chuaCoGia) > 0 ? (
              <Fragment key="chua">
                <strong className="font-semibold">{formatNumberOrDash(duLieu.canXuLy.chuaCoGia)} SKU</strong> {t("chưa có giá bán")}
              </Fragment>
            ) : null,
            Number(duLieu.canXuLy?.duoiGiaVon) > 0 ? (
              <Fragment key="duoi">
                <strong className="font-semibold">{formatNumberOrDash(duLieu.canXuLy.duoiGiaVon)} SKU</strong> {t("đang bán thấp hơn giá vốn")}
              </Fragment>
            ) : null,
          ]
            .filter(Boolean)
            .flatMap((phan, i) => (i ? [<Fragment key={`va-${i}`}> {t("và")} </Fragment>, phan] : [phan]))}
          .
        </AttentionBar>
      ) : null}

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={<StatusTabs label={t("Lọc SKU theo trạng thái")} tabs={statusTabs} value={tab} onChange={doiTab} />}
              hasFilter={dangLoc}
              onClear={xoaLoc}
            >
              {canXuLy ? (
                <span className="inline-flex h-[30px] items-center gap-1 rounded-full bg-bo-primary-soft pr-1 pl-2.5 text-[13px] font-medium text-bo-primary-strong">
                  {t("Cần xử lý giá")}
                  <button
                    type="button"
                    aria-label={t("Bỏ lọc Cần xử lý giá")}
                    onClick={() => batCanXuLy(false)}
                    className="grid size-[22px] place-items-center rounded-full hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    <X className="size-[13px]" aria-hidden="true" />
                  </button>
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={doiMoTatCa}
                disabled={nhomNhieu.length === 0}
                title={nhomNhieu.length === 0 && rows.length > 0 ? t("Trang này không có sản phẩm nhiều phân loại") : undefined}
                className="h-9 gap-1.5 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-bo-foreground max-sm:h-11"
              >
                {tatCaDangMo ? <ChevronsDownUp className="size-4" aria-hidden="true" /> : <ChevronsUpDown className="size-4" aria-hidden="true" />}
                {tatCaDangMo ? t("Thu gọn tất cả") : t("Mở tất cả")}
              </Button>
              <SearchInput
                label={t("Tìm SKU")}
                placeholder={t("Tìm tên sản phẩm, SKU hoặc quét mã vạch")}
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
            {daChon.length ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-bo-border bg-bo-primary-soft px-3 py-2 text-sm text-bo-primary-strong sm:px-4">
                <span className="mr-1">
                  <strong className="font-semibold tabular-nums">{formatNumberOrDash(daChon.length)}</strong> {t("SKU đã chọn trên trang này")}
                </span>
                <Button type="button" variant="outline" onClick={() => moInTem("chon", daChon)} className={nutPhu}>
                  <Printer className="size-3.5" aria-hidden="true" />
                  {t("In tem")}
                </Button>
                {laQuanTriVien ? (
                  <Button type="button" variant="outline" onClick={() => { setPopGia(null); setHopDoiGia(true); }} className={nutPhu}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t("Đổi giá bán")}
                  </Button>
                ) : null}
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
                setPopGia(null);
                cuonLenDau();
              }}
              onSizeChange={(size) => {
                if (size === trang.size) return;
                const boChon = chon.size;
                nhoSoDong(size);
                setTrang({ page: 0, size });
                setChon(new Set());
                if (boChon) toast.info(t("Đã bỏ chọn {{so}} SKU khi đổi số sản phẩm mỗi trang", { count: boChon, so: formatNumberOrDash(boChon) }));
                setPopGia(null);
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
          tuKhoa ? (
            <EmptyState
              icon={SearchX}
              title={t("Không có SKU khớp “{{tuKhoa}}”", { tuKhoa })}
              description={t("Kiểm tra lại mã vừa quét hoặc từ khóa.")}
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>{t("Xóa lọc")}</Button>}
            />
          ) : canXuLy && tab === "ngung-hoat-dong" ? (
            <EmptyState
              icon={Layers}
              title={t("Không có SKU cần xử lý giá ở mục này")}
              description={t("Bộ lọc Cần xử lý giá chỉ xét SKU đang hoạt động.")}
              action={<Button variant="outline" onClick={() => batCanXuLy(false)} className={NUT_PHU}>{t("Bỏ lọc Cần xử lý giá")}</Button>}
            />
          ) : canXuLy ? (
            <EmptyState
              icon={CircleCheck}
              title={t("Không còn SKU cần xử lý giá")}
              description={t("Mọi SKU đang hoạt động đã có giá bán và không thấp hơn giá vốn.")}
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>{t("Xóa lọc")}</Button>}
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={Layers}
              title={t("Không có SKU nào ở mục này")}
              description={t("Chọn tab Tất cả để xem mọi SKU.")}
              action={<Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>{t("Xem tất cả")}</Button>}
            />
          ) : (
            <EmptyState icon={Layers} title={t("Chưa có SKU")} description={t("SKU được tạo khi thêm sản phẩm ở trang Sản phẩm.")} />
          )
        ) : isMobile ? (
          // Điện thoại: mỗi sản phẩm một thẻ (nhiều phân loại thì mở / thu gọn như bảng), không vuốt ngang
          <ul ref={bangRef} aria-label={t("SKU và giá bán")} className="divide-y divide-bo-border md:hidden">
            {nhom.map((g) => (laMotPhanLoai(g) ? theSku(g.dong[0], g, false) : theNhom(g, laMo(g))))}
          </ul>
        ) : (
          // Máy tính bảng dọc (cảm ứng): bỏ cột SKU · Mã vạch và Giá vốn (SKU xuống dưới tên, giá vốn dưới giá bán),
          // nút In tem 44px — để bảng vừa khung, không vuốt ngang
          <table ref={bangRef} aria-label={t("SKU và giá bán")} className="w-full min-w-[1040px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} w-10 text-left`}>
                  <Checkbox
                    checked={trangThaiChon(tatCaIds, chon)}
                    onCheckedChange={(v) => doiChon(tatCaIds, v === true)}
                    aria-label={t("Chọn mọi SKU trên trang này")}
                    className={CHECKBOX_CLASS}
                  />
                </th>
                <th className={`${TH} text-left`}>{t("Sản phẩm")}</th>
                <th className={`${TH} w-[250px] text-left cam-ung:max-lg:hidden`}>{t("SKU · Mã vạch")}</th>
                <th className={`${TH} w-24 text-right`}>{t("Tồn kho")}</th>
                <th className={`${TH} w-[120px] text-right cam-ung:max-lg:hidden`}>{t("Giá vốn")}</th>
                <th className={`${TH} w-40 text-right`}>{t("Giá bán")}</th>
                <th className={`${TH} w-24`}>
                  <span className="sr-only">{t("Thao tác")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f5]">
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

      <HopDoiGiaNhieu
        open={hopDoiGia && laQuanTriVien}
        onOpenChange={setHopDoiGia}
        dsDong={daChon}
        lyDoMacDinh={lyDoTruoc}
        dangLuu={dangLuuGia}
        onLuu={(v) => luuGia({ ...v, nhieu: true })}
      />

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
        onDatGia={laQuanTriVien ? datGiaTuHopIn : undefined}
        onDaIn={() => setChon(new Set())}
      />

      <NganKeoLichSu
        open={Boolean(lichSuGia)}
        onOpenChange={(mo) => !mo && setLichSuGia(null)}
        tieuDe={lichSuGia ? t("Lịch sử giá {{maSku}}", { maSku: lichSuGia.maSku || nhanBienThe(lichSuGia) }) : t("Lịch sử giá")}
        moTa={t("Ai đổi giá bán, lúc nào, từ bao nhiêu sang bao nhiêu và vì sao. Mới nhất ở trên.")}
        tai={() => (lichSuGia ? layLichSuGiaBienThe(lichSuGia.id) : Promise.resolve([]))}
      />
    </PageContainer>
  );
}
