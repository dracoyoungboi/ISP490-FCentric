import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight, SearchX, ShoppingCart, X } from "lucide-react";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import StatusTabs from "@/components/shared/StatusTabs";
import SearchInput from "@/components/shared/SearchInput";
import FilterSelect from "@/components/shared/FilterSelect";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import OrderFlagBadges from "@/components/channel/OrderFlagBadges";
import StatusBadge from "@/components/shared/StatusBadge";
import { NUT_PHU } from "@/components/channel/BottomActionBar";
import LayDonDialog from "@/components/channel/LayDonDialog";
import { ngayIso } from "@/components/channel/ngay";
import { daKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import ThaoTacDongBo from "@/components/channel/ThaoTacDongBo";
import ThanhNhacUyQuyen from "@/components/channel/ThanhNhacUyQuyen";
import useDongBoNgay from "@/components/channel/useDongBoNgay";
import useSanHienTai from "@/components/channel/useSanHienTai";
import AttentionBar from "@/components/shared/AttentionBar";
import { CHANNELS, locKhoDongBo, parseFlags } from "@/constants/channel";
import { DON_BAN_HANG_TABS, getDonBanHangStatus } from "@/constants/donBanHang";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { getKhoList } from "@/services/khoService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";

const TAB_MAS = DON_BAN_HANG_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const NGAY_OPTIONS = [
  { value: "", label: "Ngày nhận: tất cả" },
  { value: "1", label: "Hôm nay" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
];
/**
 * "Khách yêu cầu hủy" (TikTok Shop) chỉ tính đơn chưa xuất kho, chưa hủy: Nháp, Chờ nhặt hàng, Chờ đóng gói, Chờ xuất kho.
 * Thanh nhắc, bộ lọc ?yeuCauHuy=1 và số ở Tổng quan dùng chung định nghĩa này (dữ liệu mẫu: demYeuCauHuy ở donBanHangKenhMock.js).
 */
const TRANG_THAI_CHUA_XUAT_KHO = [0, 1, 7, 8];
const NHAN_LOC_YEU_CAU_HUY = "Khách yêu cầu hủy, chưa xuất kho";
// Đơn đặt mới nhất trước, theo cột Ngày nhận; trùng giờ thì đơn về sau đứng trước
const THU_TU = [
  { fieldName: "ngayDatHang", direction: "DESC" },
  { fieldName: "id", direction: "DESC" },
];
// Bề rộng vùng mờ ở mép hàng tab (w-12): tab đang chọn được cuộn ra ngoài vùng này
const LE_MO_TAB = 48;

/** Cùng điều kiện lọc cho danh sách, số trên tab và thanh nhắc; chỉ khác trạng thái. */
function boLoc({ kenh, tuKhoa, khoId, soNgay, yeuCauHuy }, trangThai) {
  const list = [{ fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" }, kenh];
  if (tuKhoa) list.push({ fieldName: "soDonHang", operation: "LIKE", value: tuKhoa });
  if (khoId) list.push({ fieldName: "khoXuat.id", operation: "EQUALS", value: Number(khoId) });
  if (soNgay) list.push({ fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: ngayIso(Number(soNgay) - 1) });
  if (yeuCauHuy) {
    list.push({ fieldName: "yeuCauHuy", operation: "EQUALS", value: true });
    list.push({ fieldName: "trangThai", operation: "IN", value: TRANG_THAI_CHUA_XUAT_KHO });
  }
  if (trangThai?.length === 1) list.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai[0] });
  else if (trangThai?.length > 1) list.push({ fieldName: "trangThai", operation: "IN", value: trangThai });
  return list;
}

/** Người nhận đã che do sàn trả ("N*n T. · 09***382"): bỏ phần trống, "null", "undefined"; trùng tên khách thì không ghi lại. */
function nguoiNhanCua(don) {
  const chuoi = String(don?.nguoiNhan ?? "")
    .split("·")
    .map((phan) => phan.trim())
    .filter((phan) => phan && !/^(null|undefined)$/i.test(phan))
    .join(" · ");
  return chuoi && chuoi !== don?.khachHang?.tenKhachHang ? chuoi : null;
}

/** Cờ của một dòng: "Khách yêu cầu hủy" (yeuCauHuy hoặc cờ YEU_CAU_HUY) đứng đầu, ngay sau thẻ trạng thái, và chỉ một lần. */
function coCuaDon(don) {
  const co = parseFlags(don.canXuLy);
  const khac = co.filter((ma) => ma !== "YEU_CAU_HUY");
  return don.yeuCauHuy || khac.length !== co.length ? ["YEU_CAU_HUY", ...khac] : khac;
}

const hangTabTrong = (khung) => khung?.querySelector('[role="tablist"]') ?? null;

/** Cuộn hàng tab để tab đang chọn nằm ngoài vùng mờ ở hai mép. */
function cuonToiTabDangChon(hang) {
  const nut = hang?.querySelector('[role="tab"][aria-selected="true"]');
  if (!nut) return;
  const h = hang.getBoundingClientRect();
  const t = nut.getBoundingClientRect();
  if (t.left < h.left + LE_MO_TAB) hang.scrollLeft -= h.left + LE_MO_TAB - t.left;
  else if (t.right > h.right - LE_MO_TAB) hang.scrollLeft += t.right - (h.right - LE_MO_TAB);
}

/**
 * Hàng tab cuộn ngang có dấu hiệu: chín tab của Đơn bán hàng không vừa khung ở 1366 px, mà StatusTabs ẩn thanh cuộn.
 * Mép nào còn tab khuất thì mờ dần và có nút mũi tên để cuộn; tab đang chọn luôn được cuộn vào tầm nhìn.
 */
function TabCuonNgang({ value, children }) {
  const khungRef = useRef(null);
  const [khuat, setKhuat] = useState({ trai: false, phai: false });

  useLayoutEffect(() => {
    const hang = hangTabTrong(khungRef.current);
    if (!hang) return undefined;
    const doLai = () => {
      const trai = hang.scrollLeft > 1;
      const phai = hang.scrollLeft + hang.clientWidth < hang.scrollWidth - 1;
      setKhuat((cu) => (cu.trai === trai && cu.phai === phai ? cu : { trai, phai }));
    };
    doLai();
    hang.addEventListener("scroll", doLai, { passive: true });
    // Số trên tab hiện sau khi đếm xong làm hàng dài ra (khung không đổi cỡ) và đẩy tab đang chọn đi: theo dõi cả từng tab
    const quanSat = new ResizeObserver(() => {
      cuonToiTabDangChon(hang);
      doLai();
    });
    quanSat.observe(hang);
    hang.querySelectorAll('[role="tab"]').forEach((nut) => quanSat.observe(nut));
    return () => {
      hang.removeEventListener("scroll", doLai);
      quanSat.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    cuonToiTabDangChon(hangTabTrong(khungRef.current));
  }, [value]);

  const cuon = (huong) => {
    const hang = hangTabTrong(khungRef.current);
    hang?.scrollBy({ left: huong * Math.max(160, hang.clientWidth * 0.6), behavior: "smooth" });
  };
  // Bàn phím đi qua lại bằng mũi tên trong hàng tab (tab được chọn tự cuộn vào), nên hai nút này chỉ cho chuột / chạm
  const nutCuon = "pointer-events-auto flex size-8 items-center justify-center rounded-md bg-white text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground";

  return (
    <div ref={khungRef} className="relative min-w-0">
      {children}
      {/* bottom-px: chừa đường kẻ đáy để gạch chân tab và đường kẻ khung bảng không bị che */}
      {khuat.trai ? (
        <div className="pointer-events-none absolute bottom-px left-0 top-0 flex w-12 items-center bg-gradient-to-r from-white from-50% to-transparent">
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => cuon(-1)} className={nutCuon}>
            <ChevronLeft className="size-4" />
          </button>
        </div>
      ) : null}
      {khuat.phai ? (
        <div className="pointer-events-none absolute bottom-px right-0 top-0 flex w-12 items-center justify-end bg-gradient-to-l from-white from-50% to-transparent">
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => cuon(1)} className={nutCuon}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Đơn bán hàng nhận từ gian hàng của sàn đang mở: cùng tab, cùng cột với Đơn bán hàng; bấm một dòng để mở đơn.
 * Đầu trang (PA1 chốt 19/10/2026): ⋯ (Lấy đơn theo khoảng ngày) và "Đồng bộ ngay" kèm tiến độ — đợt đồng bộ
 * đã lấy đơn 24 giờ qua nên không còn nút "Lấy đơn mới" riêng; đợt xong thì bảng tự tải lại.
 * Sàn ủy quyền: ô Khách hàng thêm người nhận đã che; TikTok Shop có thẻ, thanh nhắc và bộ lọc "Khách yêu cầu hủy" (KH mục B.7).
 */
export default function ChannelOrdersPage() {
  const navigate = useNavigate();
  const SAN = useSanHienTai();
  const uyQuyen = SAN.kieuKetNoi === "uy_quyen";
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
  const [searchParams] = useSearchParams();
  // TikTok Shop: lọc "Khách yêu cầu hủy" nằm trên đường dẫn (?yeuCauHuy=1) để Tổng quan dẫn thẳng tới đúng các đơn
  const coYeuCauHuy = SAN.maKenh === "TIKTOK";
  const locYeuCauHuy = coYeuCauHuy && searchParams.get("yeuCauHuy") === "1";
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [khoId, setKhoId] = useState("");
  const [soNgay, setSoNgay] = useState("");
  const [trang, setTrang] = useState({ page: 0, size: SO_DONG_MAC_DINH });

  const cfg = useTaiDuLieu(() => kenhBanHangService.getKetNoi(SAN.maKenh), `ket-noi|${SAN.maKenh}`);
  const ketNoi = daKetNoi(cfg.data);
  const hetHanUyQuyen = uyQuyen && trangThaiKetNoi(cfg.data) === "het_han";
  // Sàn ủy quyền lọc theo mã kênh (KetNoiKenhDto không có id kênh); Shopify giữ lọc theo id như trước
  const kenh = uyQuyen
    ? { fieldName: "kenhBanHang.maKenh", operation: "EQUALS", value: SAN.maKenh }
    : { fieldName: "kenhBanHang.id", operation: "EQUALS", value: cfg.data?.id ?? CHANNELS[SAN.maKenh]?.id };
  const khoaKenh = `${kenh.fieldName}=${kenh.value}`;
  const dsKho = useTaiDuLieu(() => getKhoList().catch(() => []), "kho-xuat");
  const loc = { kenh, tuKhoa, khoId, soNgay, yeuCauHuy: locYeuCauHuy };
  const khoaLoc = `${khoaKenh}|${tuKhoa}|${khoId}|${soNgay}|${locYeuCauHuy ? "yeu-cau-huy" : ""}`;
  // Chỉ tải đơn khi gian hàng đã kết nối (kể cả ủy quyền hết hạn: đơn đã về vẫn xem được); chưa kết nối thì trang chuyển đi
  const ds = useTaiDuLieu(
    () =>
      donBanHangKenhService.filterDonBan({
        page: trang.page,
        size: trang.size,
        filters: boLoc(loc, tabTrangThai),
        sorts: THU_TU,
      }),
    `${khoaLoc}|${tab}|${trang.page}|${trang.size}`,
    { enabled: ketNoi },
  );
  const { counts, reload: demLai } = useDemTheoTrangThai(
    TAB_MAS,
    (ma) =>
      donBanHangKenhService
        .filterDonBan({ filters: boLoc(loc, DON_BAN_HANG_TABS.find((t) => t.ma === ma)?.trangThai), sorts: [], page: 0, size: 1 })
        .then((res) => res?.totalElements ?? 0),
    khoaLoc,
    { enabled: ketNoi },
  );

  // TikTok Shop: số đơn khách đang yêu cầu hủy (thanh nhắc trên bảng), cùng điều kiện với bộ lọc ?yeuCauHuy=1
  const soYeuCauHuy = useTaiDuLieu(
    () =>
      donBanHangKenhService
        .filterDonBan({ filters: boLoc({ kenh, yeuCauHuy: true }, null), sorts: [], page: 0, size: 1 })
        .then((res) => res?.totalElements ?? 0),
    `yeu-cau-huy|${khoaKenh}`,
    { enabled: ketNoi && coYeuCauHuy },
  );

  const taiLai = () => {
    ds.reload();
    demLai();
    if (coYeuCauHuy) soYeuCauHuy.reload();
  };
  // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: đơn được lấy tự động theo Cấu hình.
  // Tải lại lỗi thì giữ bảng cũ (ds.loiTaiLai), chân bảng báo "Không tải lại được".
  const capNhat = { thoiDiem: ds.capNhatLuc, dangTai: ds.loading, loi: ds.loiTaiLai, taiLai };
  useTaiLaiKhiQuayLai(taiLai, { bat: ketNoi && !ds.loading, lanCuoi: ds.capNhatLuc });
  // Đồng bộ hay lấy đơn báo ủy quyền hết hạn / kênh chưa kết nối: đọc lại kết nối (trang hiện thanh nhắc hoặc tự chuyển đi)
  // và danh sách sàn của menu bên trái
  const khiMatKetNoi = () => {
    cfg.reload();
    taiLaiKenhDaKetNoi();
  };
  // Đồng bộ ngay chạy nền ở máy chủ, chung cho cả gian hàng: xong (dù bấm ở trang nào) thì tải lại bảng
  const dongBo = useDongBoNgay(SAN.maKenh, { enabled: ketNoi, onXong: taiLai, onMatKetNoi: khiMatKetNoi });

  const [moLayDon, setMoLayDon] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const moi = searchText.trim();
      if (moi === tuKhoa) return;
      setTuKhoa(moi);
      setTrang((cu) => ({ ...cu, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, tuKhoa]);

  // Trang đang xem vượt số trang thật sau khi tải lại (đơn cuối vừa đổi trạng thái) → lùi về trang cuối còn dữ liệu
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
  if (cfg.data && !ketNoi) return <Navigate to={uyQuyen ? SAN.duongDan : `${SAN.duongDan}/setup`} replace />;

  const rows = ds.data?.content ?? [];
  const tong = ds.data?.totalElements ?? 0;
  const dangLoc = Boolean(tuKhoa || khoId || soNgay || locYeuCauHuy);
  const khoOptions = [{ value: "", label: "Tất cả kho xuất" }, ...locKhoDongBo(dsKho.data).map((k) => ({ value: String(k.id), label: k.tenKho }))];
  const statusTabs = DON_BAN_HANG_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    count: counts[t.ma],
    tone: t.ma === "nhap" ? "warning" : undefined,
  }));
  const veTrangDau = () => setTrang((cu) => ({ ...cu, page: 0 }));
  const doiTab = (moi) => {
    setTab(moi);
    veTrangDau();
  };
  /**
   * Bỏ ô tìm, kho, ngày (giữ trong trang). Lọc "Khách yêu cầu hủy" nằm trên đường dẫn cùng tab nên đổi chung một lần
   * ghi với tab: hai lần ghi đường dẫn liền nhau thì lần sau đè mất lần trước.
   */
  const boLocTrongTrang = () => {
    setSearchText("");
    setTuKhoa("");
    setKhoId("");
    setSoNgay("");
    veTrangDau();
  };
  const xoaLoc = () => {
    boLocTrongTrang();
    if (locYeuCauHuy) setTab(tab, { yeuCauHuy: null });
  };
  const boLocYeuCauHuy = () => {
    setTab(tab, { yeuCauHuy: null });
    veTrangDau();
  };
  // "Xem đơn" ở thanh nhắc: bỏ mọi lọc khác, về tab Tất cả, chỉ còn đúng các đơn thanh nhắc đang đếm
  const xemYeuCauHuy = () => {
    boLocTrongTrang();
    setTab(TAB_MAC_DINH, { yeuCauHuy: "1" });
  };
  /**
   * Liên kết trong bảng tiến độ: tab của chính trang này thì bỏ lọc rồi đổi tab tại chỗ (giống mở từ Tổng quan),
   * trang khác của gian hàng thì chuyển trang.
   */
  const den = (duongDan) => {
    const [duong, thamSo = ""] = duongDan.split("?");
    if (duong === "/orders") {
      const thamSoMoi = new URLSearchParams(thamSo);
      const moi = thamSoMoi.get("trangThai");
      boLocTrongTrang();
      setTab(TAB_MAS.includes(moi) ? moi : TAB_MAC_DINH, {
        yeuCauHuy: coYeuCauHuy && thamSoMoi.get("yeuCauHuy") === "1" ? "1" : null,
      });
      return;
    }
    navigate(`${SAN.duongDan}${duongDan}`);
  };

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title={`Đơn hàng ${SAN.ten}`}
        actions={
          <ThaoTacDongBo
            tienDo={dongBo}
            tenSan={SAN.ten}
            onDen={den}
            khoaThaoTac={
              !ketNoi ? "Chưa tải xong thông tin gian hàng." : hetHanUyQuyen ? `Ủy quyền ${SAN.ten} đã hết hạn, ủy quyền lại trước khi chạy.` : false
            }
            lyDoKhoaDongBo={hetHanUyQuyen ? "Ủy quyền lại trước khi đồng bộ" : null}
            thaoTac={[
              {
                ma: "lay-don-theo-ngay",
                nhan: "Lấy đơn theo khoảng ngày…",
                moTa: "Đơn đã có trong FCentric không bị tạo lại.",
                Icon: CalendarRange,
                onChon: () => setMoLayDon(true),
              },
            ]}
          />
        }
      />
      <MockModeNotice show={isChannelMock || isChannelOrderMock} note={isChannelMock ? GHI_CHU_DU_LIEU_MAU_KENH : undefined} />
      <ThanhNhacUyQuyen san={SAN} ketNoi={cfg.data} />
      {/* Đang lọc đúng các đơn này (chip lọc ở thanh công cụ) thì không nhắc lại */}
      {coYeuCauHuy && !locYeuCauHuy ? (
        <AttentionBar count={soYeuCauHuy.data} actionLabel="Xem đơn" onAction={xemYeuCauHuy}>
          <strong className="font-semibold">{formatNumber(soYeuCauHuy.data)} đơn chưa xuất kho</strong> đang có yêu cầu hủy từ khách trên {SAN.ten}.
          Duyệt hoặc từ chối trên Seller Center trước hạn; chỉ xuất kho đơn đã từ chối hủy.
        </AttentionBar>
      ) : null}

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <TabCuonNgang value={tab}>
                <StatusTabs label="Lọc đơn theo trạng thái" tabs={statusTabs} value={tab} onChange={doiTab} />
              </TabCuonNgang>
            }
            hasFilter={dangLoc}
            onClear={xoaLoc}
          >
            <SearchInput
              label="Tìm đơn"
              placeholder="Nhập số đơn hàng…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onClear={() => {
                setSearchText("");
                setTuKhoa("");
                veTrangDau();
              }}
              className="sm:w-[260px]"
            />
            {khoOptions.length > 1 ? (
              <FilterSelect
                label="Kho xuất"
                value={khoId}
                options={khoOptions}
                onChange={(value) => {
                  setKhoId(value);
                  veTrangDau();
                }}
                align="end"
                className="sm:w-[180px]"
              />
            ) : null}
            <FilterSelect
              label="Ngày nhận"
              value={soNgay}
              options={NGAY_OPTIONS}
              onChange={(value) => {
                setSoNgay(value);
                veTrangDau();
              }}
              align="end"
              className="sm:w-[170px]"
            />
            {locYeuCauHuy ? (
              // Chip lọc cùng khung với ô lọc bên cạnh; bấm cả chip để bỏ lọc
              <button
                type="button"
                onClick={boLocYeuCauHuy}
                aria-label={`Bỏ lọc ${NHAN_LOC_YEU_CAU_HUY.toLocaleLowerCase("vi-VN")}`}
                title="Bỏ lọc này"
                className={cn(
                  "inline-flex h-9 min-w-0 max-w-full items-center justify-between gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm text-bo-foreground max-sm:h-11",
                  "transition-colors hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary max-sm:w-full",
                )}
              >
                <span className="truncate">{NHAN_LOC_YEU_CAU_HUY}</span>
                <X className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
              </button>
            ) : null}
          </ListToolbar>
        }
        footer={
          ketNoi && !ds.initialLoading && (!ds.error || ds.loiTaiLai) ? (
            <TablePagination
              page={trang.page}
              size={trang.size}
              total={tong}
              onPageChange={(page) => page >= 0 && setTrang((cu) => ({ ...cu, page }))}
              onSizeChange={(size) => setTrang({ page: 0, size })}
              capNhat={capNhat}
            />
          ) : null
        }
      >
        {/* Đang lùi về trang cuối (trang vừa tải rỗng vì vượt số trang) thì hiện đang tải, không hiện ô trống */}
        {cfg.initialLoading || ds.initialLoading || (ds.loading && rows.length === 0 && trang.page > 0) ? (
          <LoadingState label="Đang tải đơn hàng" />
        ) : (ds.error && !ds.loiTaiLai) || (cfg.error && !cfg.data) ? (
          <ErrorState description="Không tải được danh sách đơn. Vui lòng thử lại." onRetry={() => (cfg.data ? ds.reload() : cfg.reload())} />
        ) : rows.length === 0 ? (
          dangLoc ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy đơn phù hợp"
              description="Thử số đơn, kho hoặc ngày khác, hoặc xóa lọc."
              action={
                <Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>
                  Xóa lọc
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={ShoppingCart}
              title={`Không có đơn nào ở trạng thái "${DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.label}"`}
              description="Chọn tab Tất cả để xem mọi đơn từ gian hàng."
              action={
                <Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>
                  Xem tất cả
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title={`Chưa có đơn từ ${SAN.ten}`}
              description={`Đơn mới được lấy tự động theo Cấu hình, hoặc bấm "Đồng bộ ngay".`}
            />
          )
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} text-left`}>Số đơn</th>
                <th className={`${TH} text-left`}>Khách hàng</th>
                <th className={`${TH} text-left`}>Kho xuất</th>
                <th className={`${TH} text-left`}>Ngày nhận</th>
                <th className={`${TH} text-right`}>Tổng tiền</th>
                <th className={`${TH} text-left`}>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {rows.map((don) => {
                const st = getDonBanHangStatus(don.trangThai);
                const nguoiNhan = uyQuyen ? nguoiNhanCua(don) : null;
                const co = coCuaDon(don);
                const mo = () => navigate(`/sales-orders/${don.id}`);
                return (
                  <tr
                    key={don.id}
                    tabIndex={0}
                    onClick={mo}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") mo();
                    }}
                    className="cursor-pointer transition-colors hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-none"
                  >
                    <td className="px-3 py-3">
                      {/* Không gãy dòng ở dấu "-" của LZD-/TTS- */}
                      <div className="whitespace-nowrap font-semibold uppercase tracking-wide text-bo-primary">{don.soDonHang}</div>
                      {/* Số đơn LZD-/TTS- đã ghép đúng mã đơn sàn thì không ghi lại lần nữa */}
                      {don.maDonHangKenh && !(uyQuyen && String(don.soDonHang ?? "").includes(don.maDonHangKenh)) ? (
                        <div className="text-xs tabular-nums text-bo-muted">#{don.maDonHangKenh} trên {SAN.ten}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-bo-foreground">{don.khachHang?.tenKhachHang || "Khách lẻ"}</div>
                      {/* Sàn ủy quyền che tên và số điện thoại người nhận; hiện đúng như sàn trả, sàn không trả thì bỏ dòng */}
                      {nguoiNhan ? <div className="text-xs tabular-nums text-bo-muted">Người nhận {nguoiNhan}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-bo-muted">{don.khoXuat?.tenKho || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-bo-muted">{formatDate(don.ngayDatHang)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-bo-heading">{formatCurrency(don.tongCong)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge quyTrinh="donBan" label={st.label} />
                      {co.length ? (
                        <div className="mt-1">
                          <OrderFlagBadges value={co} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableShell>

      {moLayDon ? (
        <LayDonDialog
          maKenh={SAN.maKenh}
          tenSan={SAN.ten}
          onClose={() => setMoLayDon(false)}
          onXong={() => {
            setMoLayDon(false);
            taiLai();
          }}
          onMatKetNoi={khiMatKetNoi}
        />
      ) : null}
    </PageContainer>
  );
}
