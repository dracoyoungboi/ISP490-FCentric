import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleCheck, FileText, Layers, Pencil, Printer, SearchX, X } from "lucide-react";
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
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { productService } from "@/services/productService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TAB_MAS = TAB_GIA_BAN.map((t) => t.value);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const NUT_DAU_TRANG = "h-9 gap-2 rounded-md border-bo-border bg-white px-3 text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
const CHECKBOX_CLASS =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white";
const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));
const nhanBienThe = (d) => [d.tenMau, d.kichCo].filter(Boolean).join(" - ") || "—";

/** Chữ giá ở ô Giá bán của một SKU. */
function hienThiGiaDong(d) {
  if (!(Number(d.giaBan) > 0)) return { chu: "Chưa có giá", mau: "chua" };
  return duoiGiaVon(d) ? { chu: soVN(d.giaBan), mau: "duoiVon", title: "Thấp hơn giá vốn" } : { chu: soVN(d.giaBan), mau: "thuong" };
}

/**
 * Chữ giá ở hàng sản phẩm: một số, khoảng giá (xám), hoặc chưa có giá (cam). Một phần phân loại chưa có giá mà các
 * phân loại còn lại cùng một giá thì ghi một số màu xám kèm chú thích (không ghi "450.000 – 450.000").
 */
function hienThiGiaNhom(giaBan) {
  if (giaBan.loai === "chua") return { chu: "Chưa có giá", mau: "chua" };
  if (giaBan.loai === "khoang") {
    const title = giaBan.thieuGia ? "Có phân loại chưa có giá" : undefined;
    if (giaBan.thapNhat === giaBan.caoNhat) return { chu: soVN(giaBan.thapNhat), mau: "khoang", title };
    return { chu: `${soVN(giaBan.thapNhat)} – ${soVN(giaBan.caoNhat)}`, mau: "khoang", title };
  }
  return { chu: soVN(giaBan.gia), mau: "thuong" };
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
  const [noiBat, setNoiBat] = useState(null); // id SKU vừa quét trúng
  const [choQuet, setChoQuet] = useState(() => (maDatGia ? { ma: maDatGia, moGia: laQuanTriVien } : null)); // { ma, moGia? } chờ dữ liệu của từ khóa vừa quét
  const [popGia, setPopGia] = useState(null); // khóa ô giá đang mở: "dong-<id>" | "nhom-<khoa>"
  const [dangLuuGia, setDangLuuGia] = useState(false);
  const [lyDoTruoc, setLyDoTruoc] = useState(() => lyDoDaNho());
  const [hopDoiGia, setHopDoiGia] = useState(false);
  const [hopChonPhieu, setHopChonPhieu] = useState(false);
  const [hopInTem, setHopInTem] = useState(null); // { nguon, dong, maPhieu? }
  const bangRef = useRef(null);

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
        if (choQuet.moGia) toast.info(`Không thấy SKU ${choQuet.ma} trong kết quả tìm`);
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
      const soTem = inLai.reduce((t, d) => t + d.tonKho, 0);
      // "Bỏ qua 2 SKU ngừng hoạt động, 1 SKU giá bán không đổi." — đúng các lý do máy chủ trả
      const theoLyDo = new Map();
      boQua.forEach((b) => theoLyDo.set(b.lyDo, (theoLyDo.get(b.lyDo) ?? 0) + 1));
      const ghiChu = boQua.length
        ? `Bỏ qua ${[...theoLyDo].map(([lyDo, so]) => `${soVN(so)} SKU ${String(lyDo).toLocaleLowerCase("vi")}`).join(", ")}.`
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
        toast.success(`Đã đổi giá bán ${soVN(daDoi.length)} SKU`, {
          // Mỗi lần lưu một thông báo riêng (không gộp "×2"), để nút "In lại" của lần trước không bị thay mất
          id: `doi-gia-${Date.now()}`,
          description: ghiChu,
          action: soTem > 0 ? { label: `In lại ${soVN(soTem)} tem`, onClick: () => moInTem("doi-gia", inLai) } : undefined,
        });
      } else {
        toast.info("Không có SKU nào đổi giá", { description: ghiChu });
      }
      ds.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không đổi được giá bán"));
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

  const statusTabs = TAB_GIA_BAN.map((t) => ({
    value: t.value,
    label: t.label,
    count: (ds.loading && !ds.dungKhoa) || !duLieu.demTheoTab
      ? null
      : t.value === "tat-ca"
        ? duLieu.demTheoTab.tatCa
        : t.value === "hoat-dong"
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
        tieuDe={`Giá bán · ${nhanBienThe(d)}`}
        phu={d.maSku}
        ariaLabel={`Đổi giá bán ${d.maSku}`}
        open={popGia === khoa}
        onOpenChange={(mo) => setPopGia(mo ? khoa : null)}
        lyDoMacDinh={lyDoTruoc}
        dangLuu={dangLuuGia}
        onLuu={luuGia}
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
            aria-label={`Chọn ${d.maSku}`}
            className={CHECKBOX_CLASS}
          />
        </td>
        <td className="max-w-[420px] px-3 py-2.5">
          {trongNhom ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-[42px]">
              <NhanBienThe dong={d} className="text-sm text-bo-foreground" />
              {ngung ? <StatusBadge label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <AnhSanPham src={g.anh} />
              <div className="min-w-0">
                <p className="truncate font-medium text-bo-heading">
                  <ToKhop text={g.ten} tu={tuKhoa} />
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                  <NhanBienThe dong={d} className="text-[13px] text-bo-muted" />
                  {ngung ? <StatusBadge label="Ngừng hoạt động" className="text-[12.5px] font-normal text-bo-muted" /> : null}
                </div>
              </div>
            </div>
          )}
        </td>
        <td className="max-w-[250px] px-3 py-2.5">
          <p className="truncate text-[13.5px] text-bo-foreground">
            <ToKhop text={d.maSku || "—"} tu={tuKhoa} />
          </p>
          <p className="truncate text-[12.5px] tabular-nums text-bo-muted">
            Mã vạch {d.maVachSku ? <ToKhop text={d.maVachSku} tu={tuKhoa} /> : "—"}
          </p>
        </td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", Number(d.tonKho) === 0 ? "text-slate-400" : "text-bo-foreground")}>
          {soVN(d.tonKho)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-muted">{soVN(d.giaVon)}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right">{oGiaDong(d)}</td>
        <td className="w-16 px-2 py-2.5">
          <RowActions>
            <RowActionButton
              icon={Printer}
              label={ngung ? "SKU ngừng hoạt động" : `In tem ${d.maSku}`}
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
          <Checkbox checked={trangThaiChon(ids, chon)} onCheckedChange={(v) => doiChon(ids, v === true)} aria-label={`Chọn cả ${g.ten}`} className={CHECKBOX_CLASS} />
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
              aria-label={mo ? `Thu gọn các phân loại của ${g.ten}` : `Mở các phân loại của ${g.ten}`}
              className="grid size-[22px] shrink-0 place-items-center rounded text-bo-muted hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              <ChevronRight className={cn("size-3.5 transition-transform duration-150 motion-reduce:transition-none", mo && "rotate-90")} />
            </button>
            <AnhSanPham src={g.anh} />
            <div className="min-w-0">
              <p className="truncate font-medium text-bo-heading">
                <ToKhop text={g.ten} tu={tuKhoa} />
              </p>
              <p className="text-[13px] text-bo-muted">{nhanPhanLoai(g, motPhan, soVN)}</p>
            </div>
          </div>
        </td>
        <td className={cn("px-3 py-2.5", o)} />
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-bo-heading", o)}>{soVN(tt.tongTon)}</td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-muted", o)}>
          {tt.giaVonChung !== null ? soVN(tt.giaVonChung) : null}
        </td>
        <td className={cn("whitespace-nowrap px-3 py-2.5 text-right", o)}>
          {laQuanTriVien && soHoatDong > 0 ? (
            <OGiaBan
              dsDong={g.dong}
              hienThi={hienThi}
              tieuDe={motPhan ? "Giá bán các phân loại đang hiện" : "Giá bán cả sản phẩm"}
              phu={`Áp dụng cho ${soVN(soHoatDong)} phân loại đang hoạt động`}
              ariaLabel={`Đổi giá bán cả sản phẩm ${g.ten}`}
              open={popGia === khoa}
              onOpenChange={(moPop) => setPopGia(moPop ? khoa : null)}
              lyDoMacDinh={lyDoTruoc}
              dangLuu={dangLuuGia}
              onLuu={luuGia}
            />
          ) : (
            <ChuGia hienThi={hienThi} />
          )}
        </td>
        <td className={cn("w-16 px-2 py-2.5", o)}>
          <RowActions>
            <RowActionButton icon={Printer} label={`In tem cả sản phẩm ${g.ten}`} onClick={() => moInTem("chon", g.dong)} />
          </RowActions>
        </td>
      </tr>
    );
  };

  const nutPhu = "h-8 gap-1.5 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          <Button type="button" variant="outline" onClick={() => setHopChonPhieu(true)} className={NUT_DAU_TRANG}>
            <FileText className="size-4" aria-hidden="true" />
            In tem theo phiếu nhập
          </Button>
        }
      />

      {laQuanTriVien && !canXuLy ? (
        <AttentionBar
          count={soCanXuLy}
          tone="warning"
          actionLabel="Xem các SKU này"
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
                <strong className="font-semibold">{soVN(duLieu.canXuLy.chuaCoGia)} SKU</strong> chưa có giá bán
              </Fragment>
            ) : null,
            Number(duLieu.canXuLy?.duoiGiaVon) > 0 ? (
              <Fragment key="duoi">
                <strong className="font-semibold">{soVN(duLieu.canXuLy.duoiGiaVon)} SKU</strong> đang bán thấp hơn giá vốn
              </Fragment>
            ) : null,
          ]
            .filter(Boolean)
            .flatMap((phan, i) => (i ? [<Fragment key={`va-${i}`}> và </Fragment>, phan] : [phan]))}
          .
        </AttentionBar>
      ) : null}

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={<StatusTabs label="Lọc SKU theo trạng thái" tabs={statusTabs} value={tab} onChange={doiTab} />}
              hasFilter={dangLoc}
              onClear={xoaLoc}
            >
              {canXuLy ? (
                <span className="inline-flex h-[30px] items-center gap-1 rounded-full bg-bo-primary-soft pr-1 pl-2.5 text-[13px] font-medium text-bo-primary-strong">
                  Cần xử lý giá
                  <button
                    type="button"
                    aria-label="Bỏ lọc Cần xử lý giá"
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
                title={nhomNhieu.length === 0 && rows.length > 0 ? "Trang này không có sản phẩm nhiều phân loại" : undefined}
                className="h-9 gap-1.5 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-bo-foreground max-sm:h-11"
              >
                {tatCaDangMo ? <ChevronsDownUp className="size-4" aria-hidden="true" /> : <ChevronsUpDown className="size-4" aria-hidden="true" />}
                {tatCaDangMo ? "Thu gọn tất cả" : "Mở tất cả"}
              </Button>
              <SearchInput
                label="Tìm SKU"
                placeholder="Tìm tên sản phẩm, SKU hoặc quét mã vạch"
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
                  <strong className="font-semibold tabular-nums">{soVN(daChon.length)}</strong> SKU đã chọn trên trang này
                </span>
                <Button type="button" variant="outline" onClick={() => moInTem("chon", daChon)} className={nutPhu}>
                  <Printer className="size-3.5" aria-hidden="true" />
                  In tem
                </Button>
                {laQuanTriVien ? (
                  <Button type="button" variant="outline" onClick={() => { setPopGia(null); setHopDoiGia(true); }} className={nutPhu}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Đổi giá bán
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setChon(new Set())}
                  className="ml-auto h-8 rounded-lg px-3 text-[13px] text-bo-primary-strong hover:bg-white/70 max-sm:h-11"
                >
                  Bỏ chọn
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
              sizeLabel="sản phẩm"
              totalLabel="sản phẩm"
              sizeOptions={SO_SAN_PHAM_MOI_TRANG}
              sizeMenuTitle="Số sản phẩm mỗi trang"
              sizeMenuNote="Đếm theo sản phẩm; mỗi sản phẩm luôn kèm đủ phân loại nên không bị cắt sang trang sau."
              totalNote={`${soVN(duLieu.tongSku)} SKU`}
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
                if (boChon) toast.info(`Đã bỏ chọn ${soVN(boChon)} SKU khi đổi số sản phẩm mỗi trang`);
                setPopGia(null);
                cuonLenDau();
              }}
            />
          ) : null
        }
      >
        {ds.initialLoading || (ds.loading && rows.length === 0 && !ds.dungKhoa) ? (
          <LoadingState label="Đang tải danh sách SKU" />
        ) : ds.error && !ds.loiTaiLai ? (
          <ErrorState description="Không tải được danh sách SKU. Vui lòng thử lại." onRetry={ds.reload} />
        ) : rows.length === 0 ? (
          tuKhoa ? (
            <EmptyState
              icon={SearchX}
              title={`Không có SKU khớp “${tuKhoa}”`}
              description="Kiểm tra lại mã vừa quét hoặc từ khóa."
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>Xóa lọc</Button>}
            />
          ) : canXuLy && tab === "ngung-hoat-dong" ? (
            <EmptyState
              icon={Layers}
              title="Không có SKU cần xử lý giá ở mục này"
              description="Bộ lọc Cần xử lý giá chỉ xét SKU đang hoạt động."
              action={<Button variant="outline" onClick={() => batCanXuLy(false)} className={NUT_PHU}>Bỏ lọc Cần xử lý giá</Button>}
            />
          ) : canXuLy ? (
            <EmptyState
              icon={CircleCheck}
              title="Không còn SKU cần xử lý giá"
              description="Mọi SKU đang hoạt động đã có giá bán và không thấp hơn giá vốn."
              action={<Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>Xóa lọc</Button>}
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={Layers}
              title="Không có SKU nào ở mục này"
              description="Chọn tab Tất cả để xem mọi SKU."
              action={<Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>Xem tất cả</Button>}
            />
          ) : (
            <EmptyState icon={Layers} title="Chưa có SKU" description="SKU được tạo khi thêm sản phẩm ở trang Sản phẩm." />
          )
        ) : (
          <table ref={bangRef} aria-label="SKU và giá bán" className="w-full min-w-[1040px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} w-10 text-left`}>
                  <Checkbox
                    checked={trangThaiChon(tatCaIds, chon)}
                    onCheckedChange={(v) => doiChon(tatCaIds, v === true)}
                    aria-label="Chọn mọi SKU trên trang này"
                    className={CHECKBOX_CLASS}
                  />
                </th>
                <th className={`${TH} text-left`}>Sản phẩm</th>
                <th className={`${TH} w-[250px] text-left`}>SKU · Mã vạch</th>
                <th className={`${TH} w-24 text-right`}>Tồn kho</th>
                <th className={`${TH} w-[120px] text-right`}>Giá vốn</th>
                <th className={`${TH} w-40 text-right`}>Giá bán</th>
                <th className={`${TH} w-16`}>
                  <span className="sr-only">Thao tác</span>
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
    </PageContainer>
  );
}
