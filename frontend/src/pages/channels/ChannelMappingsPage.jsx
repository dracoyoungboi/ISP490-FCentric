import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CloudDownload, CloudUpload, Loader2, MoreHorizontal, PackageSearch, RefreshCw, SearchX } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import StatusTabs from "@/components/shared/StatusTabs";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import AttentionBar from "@/components/shared/AttentionBar";
import MockModeNotice from "@/components/shared/MockModeNotice";
import SyncLogDetailSheet from "@/components/channel/SyncLogDetailSheet";
import GhepBienThe from "@/components/channel/GhepBienThe";
import { AnhSanPham } from "@/components/channel/HienThiKenh";
import StatusBadge from "@/components/shared/StatusBadge";
import ToKhop from "@/components/shared/ToKhop";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { daKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { VUNG_CHAM_CONG_TAC } from "@/components/channel/KhuonCaiDat";
import ThaoTacDongBo from "@/components/channel/ThaoTacDongBo";
import ThanhNhacUyQuyen from "@/components/channel/ThanhNhacUyQuyen";
import useDongBoNgay from "@/components/channel/useDongBoNgay";
import useSanHienTai from "@/components/channel/useSanHienTai";
import {
  capNhatDongTrongTrang,
  dongCuaTrang,
  gioChungCuaNhom,
  laChoDay,
  laMotPhanLoai,
  nhanSoPhanLoai,
  nhomDangMo,
} from "@/components/channel/nhomLienKet";
import { quyTacTonKho } from "@/components/channel/cauHinhDongBo";
import { ketQuaDayLenSan, ketQuaTaiSanPham } from "@/components/channel/ketQuaThaoTac";
import { LIEN_KET_STATUS, LIEN_KET_TABS, tinhSoTonDayLenSan } from "@/constants/channel";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const TAB_MAS = LIEN_KET_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const CHECKBOX_CLASS =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white";
const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));
const dangDongBo = (dong) => dong.trangThaiLienKet !== "chua_lien_ket";
const coSo = (n) => n !== null && n !== undefined;

/**
 * Số sản phẩm mỗi trang của màn này: mỗi sản phẩm kéo theo đủ SKU, nên không cho 100 (Mở tất cả có thể ra hàng nghìn dòng).
 * Lựa chọn số dòng và chế độ "Mở tất cả" được nhớ trong trình duyệt, theo từng sàn.
 */
const SO_SAN_PHAM_MOI_TRANG = [10, 20, 50];
const nhoSoDong = (maKenh) => `fc:san-pham-kenh:${maKenh}:so-dong`;
const nhoMoTatCa = (maKenh) => `fc:san-pham-kenh:${maKenh}:mo-tat-ca`;
function docNho(khoa) {
  try {
    return window.localStorage.getItem(khoa);
  } catch {
    return null;
  }
}
function ghiNho(khoa, giaTri) {
  try {
    window.localStorage.setItem(khoa, String(giaTri));
  } catch {
    // Trình duyệt chặn lưu (cửa sổ riêng tư…): vẫn dùng được, chỉ không nhớ cho lần sau
  }
}
function soDongDaNho(maKenh) {
  const so = Number(docNho(nhoSoDong(maKenh)));
  return SO_SAN_PHAM_MOI_TRANG.includes(so) ? so : SO_DONG_MAC_DINH;
}

/** Giờ đẩy ngắn gọn: hôm nay chỉ ghi giờ, ngày khác ghi thêm ngày/tháng. */
function gioDayTon(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const gio = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? gio : `${gio} ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
}

/**
 * Ô "Đã đẩy lên sàn": số sàn đã nhận ở lần đẩy thành công gần nhất. Dòng dưới: "→ sẽ đẩy N" (cam) khi đang chờ đẩy,
 * nếu không thì giờ đẩy — trong nhóm chỉ ghi khi khác giờ chung đã ghi ở hàng sản phẩm (`gioNhom`).
 */
function OTonDaDay({ dong, seDay, vuaBat = false, gioNhom = null }) {
  const SAN = useSanHienTai();
  if (!dangDongBo(dong)) return <span className="text-bo-muted">—</span>;
  const daDay = dong.soLuongDaDay;
  const choDay = laChoDay(dong, seDay, vuaBat);
  const gioRieng = coSo(daDay) && dong.ngayDayTonCuoi ? gioDayTon(dong.ngayDayTonCuoi) : null;
  const gio = gioRieng && gioRieng !== gioNhom ? gioRieng : null;
  return (
    <div className="flex flex-col items-end">
      {coSo(daDay) ? (
        <span className="tabular-nums text-bo-foreground" title={gioRieng ? `${SAN.ten} đã nhận lúc ${gioRieng}` : undefined}>
          {soVN(daDay)}
        </span>
      ) : (
        <span className="text-[13px] text-bo-muted">Chưa đẩy</span>
      )}
      {choDay ? (
        <span className="text-[12px] font-medium tabular-nums text-amber-600">{coSo(seDay) ? `→ sẽ đẩy ${soVN(seDay)}` : "Chờ đẩy"}</span>
      ) : gio ? (
        <span className="text-[12px] tabular-nums text-slate-400">{gio}</span>
      ) : null}
    </div>
  );
}

/** Một mục đếm ở hàng sản phẩm: chấm màu + "N trạng thái". */
function DemTrangThai({ so, nhan, mau, className, truoc }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", mau)} aria-hidden="true" />
      <span>
        {truoc ? `${truoc} ` : null}
        <span className="tabular-nums">{soVN(so)}</span> {nhan}
      </span>
    </span>
  );
}

/**
 * Sản phẩm đã liên kết với gian hàng Shopify, gom theo sản phẩm: ảnh, SKU, tồn khả dụng, số hiện trên Shopify,
 * công tắc đồng bộ từng dòng, chọn nhiều dòng để bật/tắt, ghép biến thể khác ngay tại dòng.
 * Đầu trang (PA1 chốt 19/10/2026): ⋯ (Tải sản phẩm từ sàn, Đưa sản phẩm lên sàn) và "Đồng bộ ngay" kèm tiến độ,
 * chung một đợt với Tổng quan và Đơn hàng; đợt xong thì bảng tự tải lại.
 * Phân trang theo sản phẩm (máy chủ trả mỗi sản phẩm kèm đủ SKU), nên đổi số dòng hay chuyển trang
 * không cắt một sản phẩm ra hai nơi; số ở hàng sản phẩm luôn tính trên đủ các SKU khớp bộ lọc.
 */
export default function ChannelMappingsPage() {
  const navigate = useNavigate();
  const SAN = useSanHienTai();
  // Sàn ủy quyền (Lazada, TikTok Shop) không đưa sản phẩm FCentric lên được (KH mục B.6)
  const coDuaLen = SAN.kieuKetNoi === "khoa";
  const NHO_SO_DONG = nhoSoDong(SAN.maKenh);
  const NHO_MO_TAT_CA = nhoMoTatCa(SAN.maKenh);
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = LIEN_KET_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState(() => ({ page: 0, size: soDongDaNho(SAN.maKenh) }));

  const cfg = useTaiDuLieu(() => kenhBanHangService.getKetNoi(SAN.maKenh), `ket-noi|${SAN.maKenh}`);
  const ketNoi = daKetNoi(cfg.data);
  const hetHanUyQuyen = !coDuaLen && trangThaiKetNoi(cfg.data) === "het_han";
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), `cau-hinh-dong-bo|${SAN.maKenh}`, { enabled: ketNoi });
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(SAN.maKenh), `tong-quan|${SAN.maKenh}`, { enabled: ketNoi });
  const ds = useTaiDuLieu(
    () =>
      kenhBanHangService.filterLienKetTheoSanPham(SAN.maKenh, { page: trang.page, size: trang.size, search: tuKhoa, trangThai: tabTrangThai }),
    `${SAN.maKenh}|${tab}|${tuKhoa}|${trang.page}|${trang.size}`,
    { enabled: ketNoi },
  );

  const [dangChay, setDangChay] = useState(null); // { ten, id? }
  const dangChayRef = useRef(null);
  const moGhepSauMenuRef = useRef(null); // dòng sẽ mở ô ghép khi menu ⋯ đóng xong
  const [hoiDayLen, setHoiDayLen] = useState(false);
  const [chiTietId, setChiTietId] = useState(null);
  const [ghepId, setGhepId] = useState(null); // dòng đang mở ô ghép biến thể khác
  const [chon, setChon] = useState(() => new Set());
  // Mở/thu gọn (chốt 21/10): mặc định thu gọn. `moTatCa` là chế độ (nhớ trong trình duyệt, giữ khi sang trang);
  // `ngoaiLe` là nhóm người dùng tự lật ngược chế độ. Đổi tab / tìm kiếm thì xóa ngoại lệ, giữ chế độ.
  const [moTatCa, setMoTatCa] = useState(() => docNho(NHO_MO_TAT_CA) === "1");
  const [ngoaiLe, setNgoaiLe] = useState(() => new Set());
  // Đã bấm "Thu gọn tất cả" ở tab / lần tìm này: không tự mở nhóm nữa (kể cả trang sau) tới khi đổi tab hoặc từ khóa
  const [boTuMo, setBoTuMo] = useState(false);
  // SKU vừa bật lại ở trang này mà chưa có lần đẩy nào sau đó: hiện "→ sẽ đẩy N"; tải lại bảng thì bỏ
  const [vuaBat, setVuaBat] = useState(() => new Set());
  const [hoiNgung, setHoiNgung] = useState(null); // { tieuDe, dong: [...], xong? }
  const bangRef = useRef(null);

  // Gõ tìm kiếm: chờ người dùng ngừng gõ rồi mới lọc
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const moi = searchText.trim();
      if (moi === tuKhoa) return;
      setTuKhoa(moi);
      setTrang((cu) => ({ ...cu, page: 0 }));
      setChon(new Set());
      setNgoaiLe(new Set());
      setBoTuMo(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, tuKhoa]);

  // Lần tải gần nhất là tự tải ngầm khi quay lại tab: lỗi thì giữ bảng cũ, không thay bằng ô báo lỗi
  const [tuTaiNgam, setTuTaiNgam] = useState(false);
  const taiLai = (ngam) => {
    setTuTaiNgam(ngam);
    setVuaBat(new Set());
    ds.reload();
    tq.reload();
  };
  const taiLaiTatCa = () => taiLai(false);
  // Quay lại tab thì tải lại ngầm (đồng bộ chạy nền ở máy chủ); không tải khi đang chạy thao tác
  useTaiLaiKhiQuayLai(() => taiLai(true), { bat: ketNoi && !ds.loading && !dangChay, lanCuoi: ds.capNhatLuc });
  // Đồng bộ ngay chạy nền ở máy chủ, chung cho cả gian hàng: xong (dù bấm ở trang nào) thì tải lại bảng ngầm
  const dongBo = useDongBoNgay(SAN.maKenh, {
    enabled: ketNoi,
    onXong: () => taiLai(true),
    // Bấm Đồng bộ ngay mà máy chủ báo hết hạn ủy quyền / chưa kết nối: đọc lại kết nối (khóa nút và hiện thanh nhắc,
    // hoặc về màn chưa kết nối) và tải lại danh sách sàn của menu bên trái
    onMatKetNoi: () => {
      cfg.reload();
      void taiLaiKenhDaKetNoi();
    },
  });
  const idLyDoHetHan = useId();
  // Thao tác gọi sàn mà máy chủ báo hết hạn ủy quyền / chưa kết nối / Shopify từ chối khóa làm mới: đọc lại kết nối
  // như khi Đồng bộ ngay gặp lỗi đó
  const khiMatKetNoi = (error) => {
    if (!["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI", "LAM_MOI_KHOA_LOI"].includes(getApiErrorCode(error))) return;
    cfg.reload();
    void taiLaiKenhDaKetNoi();
  };

  // Trang đang xem vượt số trang thật sau khi tải lại (sản phẩm cuối vừa đổi trạng thái) → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (ds.loading) return;
    const trangCuoi = trangCuoiNeuVuot({
      trang: trang.page,
      kichThuoc: trang.size,
      soDong: ds.data?.content?.length ?? 0,
      tong: ds.data?.totalElements,
    });
    if (trangCuoi != null) queueMicrotask(() => setTrang((cu) => ({ ...cu, page: trangCuoi })));
  }, [ds.loading, ds.data, trang.page, trang.size]);

  // Chưa kết nối: Shopify vào thẳng Thiết lập như trước; sàn ủy quyền về màn giới thiệu 4 bước (KH mục B.5)
  if (cfg.data && !ketNoi) return <Navigate to={coDuaLen ? `${SAN.duongDan}/setup` : SAN.duongDan} replace />;

  const quyTac = ch.data ? quyTacTonKho(ch.data) : null;
  const nhom = ds.data?.content ?? [];
  const rows = dongCuaTrang(nhom);
  const tongSanPham = ds.data?.totalElements ?? 0;
  const loiTaiNgam = tuTaiNgam && ds.loiTaiLai;
  const tongQuan = tq.data;
  const chiTiet = rows.find((r) => r.id === chiTietId) ?? null;
  const dangLoc = Boolean(tuKhoa);
  const daChon = rows.filter((r) => chon.has(r.id));
  const khoa = Boolean(dangChay);
  const dongBoDangChay = dongBo.dangChay || dongBo.dangGui;
  // Việc gọi tới gian hàng (tải, đưa lên): không chạy chồng lên nhau, không chạy khi đang đồng bộ
  const khoaViecGianHang = khoa || !ketNoi || dongBoDangChay || hetHanUyQuyen;
  // Công tắc, Thử lại, thao tác hàng loạt: khóa khi đang lưu một thao tác trên bảng hoặc khi đợt Đồng bộ ngay đang chạy
  // (đợt đang đẩy tồn, đổi trạng thái giữa chừng thì kết quả đợt và bảng lệch nhau)
  const khoaBang = khoa || dongBoDangChay;
  const viecPhu = dangChay?.ten === "tai" ? "Đang tải sản phẩm…" : dangChay?.ten === "day-len" ? "Đang đưa sản phẩm lên…" : null;
  const baoDangDongBo = () => toast.warning(`Đang đồng bộ với ${SAN.ten}, chờ đợt này xong rồi chạy`);
  // Ủy quyền hết hạn: khóa mọi việc gọi tới sàn (tải sản phẩm, Đồng bộ ngay, đẩy tồn lại, Thử lại). Thanh nhắc ở đầu trang
  // đã ghi hết hạn nên lý do không lặp thành chữ: hiện ở chú thích của nút và đọc qua aria-describedby
  const lyDoHetHan = hetHanUyQuyen ? `Ủy quyền ${SAN.ten} đã hết hạn, ủy quyền lại trước khi chạy.` : null;
  const moTaHetHan = lyDoHetHan ? idLyDoHetHan : undefined;
  const baoHetHan = () => toast.warning(`Ủy quyền ${SAN.ten} đã hết hạn, ủy quyền lại trước khi chạy`);

  const chay = async (ten, viec, id) => {
    if (dangChayRef.current) return undefined;
    dangChayRef.current = ten;
    setDangChay({ ten, id });
    try {
      return await viec();
    } finally {
      dangChayRef.current = null;
      setDangChay(null);
    }
  };

  const capNhatDong = (dongMoi) => {
    if (!dongMoi?.id) return;
    // Giữ số tồn khả dụng, ảnh và biến thể đang ghép của dòng cũ khi API không trả lại các giá trị này
    // (ngừng đồng bộ chỉ đổi trạng thái, vẫn giữ ghép để bật lại đúng biến thể cũ)
    ds.setData((cu) =>
      capNhatDongTrongTrang(cu, dongMoi.id, (r) => ({
        ...r,
        ...dongMoi,
        soLuongKhaDung: r.soLuongKhaDung ?? dongMoi.soLuongKhaDung,
        anhDaiDien: dongMoi.anhDaiDien ?? r.anhDaiDien,
        bienTheSanPhamId: dongMoi.bienTheSanPhamId ?? r.bienTheSanPhamId,
        maSku: dongMoi.maSku ?? r.maSku,
        tenBienThe: dongMoi.tenBienThe ?? r.tenBienThe,
        tenSanPham: dongMoi.tenSanPham ?? r.tenSanPham,
      })),
    );
  };

  const taiTuSan = () => {
    if (hetHanUyQuyen) return baoHetHan();
    if (dongBoDangChay) return baoDangDongBo();
    return chay("tai", async () => {
      try {
        const res = await kenhBanHangService.taiSanPham(SAN.maKenh);
        const kq = ketQuaTaiSanPham(res, SAN.ten);
        toast.success(kq.title, kq.message ? { description: kq.message } : undefined);
        taiLaiTatCa();
      } catch (error) {
        khiMatKetNoi(error);
        toast.error(getApiErrorMessage(error, `Không tải được sản phẩm từ ${SAN.ten}`));
      }
    });
  };

  const dayLenSan = () => {
    // Hộp hỏi lại đang mở thì có thể ai đó vừa bấm Đồng bộ ngay: không chạy chồng
    if (dongBoDangChay) {
      setHoiDayLen(false);
      return baoDangDongBo();
    }
    return chay("day-len", async () => {
      try {
        const res = await kenhBanHangService.dayVaLienKetSanPham(SAN.maKenh);
        setHoiDayLen(false);
        const kq = ketQuaDayLenSan(res, SAN.ten);
        (kq.ok ? toast.success : toast.warning)(kq.title, { description: kq.message });
        taiLaiTatCa();
      } catch (error) {
        setHoiDayLen(false);
        khiMatKetNoi(error);
        toast.error(getApiErrorMessage(error, "Không đưa được sản phẩm lên Shopify"));
      }
    });
  };

  /** Bật/tắt một dòng. Ngừng: bỏ khỏi đợt đẩy tồn (giữ ghép). Bật: ghép lại đúng biến thể cũ. */
  const doiDongBo = async (dong, bat) => {
    const res = await kenhBanHangService.capNhatLienKet(dong.id, {
      bienTheSanPhamId: bat ? dong.bienTheSanPhamId : null,
      choPhepDongBo: bat,
    });
    capNhatDong(res);
  };
  const doiVuaBat = (ids, them) =>
    setVuaBat((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (them ? moi.add(id) : moi.delete(id)));
      return moi;
    });

  /** Bật lại một dòng (cả khi bấm Hoàn tác): bật xong là chờ đẩy, lần đồng bộ tới mới đổi số trên sàn. */
  const batLai = (dong, hoanTac = false) => {
    if (dongBoDangChay) return baoDangDongBo();
    return chay(
      "bat-tat",
      async () => {
        try {
          await doiDongBo(dong, true);
          doiVuaBat([dong.id], true);
          tq.reload();
          toast.success(hoanTac ? `Đã bật lại ${dong.maSku}` : `Đã bật đồng bộ ${dong.maSku}`, {
            description: `Số tồn sẽ được đẩy lên ${SAN.ten} ở lần đồng bộ tới.`,
          });
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không bật lại được đồng bộ"));
        }
      },
      dong.id,
    );
  };

  /**
   * Công tắc một dòng. Ngừng một SKU: làm ngay, có Hoàn tác (sàn giữ nguyên số cũ nên nhắc số đó).
   * Ngừng nhiều SKU một lúc thì đi qua hộp hỏi lại (hoiNgung).
   */
  const batTat = (dong) => {
    if (dangDongBo(dong) === false) return batLai(dong);
    if (dongBoDangChay) return baoDangDongBo();
    return chay(
      "bat-tat",
      async () => {
        try {
          await doiDongBo(dong, false);
          doiVuaBat([dong.id], false);
          tq.reload();
          toast.success(`Đã ngừng đồng bộ ${dong.maSku}`, {
            description: coSo(dong.soLuongDaDay)
              ? `${SAN.ten} giữ nguyên số ${soVN(dong.soLuongDaDay)} đang hiện.`
              : `${SAN.ten} giữ nguyên số đang hiện.`,
            action: { label: "Hoàn tác", onClick: () => batLai(dong, true) },
          });
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không đổi được trạng thái đồng bộ"));
        }
      },
      dong.id,
    );
  };

  /** Bật hoặc ngừng nhiều dòng (chọn nhiều, công tắc hàng sản phẩm). `xong`: gọi sau khi chạy (VD bỏ chọn). */
  const doiNhieu = (dsDong, bat, xong) => {
    if (dongBoDangChay) return baoDangDongBo();
    return chay("nhieu", async () => {
      const canDoi = dsDong.filter((dong) => dangDongBo(dong) !== bat && (!bat || dong.bienTheSanPhamId));
      const daDoi = [];
      let loi = 0;
      for (const dong of canDoi) {
        try {
          await doiDongBo(dong, bat);
          daDoi.push(dong.id);
        } catch {
          loi += 1;
        }
      }
      doiVuaBat(daDoi, bat);
      tq.reload();
      xong?.();
      const cau = `${bat ? "Đã bật" : "Đã ngừng"} đồng bộ ${soVN(daDoi.length)} SKU`;
      const ghiChu = bat && daDoi.length ? `Số tồn sẽ được đẩy lên ${SAN.ten} ở lần đồng bộ tới.` : undefined;
      if (loi) toast.warning(cau, { description: `${soVN(loi)} SKU không đổi được, thử lại sau.` });
      else toast.success(cau, ghiChu ? { description: ghiChu } : undefined);
    });
  };

  /** Hỏi lại trước khi ngừng nhiều SKU; chỉ tính dòng đang đồng bộ, không còn dòng nào thì báo luôn. */
  const hoiNgungNhieu = (dsDong, tieuDe, xong) => {
    if (dongBoDangChay) return baoDangDongBo();
    const dangBat = dsDong.filter(dangDongBo);
    if (!dangBat.length) return toast.info("Các SKU đã chọn đều đang ngừng đồng bộ");
    setHoiNgung({ tieuDe: tieuDe(dangBat.length), dong: dangBat, xong });
  };
  const batTatNhieu = (bat) => {
    const boChon = () => setChon(new Set());
    if (bat) {
      if (!daChon.some((dong) => !dangDongBo(dong))) return toast.info("Các SKU đã chọn đều đang đồng bộ");
      return doiNhieu(daChon, true, boChon);
    }
    return hoiNgungNhieu(daChon, (n) => `Ngừng đồng bộ ${soVN(n)} SKU?`, boChon);
  };
  /** Công tắc hàng sản phẩm: đang bật hết → hỏi rồi ngừng cả nhóm; còn lại (tắt hết / lưng chừng) → bật hết. */
  const batTatNhom = (g) => {
    if (g.dong.every(dangDongBo)) return hoiNgungNhieu(g.dong, (n) => `Ngừng đồng bộ cả ${g.ten} (${soVN(n)} SKU)?`);
    return doiNhieu(g.dong, true);
  };

  /** Đẩy tồn lại các SKU đã chọn ngay (từng SKU, như Thử lại); SKU đang ngừng được bỏ qua và báo rõ. */
  const dayTonLai = () => {
    if (hetHanUyQuyen) return baoHetHan();
    if (dongBoDangChay) return baoDangDongBo();
    const canDay = daChon.filter(dangDongBo);
    const boQua = daChon.length - canDay.length;
    if (!canDay.length) return toast.info("Các SKU đã chọn đều đang ngừng đồng bộ, bật lại trước khi đẩy tồn");
    return chay("day-ton", async () => {
      let ok = 0;
      let conLoi = 0;
      let loiKenh = null;
      for (const dong of canDay) {
        try {
          const res = await kenhBanHangService.thuLaiLienKet(dong.id);
          capNhatDong(res);
          if (res?.trangThaiLienKet === "loi") conLoi += 1;
          else ok += 1;
        } catch (error) {
          // Lỗi cả gian hàng (mất kết nối, hết hạn mức…): các SKU sau cũng sẽ lỗi y vậy → dừng
          khiMatKetNoi(error);
          loiKenh = getApiErrorMessage(error, `Không đẩy được tồn lên ${SAN.ten}`);
          break;
        }
      }
      doiVuaBat(canDay.map((d) => d.id), false);
      tq.reload();
      setChon(new Set());
      const ghiChu = [conLoi ? `${soVN(conLoi)} SKU vẫn lỗi` : null, boQua ? `bỏ qua ${soVN(boQua)} SKU đang ngừng` : null]
        .filter(Boolean)
        .join(", ");
      if (loiKenh) toast.error(`Dừng giữa chừng: ${loiKenh}`, { description: `Đã đẩy ${soVN(ok)} SKU trước khi dừng.` });
      else if (conLoi) toast.warning(`Đã đẩy tồn ${soVN(ok)} SKU lên ${SAN.ten}`, { description: ghiChu });
      else toast.success(`Đã đẩy tồn ${soVN(ok)} SKU lên ${SAN.ten}`, ghiChu ? { description: ghiChu } : undefined);
    });
  };

  const thuLai = (dong) => {
    if (hetHanUyQuyen) return baoHetHan();
    if (dongBoDangChay) return baoDangDongBo();
    return chay(
      "thu-lai",
      async () => {
        try {
          const res = await kenhBanHangService.thuLaiLienKet(dong.id);
          capNhatDong(res);
          doiVuaBat([dong.id], false);
          tq.reload();
          if (res?.trangThaiLienKet === "loi") toast.error(`Vẫn lỗi: ${res.chiTietLoi || "không đẩy được tồn kho"}`);
          else toast.success(`Đã đẩy lại tồn ${dong.maSku}`);
        } catch (error) {
          khiMatKetNoi(error);
          toast.error(getApiErrorMessage(error, "Không thử lại được"));
        }
      },
      dong.id,
    );
  };

  const ghep = (dong, bienThe) =>
    chay(
      "ghep",
      async () => {
        try {
          const res = await kenhBanHangService.capNhatLienKet(dong.id, { bienTheSanPhamId: bienThe.id, choPhepDongBo: true });
          const sanPhamCu = nhom.find((g) => g.dong.some((d) => d.id === dong.id))?.sanPhamId ?? null;
          capNhatDong(res);
          // Biến thể của sản phẩm khác: dòng phải sang nhóm (có thể ở trang khác) của sản phẩm đó → tải lại trang
          // (như tải ngầm: lỗi thì giữ bảng đang xem, chân bảng không thay bằng ô báo lỗi)
          if (res?.sanPhamId != null && res.sanPhamId !== sanPhamCu) {
            setTuTaiNgam(true);
            ds.reload();
          }
          tq.reload();
          setGhepId(null);
          toast.success(`Đã ghép với ${bienThe.maSku}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không ghép được biến thể"));
        }
      },
      dong.id,
    );

  const statusTabs = LIEN_KET_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    tone: t.ma === "loi" ? "danger" : t.ma === "ngung-dong-bo" ? "warning" : undefined,
    count: tongQuan
      ? t.ma === "tat-ca"
        ? tongQuan.tongSkuSan
        : t.ma === "dang-dong-bo"
          ? tongQuan.daLienKet
          : t.ma === "ngung-dong-bo"
            ? tongQuan.chuaLienKet
            : tongQuan.loiDongBo
      : null,
  }));
  // Chân bảng đếm theo sản phẩm, ghi kèm số SKU khớp bộ lọc đang xem (máy chủ trả `tongSku`, đúng cả khi tìm kiếm).
  // Máy chủ cũ chưa có `tongSku`: dùng số trên tab, riêng lúc tìm kiếm thì bỏ vì số trên tab không còn khớp.
  const soSkuTheoTab = coSo(ds.data?.tongSku)
    ? ds.data.tongSku
    : dangLoc
      ? null
      : (statusTabs.find((t) => t.value === tab)?.count ?? null);

  /** Thân bảng về đầu khi đổi trang / số dòng / bộ lọc, để không đứng giữa danh sách mới. */
  const cuonLenDau = () => bangRef.current?.closest(".bo-table-body")?.scrollTo?.({ top: 0 });
  const doiTab = (moi) => {
    setTab(moi);
    setTrang((cu) => ({ ...cu, page: 0 }));
    setChon(new Set());
    setNgoaiLe(new Set());
    setBoTuMo(false);
    cuonLenDau();
  };
  const xoaLoc = () => {
    setSearchText("");
    setTuKhoa("");
    setTrang((cu) => ({ ...cu, page: 0 }));
    setChon(new Set());
    setNgoaiLe(new Set());
    setBoTuMo(false);
    cuonLenDau();
  };
  /**
   * Liên kết trong bảng tiến độ: tab của chính trang này thì bỏ lọc rồi đổi tab tại chỗ (giống mở từ Tổng quan),
   * trang khác của gian hàng thì chuyển trang.
   */
  const den = (duongDan) => {
    const [duong, thamSo = ""] = duongDan.split("?");
    if (duong === "/products") {
      const moi = new URLSearchParams(thamSo).get("trangThai");
      xoaLoc();
      doiTab(TAB_MAS.includes(moi) ? moi : TAB_MAC_DINH);
      return;
    }
    navigate(`${SAN.duongDan}${duongDan}`);
  };
  const doiChon = (ids, them) =>
    setChon((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (them ? moi.add(id) : moi.delete(id)));
      return moi;
    });
  const trangThaiChon = (ids) => {
    const so = ids.filter((id) => chon.has(id)).length;
    return so === 0 ? false : so === ids.length ? true : "indeterminate";
  };
  /**
   * Nhóm tự mở: tab Lỗi / Ngừng (để thấy ngay SKU cần xử lý) và khi tìm kiếm chỉ khớp một phần phân loại
   * (khớp tên sản phẩm thì máy chủ trả đủ phân loại → không tự mở).
   */
  const tuMo = (g) => tab === "loi" || tab === "ngung-dong-bo" || (dangLoc && g.dong.length < g.tongPhanLoai);
  const laMo = (g) => nhomDangMo({ moTatCa, tuMo: tuMo(g), boTuMo, laNgoaiLe: ngoaiLe.has(g.khoa) });
  const doiGon = (khoaNhom) =>
    setNgoaiLe((cu) => {
      const moi = new Set(cu);
      if (moi.has(khoaNhom)) moi.delete(khoaNhom);
      else moi.add(khoaNhom);
      return moi;
    });
  const nhomNhieu = nhom.filter((g) => !laMotPhanLoai(g));
  const tatCaDangMo = nhomNhieu.length > 0 && nhomNhieu.every(laMo);
  /** Mở tất cả / Thu gọn tất cả: đổi chế độ cho mọi trang; thu gọn thì gập cả các nhóm đang tự mở. */
  const doiMoTatCa = () => {
    const mo = !tatCaDangMo;
    setMoTatCa(mo);
    ghiNho(NHO_MO_TAT_CA, mo ? "1" : "0");
    setBoTuMo(!mo);
    setNgoaiLe(new Set());
  };

  /** Số lần đẩy tới sẽ gửi lên sàn (khả dụng × quy tắc ở Cấu hình); null khi dòng ngừng hoặc chưa tải quy tắc. */
  const soSeDay = (dong) => (dangDongBo(dong) && quyTac ? tinhSoTonDayLenSan(dong.soLuongKhaDung, quyTac) : null);

  /**
   * Một dòng SKU. `trongNhom`: nằm dưới hàng sản phẩm (chỉ ghi biến thể, thụt vào); `gioNhom`: giờ đẩy chung đã ghi
   * ở hàng sản phẩm. Cột Trạng thái chỉ hiện ngoại lệ (Lỗi, Ngừng đồng bộ): dòng đang đồng bộ bình thường để trống
   * vì công tắc bên cạnh đã cho biết (chốt 21/10, mỗi thông tin chỉ hiện một lần).
   */
  const dongSku = (dong, trongNhom, gioNhom = null) => {
    const meta = LIEN_KET_STATUS[dong.trangThaiLienKet] ?? { label: dong.trangThaiLienKet ? `Không xác định (mã ${dong.trangThaiLienKet})` : "Chưa có trạng thái" };
    const dangXuLyDong = dangChay?.id === dong.id;
    const choPhepBat = dangDongBo(dong) || Boolean(dong.bienTheSanPhamId);
    return (
      <tr
        key={dong.id}
        onClick={() => setChiTietId(dong.id)}
        className={cn("cursor-pointer transition-colors hover:bg-bo-surface-subtle", chon.has(dong.id) && "bg-bo-primary-soft/50")}
      >
        <td className="w-10 px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={chon.has(dong.id)}
            onCheckedChange={(v) => doiChon([dong.id], v === true)}
            aria-label={`Chọn ${dong.maSku || dong.skuSan}`}
            className={CHECKBOX_CLASS}
          />
        </td>
        <td className="max-w-[360px] px-3 py-2.5">
          {trongNhom ? (
            <p className="truncate pl-[30px] text-bo-foreground">{dong.tenBienThe || dong.tenBienTheSan || "—"}</p>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <AnhSanPham src={dong.anhDaiDien} />
              <div className="min-w-0">
                <p className="truncate font-medium text-bo-heading">
                  <ToKhop text={dong.tenSanPham || dong.tenSanPhamSan || "—"} tu={tuKhoa} />
                </p>
                <p className="truncate text-[13px] text-bo-muted">{dong.tenBienThe || dong.tenBienTheSan || "—"}</p>
              </div>
            </div>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <p className="text-[13.5px] text-bo-foreground">
            <ToKhop text={dong.maSku || "—"} tu={tuKhoa} />
          </p>
          <p className="text-[12.5px] tabular-nums text-slate-400">
            {SAN.ten} <ToKhop text={dong.skuSan || "—"} tu={tuKhoa} />
          </p>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-foreground">{soVN(dong.soLuongKhaDung)}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right">
          <OTonDaDay dong={dong} seDay={soSeDay(dong)} vuaBat={vuaBat.has(dong.id)} gioNhom={gioNhom} />
        </td>
        <td className="px-3 py-2.5">
          {dong.trangThaiLienKet === "da_lien_ket" ? (
            <span className="sr-only">{meta.label}</span>
          ) : (
            <StatusBadge label={meta.label} />
          )}
          {dong.trangThaiLienKet === "loi" ? (
            <div className="mt-1 flex max-w-[260px] items-baseline gap-2 text-xs">
              {dong.chiTietLoi ? (
                <span className="min-w-0 truncate text-bo-danger" title={dong.chiTietLoi}>
                  {dong.chiTietLoi}
                </span>
              ) : null}
              <button
                type="button"
                disabled={khoaBang || hetHanUyQuyen}
                title={lyDoHetHan ?? undefined}
                aria-describedby={moTaHetHan}
                onClick={(event) => {
                  event.stopPropagation();
                  thuLai(dong);
                }}
                className="shrink-0 font-medium text-bo-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
              >
                {dangXuLyDong && dangChay?.ten === "thu-lai" ? "Đang thử lại…" : "Thử lại"}
              </button>
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <Switch
            checked={dangDongBo(dong)}
            disabled={khoaBang || !choPhepBat}
            onCheckedChange={() => batTat(dong)}
            aria-label={`Đồng bộ ${dong.maSku || dong.skuSan}`}
            title={choPhepBat ? undefined : "Chưa ghép biến thể FCentric"}
            className={cn(SWITCH_CLASS, VUNG_CHAM_CONG_TAC)}
          />
        </td>
        <td className="w-12 px-2 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
          <Popover open={ghepId === dong.id} onOpenChange={(mo) => !mo && dangChay?.ten !== "ghep" && setGhepId(null)}>
            <PopoverAnchor asChild>
              <span className="inline-flex">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={khoa}
                      aria-label={`Thao tác khác cho ${dong.maSku || dong.skuSan}`}
                      className="size-8 rounded-md p-0 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground max-sm:size-11"
                    >
                      {dangXuLyDong && dangChay?.ten !== "bat-tat" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                    onCloseAutoFocus={(event) => {
                      // Mở ô ghép sau khi menu đóng hẳn, không trả tiêu điểm về nút ⋯ (ô tìm sẽ nhận tiêu điểm)
                      if (moGhepSauMenuRef.current !== dong.id) return;
                      event.preventDefault();
                      moGhepSauMenuRef.current = null;
                      setGhepId(dong.id);
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        moGhepSauMenuRef.current = dong.id;
                      }}
                      className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                    >
                      Ghép biến thể khác
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setChiTietId(dong.id)} className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                      Xem chi tiết
                    </DropdownMenuItem>
                    {dong.trangThaiLienKet === "loi" ? (
                      <>
                        <DropdownMenuSeparator className="bg-bo-border" />
                        <DropdownMenuItem disabled={khoaBang || hetHanUyQuyen} onSelect={() => thuLai(dong)} className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                          Thử lại
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </PopoverAnchor>
            <PopoverContent
              align="end"
              onFocusOutside={(event) => event.preventDefault()}
              className="w-auto rounded-xl border border-bo-border bg-white p-0 shadow-lg"
            >
              <GhepBienThe
                dong={dong}
                tenSan={SAN.ten}
                dangGhep={dangChay?.ten === "ghep" && dangChay?.id === dong.id}
                onHuy={() => setGhepId(null)}
                onGhep={(bienThe) => ghep(dong, bienThe)}
              />
            </PopoverContent>
          </Popover>
        </td>
      </tr>
    );
  };

  /**
   * Hàng sản phẩm (sản phẩm nhiều phân loại): bấm cả hàng để mở/đóng, chọn cả nhóm, tổng tồn, công tắc cả nhóm.
   * Số liệu tính trên đủ SKU của nhóm. Đang mở thì hàng dính dưới tiêu đề cột khi cuộn qua các phân loại.
   */
  const hangNhom = (g, mo, gioNhom) => {
    const ids = g.dong.map((d) => d.id);
    const soLoi = g.dong.filter((d) => d.trangThaiLienKet === "loi").length;
    const soDangDongBo = g.dong.filter((d) => d.trangThaiLienKet === "da_lien_ket").length;
    const soNgung = g.dong.filter((d) => d.trangThaiLienKet === "chua_lien_ket").length;
    const soBat = g.dong.length - soNgung;
    const tongKhaDung = g.dong.reduce((s, d) => s + (Number(d.soLuongKhaDung) || 0), 0);
    const daDay = g.dong.filter((d) => dangDongBo(d) && coSo(d.soLuongDaDay)).map((d) => Number(d.soLuongDaDay));
    const soChoDay = g.dong.filter((d) => laChoDay(d, soSeDay(d), vuaBat.has(d.id))).length;
    const batDuoc = g.dong.some((d) => dangDongBo(d) || d.bienTheSanPhamId);
    const dinh = mo && "sticky top-10 z-[5] shadow-[inset_0_-1px_0_var(--color-bo-border)]";
    return (
      <tr key={g.khoa} onClick={() => doiGon(g.khoa)} className="group/nhom cursor-pointer">
        <td className={cn("w-10 bg-bo-row-group px-3 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)} onClick={(event) => event.stopPropagation()}>
          <Checkbox checked={trangThaiChon(ids)} onCheckedChange={(v) => doiChon(ids, v === true)} aria-label={`Chọn cả ${g.ten}`} className={CHECKBOX_CLASS} />
        </td>
        <td className={cn("max-w-[360px] bg-bo-row-group px-3 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)}>
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
              <p className="text-[13px] text-bo-muted">
                {nhanSoPhanLoai(g, soVN)}
                {dangLoc && g.dong.length < g.tongPhanLoai ? " khớp" : ""}
              </p>
            </div>
          </div>
        </td>
        <td className={cn("bg-bo-row-group px-3 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)} />
        <td className={cn("whitespace-nowrap bg-bo-row-group px-3 py-2.5 text-right font-medium tabular-nums text-bo-heading group-hover/nhom:bg-bo-row-group-hover", dinh)}>
          {soVN(tongKhaDung)}
        </td>
        <td className={cn("whitespace-nowrap bg-bo-row-group px-3 py-2.5 text-right group-hover/nhom:bg-bo-row-group-hover", dinh)}>
          <div className="flex flex-col items-end">
            <span className="font-medium tabular-nums text-bo-heading">{daDay.length ? soVN(daDay.reduce((s, v) => s + v, 0)) : "—"}</span>
            {soChoDay ? (
              <span className="text-[12px] font-medium tabular-nums text-amber-600">{soVN(soChoDay)} SKU chờ đẩy</span>
            ) : gioNhom ? (
              <span className="text-[12px] tabular-nums text-slate-400" title={`Lần đẩy tồn gần nhất của sản phẩm`}>
                {gioNhom}
              </span>
            ) : null}
          </div>
        </td>
        <td className={cn("bg-bo-row-group px-3 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)}>
          {/* Tóm tắt cả nhóm: việc cần xử lý (lỗi, ngừng) đứng trước; đủ cả nhóm đang đồng bộ thì ghi gọn một cụm */}
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-bo-foreground">
            {soLoi ? <DemTrangThai so={soLoi} nhan="lỗi" mau="bg-bo-danger" className="font-medium text-bo-danger" /> : null}
            {soNgung ? <DemTrangThai so={soNgung} nhan="ngừng" mau="bg-slate-400" /> : null}
            {soDangDongBo === g.dong.length ? (
              <DemTrangThai so={soDangDongBo} nhan="đang đồng bộ" mau="bg-bo-success" truoc="Đủ" />
            ) : soDangDongBo ? (
              <DemTrangThai so={soDangDongBo} nhan="đang đồng bộ" mau="bg-bo-success" />
            ) : null}
          </span>
        </td>
        <td className={cn("bg-bo-row-group px-3 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch
              checked={soBat === g.dong.length}
              disabled={khoaBang || !batDuoc}
              onCheckedChange={() => batTatNhom(g)}
              aria-label={
                soBat === g.dong.length
                  ? `Ngừng đồng bộ cả ${g.ten}`
                  : `Bật đồng bộ cả ${g.ten} (đang bật ${soBat}/${g.dong.length})`
              }
              className={cn(SWITCH_CLASS, VUNG_CHAM_CONG_TAC)}
            />
            {soBat > 0 && soBat < g.dong.length ? (
              <span className="text-xs tabular-nums text-bo-muted" title={`${soBat} trên ${g.dong.length} phân loại đang đồng bộ`}>
                {soBat}/{g.dong.length}
              </span>
            ) : null}
          </div>
        </td>
        <td className={cn("bg-bo-row-group px-2 py-2.5 group-hover/nhom:bg-bo-row-group-hover", dinh)} />
      </tr>
    );
  };

  const tatCaIds = rows.map((r) => r.id);

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title={`Sản phẩm ${SAN.ten}`}
        actions={
          <ThaoTacDongBo
            tienDo={dongBo}
            tenSan={SAN.ten}
            onDen={den}
            viecPhu={viecPhu}
            khoaThaoTac={
              !ketNoi
                ? "Chưa tải xong thông tin gian hàng."
                : lyDoHetHan || (khoa ? "Đang lưu thay đổi trên bảng, chờ xong rồi chạy." : false)
            }
            lyDoKhoaDongBo={hetHanUyQuyen ? "Ủy quyền lại trước khi đồng bộ" : null}
            thaoTac={[
              {
                ma: "tai-san-pham",
                nhan: `Tải sản phẩm từ ${SAN.ten}`,
                // Mô tả mục menu là một câu, có dấu chấm cuối (như menu ⋯ của thẻ Gian hàng)
                moTa: coDuaLen ? `Ghép SKU trùng với FCentric, không đổi gì trên ${SAN.ten}.` : `Ghép SKU trùng mã, không đổi gì trên ${SAN.ten}.`,
                Icon: CloudDownload,
                onChon: taiTuSan,
              },
              ...(coDuaLen
                ? [
                    {
                      ma: "dua-len",
                      nhan: `Đưa sản phẩm FCentric lên ${SAN.ten}…`,
                      moTa: "Tạo sản phẩm thật trên gian hàng, có hỏi lại trước.",
                      Icon: CloudUpload,
                      onChon: () => setHoiDayLen(true),
                    },
                  ]
                : []),
            ]}
          />
        }
      />

      <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />
      <ThanhNhacUyQuyen san={SAN} ketNoi={cfg.data} />
      {/* Lý do khóa các nút gọi sàn cho trình đọc màn hình (aria-describedby); người dùng chuột đọc ở chú thích của nút */}
      {lyDoHetHan ? (
        <span id={idLyDoHetHan} className="sr-only">
          {lyDoHetHan}
        </span>
      ) : null}

      {tab !== "loi" ? (
        <AttentionBar count={tongQuan?.loiDongBo} tone="danger" actionLabel="Xem SKU lỗi" onAction={() => doiTab("loi")}>
          <strong className="font-semibold">{soVN(tongQuan?.loiDongBo)} SKU</strong> đồng bộ lỗi ở lần gần nhất.
        </AttentionBar>
      ) : null}

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={<StatusTabs label="Lọc SKU theo trạng thái đồng bộ" tabs={statusTabs} value={tab} onChange={doiTab} />}
              hasFilter={dangLoc}
              onClear={xoaLoc}
            >
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
                label="Tìm sản phẩm"
                placeholder={`Tìm theo tên sản phẩm, SKU hoặc mã ${SAN.ten}`}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onClear={xoaLoc}
                className="sm:w-[360px]"
              />
            </ListToolbar>
            {dongBoDangChay && rows.length ? (
              <div role="status" className="flex items-center gap-2 border-b border-bo-border bg-bo-surface-subtle px-4 py-2 text-[13px] text-bo-muted">
                <RefreshCw className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Đang đồng bộ với {SAN.ten}: công tắc và thao tác hàng loạt tạm khóa tới khi xong.
              </div>
            ) : null}
            {daChon.length ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-bo-border bg-bo-primary-soft px-3 py-2 text-sm text-bo-heading">
                <span className="mr-1">
                  <strong className="font-semibold tabular-nums">{soVN(daChon.length)}</strong> SKU đã chọn trên trang này
                </span>
                <Button type="button" variant="outline" disabled={khoaBang} onClick={() => batTatNhieu(true)} className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11">
                  Bật đồng bộ
                </Button>
                <Button type="button" variant="outline" disabled={khoaBang} onClick={() => batTatNhieu(false)} className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11">
                  Ngừng đồng bộ
                </Button>
                {/* Đẩy tồn gọi tới sàn: khóa khi hết hạn ủy quyền; nút bị khóa bỏ qua chuột nên chú thích đặt ở phần tử bọc */}
                <span title={lyDoHetHan ?? undefined} className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={khoaBang || hetHanUyQuyen}
                    aria-describedby={moTaHetHan}
                    onClick={dayTonLai}
                    className="h-8 gap-1.5 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Đẩy tồn lại
                  </Button>
                </span>
                {dangChay?.ten === "nhieu" || dangChay?.ten === "day-ton" ? (
                  <Loader2 className="size-4 animate-spin text-bo-muted" aria-label="Đang cập nhật" />
                ) : null}
                <Button type="button" variant="ghost" disabled={khoa} onClick={() => setChon(new Set())} className="ml-auto h-8 rounded-lg px-3 text-[13px] text-bo-foreground hover:bg-white/70 max-sm:h-11">
                  Bỏ chọn
                </Button>
              </div>
            ) : null}
          </>
        }
        footer={
          (!ds.error || loiTaiNgam) && tongSanPham > 0 ? (
            <TablePagination
              page={trang.page}
              size={trang.size}
              total={tongSanPham}
              sizeLabel="sản phẩm"
              totalLabel="sản phẩm"
              sizeOptions={SO_SAN_PHAM_MOI_TRANG}
              sizeMenuTitle="Số sản phẩm mỗi trang"
              sizeMenuNote="Đếm theo sản phẩm; mỗi sản phẩm luôn kèm đủ phân loại nên không bị cắt sang trang sau."
              totalNote={soSkuTheoTab != null ? `${soVN(soSkuTheoTab)} SKU` : null}
              onPageChange={(page) => {
                if (page < 0 || page === trang.page) return;
                setTrang((cu) => ({ ...cu, page }));
                setChon(new Set());
                cuonLenDau();
              }}
              onSizeChange={(size) => {
                if (size === trang.size) return;
                const boChon = chon.size;
                ghiNho(NHO_SO_DONG, size);
                setTrang({ page: 0, size });
                setChon(new Set());
                cuonLenDau();
                if (boChon) toast.info(`Đã bỏ chọn ${soVN(boChon)} SKU khi đổi số sản phẩm mỗi trang`);
              }}
            />
          ) : null
        }
      >
        {/* Đang lùi về trang cuối (trang vừa tải rỗng vì vượt số trang) thì hiện đang tải, không hiện ô trống */}
        {cfg.initialLoading || ds.initialLoading || (ds.loading && rows.length === 0 && trang.page > 0) ? (
          <LoadingState label="Đang tải sản phẩm" />
        ) : (ds.error && !loiTaiNgam) || (cfg.error && !cfg.data) ? (
          <ErrorState description="Không tải được danh sách sản phẩm. Vui lòng thử lại." onRetry={taiLaiTatCa} />
        ) : rows.length === 0 ? (
          dangLoc ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy sản phẩm phù hợp"
              description="Thử từ khóa khác hoặc xóa lọc."
              action={
                <Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>
                  Xóa lọc
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={PackageSearch}
              title={`Không có SKU nào ở trạng thái "${LIEN_KET_TABS.find((t) => t.ma === tab)?.label}"`}
              description="Chọn tab Tất cả để xem mọi SKU đã liên kết."
              action={
                <Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>
                  Xem tất cả
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Chưa có sản phẩm nào được liên kết"
              description={
                coDuaLen
                  ? `Tải sản phẩm từ ${SAN.ten} để ghép theo SKU trùng với FCentric, hoặc đưa sản phẩm FCentric lên ${SAN.ten}.`
                  : `Tải sản phẩm từ ${SAN.ten} để ghép theo SKU trùng với FCentric.`
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {/* Nút bị khóa bỏ qua chuột: chú thích lý do (hết hạn ủy quyền) đặt ở phần tử bọc */}
                  <span title={lyDoHetHan ?? undefined} className="inline-flex">
                    <Button type="button" onClick={taiTuSan} disabled={khoaViecGianHang} aria-describedby={moTaHetHan} className={NUT_CHINH}>
                      {dangChay?.ten === "tai" ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
                      Tải sản phẩm từ {SAN.ten}
                    </Button>
                  </span>
                  {coDuaLen ? (
                    <Button type="button" variant="outline" onClick={() => setHoiDayLen(true)} disabled={khoaViecGianHang} className={NUT_PHU}>
                      <CloudUpload className="size-4" />
                      Đưa sản phẩm FCentric lên {SAN.ten}
                    </Button>
                  ) : null}
                </div>
              }
            />
          )
        ) : (
          <table ref={bangRef} className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} w-10 text-left`}>
                  <Checkbox
                    checked={trangThaiChon(tatCaIds)}
                    onCheckedChange={(v) => doiChon(tatCaIds, v === true)}
                    aria-label="Chọn mọi SKU trên trang này"
                    className={CHECKBOX_CLASS}
                  />
                </th>
                <th className={`${TH} text-left`}>Sản phẩm</th>
                <th className={`${TH} text-left`}>SKU FCentric</th>
                <th className={`${TH} text-right`}>Khả dụng</th>
                <th className={`${TH} text-right`} title={`Số ${SAN.ten} đã nhận ở lần đẩy tồn thành công gần nhất`}>
                  Đã đẩy lên {SAN.ten}
                </th>
                <th className={`${TH} text-left`}>Trạng thái</th>
                <th className={`${TH} text-left`}>Đồng bộ</th>
                <th className={`${TH} w-12`}>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f5]">
              {nhom.map((g) => {
                if (laMotPhanLoai(g)) return dongSku(g.dong[0], false);
                const mo = laMo(g);
                const gioNhom = gioChungCuaNhom(g.dong, gioDayTon);
                return (
                  <Fragment key={g.khoa}>
                    {hangNhom(g, mo, gioNhom)}
                    {mo ? g.dong.map((dong) => dongSku(dong, true, gioNhom)) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </TableShell>

      <SyncLogDetailSheet
        lienKet={chiTiet}
        open={Boolean(chiTiet)}
        onOpenChange={(mo) => !mo && setChiTietId(null)}
        quyTac={quyTac}
        tenSan={SAN.ten}
        duongDanCauHinh={`${SAN.duongDan}/settings`}
        dangXuLy={dangChay && dangChay.id === chiTiet?.id ? dangChay.ten : null}
        onThuLai={() => chiTiet && thuLai(chiTiet)}
        onBatTat={() => chiTiet && batTat(chiTiet)}
        onDoiBienThe={() => {
          if (!chiTiet) return;
          const id = chiTiet.id;
          setChiTietId(null);
          // Chờ ngăn chi tiết đóng xong (trả tiêu điểm về dòng) rồi mới mở ô ghép
          window.setTimeout(() => setGhepId(id), 350);
        }}
      />

      {/* Ngừng nhiều SKU (cả sản phẩm / chọn nhiều): sàn giữ nguyên số cũ nên vẫn bán được → hỏi lại, nói rõ hệ quả */}
      <ConfirmModal
        isOpen={Boolean(hoiNgung)}
        onClose={() => dangChay?.ten !== "nhieu" && setHoiNgung(null)}
        onConfirm={async () => {
          const hoi = hoiNgung;
          if (!hoi) return;
          await doiNhieu(hoi.dong, false, hoi.xong);
          setHoiNgung(null);
        }}
        isLoading={dangChay?.ten === "nhieu"}
        variant="warning"
        title={hoiNgung?.tieuDe ?? ""}
        description={
          hoiNgung
            ? `FCentric sẽ không đẩy tồn kho của ${soVN(hoiNgung.dong.length)} SKU này lên ${SAN.ten} nữa. ${SAN.ten} giữ nguyên số đang hiện (tổng ${soVN(
                hoiNgung.dong.reduce((s, d) => s + (Number(d.soLuongDaDay) || 0), 0),
              )}) nên khách vẫn đặt được và có thể bán vượt tồn. Liên kết vẫn giữ, bật lại là đẩy tiếp; muốn dừng bán hẳn, hãy ẩn sản phẩm trên ${SAN.ten}.`
            : ""
        }
        confirmText={hoiNgung ? `Ngừng ${soVN(hoiNgung.dong.length)} SKU` : "Ngừng đồng bộ"}
        cancelText="Hủy"
      />

      <ConfirmModal
        isOpen={hoiDayLen}
        onClose={() => setHoiDayLen(false)}
        onConfirm={dayLenSan}
        isLoading={dangChay?.ten === "day-len"}
        variant="info"
        title={`Đưa sản phẩm lên ${SAN.ten}?`}
        description={`Các sản phẩm đang bán ở FCentric mà ${SAN.ten} chưa có sẽ được tạo mới trên gian hàng thật, kèm ảnh và số tồn. Sản phẩm đã có được cập nhật thương hiệu, loại và thẻ.`}
        confirmText="Đưa lên"
        cancelText="Hủy bỏ"
      />
    </PageContainer>
  );
}
