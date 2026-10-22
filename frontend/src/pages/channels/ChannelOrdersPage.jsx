import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CalendarRange, SearchX, ShoppingCart } from "lucide-react";
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
import { daKetNoi } from "@/components/channel/ketNoiShopify";
import { daKetNoiLazada } from "@/components/channel/ketNoiLazada";
import ThaoTacDongBo from "@/components/channel/ThaoTacDongBo";
import useDongBoNgay from "@/components/channel/useDongBoNgay";
import { CHANNELS, SAN_BAN_HANG, locKhoDongBo } from "@/constants/channel";
import { DON_BAN_HANG_TABS, getDonBanHangStatus } from "@/constants/donBanHang";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { getKhoList } from "@/services/khoService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { formatCurrency, formatDate } from "@/utils/formatters";

const SAN = SAN_BAN_HANG.find((s) => s.maKenh === "SHOPIFY");
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

/** Cùng điều kiện lọc cho danh sách và số trên tab; chỉ khác trạng thái. */
function boLoc({ kenhId, tuKhoa, khoId, soNgay }, trangThai) {
  const list = [
    { fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" },
    { fieldName: "kenhBanHang.id", operation: "EQUALS", value: kenhId },
  ];
  if (tuKhoa) list.push({ fieldName: "soDonHang", operation: "LIKE", value: tuKhoa });
  if (khoId) list.push({ fieldName: "khoXuat.id", operation: "EQUALS", value: Number(khoId) });
  if (soNgay) list.push({ fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: ngayIso(Number(soNgay) - 1) });
  if (trangThai?.length === 1) list.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai[0] });
  else if (trangThai?.length > 1) list.push({ fieldName: "trangThai", operation: "IN", value: trangThai });
  return list;
}

/**
 * Đơn bán hàng nhận từ gian hàng Shopify: cùng tab, cùng cột với Đơn bán hàng; bấm một dòng để mở đơn.
 * Đầu trang (PA1 chốt 19/10/2026): ⋯ (Lấy đơn theo khoảng ngày) và "Đồng bộ ngay" kèm tiến độ — đợt đồng bộ
 * đã lấy đơn 24 giờ qua nên không còn nút "Lấy đơn mới" riêng; đợt xong thì bảng tự tải lại.
 */
export default function ChannelOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLazada = location.pathname.includes("/channels/lazada");
  const SAN = SAN_BAN_HANG.find((s) => s.maKenh === (isLazada ? "LAZADA" : "SHOPIFY")) ?? SAN_BAN_HANG[0];

  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [khoId, setKhoId] = useState("");
  const [soNgay, setSoNgay] = useState("");
  const [trang, setTrang] = useState({ page: 0, size: SO_DONG_MAC_DINH });

  const cfg = useTaiDuLieu(
    () => (isLazada ? kenhBanHangService.getLazadaConfig() : kenhBanHangService.getShopifyConfig()),
    isLazada ? "cau-hinh-lazada" : "cau-hinh-shopify",
  );
  const ketNoi = isLazada ? daKetNoiLazada(cfg.data) : daKetNoi(cfg.data);
  const kenhId = cfg.data?.id ?? (isLazada ? CHANNELS.LAZADA.id : CHANNELS.SHOPIFY.id);
  const dsKho = useTaiDuLieu(() => getKhoList().catch(() => []), "kho-xuat");
  const loc = { kenhId, tuKhoa, khoId, soNgay };
  const khoaLoc = `${kenhId}|${tuKhoa}|${khoId}|${soNgay}`;
  const ds = useTaiDuLieu(
    () =>
      donBanHangKenhService.filterDonBan({
        page: trang.page,
        size: trang.size,
        filters: boLoc(loc, tabTrangThai),
        sorts: [{ fieldName: "id", direction: "DESC" }],
      }),
    `${khoaLoc}|${tab}|${trang.page}|${trang.size}`,
    { enabled: Boolean(cfg.data) },
  );
  const { counts, reload: demLai } = useDemTheoTrangThai(
    TAB_MAS,
    (ma) =>
      donBanHangKenhService
        .filterDonBan({ filters: boLoc(loc, DON_BAN_HANG_TABS.find((t) => t.ma === ma)?.trangThai), sorts: [], page: 0, size: 1 })
        .then((res) => res?.totalElements ?? 0),
    khoaLoc,
    { enabled: Boolean(cfg.data) },
  );

  const taiLai = () => {
    ds.reload();
    demLai();
  };
  // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: đơn được lấy tự động theo Cấu hình.
  // Tải lại lỗi thì giữ bảng cũ (ds.loiTaiLai), chân bảng báo "Không tải lại được".
  const capNhat = { thoiDiem: ds.capNhatLuc, dangTai: ds.loading, loi: ds.loiTaiLai, taiLai };
  useTaiLaiKhiQuayLai(taiLai, { bat: Boolean(cfg.data) && !ds.loading, lanCuoi: ds.capNhatLuc });
  // Đồng bộ ngay chạy nền ở máy chủ, chung cho cả gian hàng: xong (dù bấm ở trang nào) thì tải lại bảng
  const dongBo = useDongBoNgay(SAN.maKenh, { enabled: ketNoi, onXong: taiLai });

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

  if (cfg.data && !ketNoi) return <Navigate to={`${SAN.duongDan}/setup`} replace />;

  const rows = ds.data?.content ?? [];
  const tong = ds.data?.totalElements ?? 0;
  const dangLoc = Boolean(tuKhoa || khoId || soNgay);
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
  const xoaLoc = () => {
    setSearchText("");
    setTuKhoa("");
    setKhoId("");
    setSoNgay("");
    veTrangDau();
  };
  /**
   * Liên kết trong bảng tiến độ: tab của chính trang này thì bỏ lọc rồi đổi tab tại chỗ (giống mở từ Tổng quan),
   * trang khác của gian hàng thì chuyển trang.
   */
  const den = (duongDan) => {
    const [duong, thamSo = ""] = duongDan.split("?");
    if (duong === "/orders") {
      const moi = new URLSearchParams(thamSo).get("trangThai");
      xoaLoc();
      doiTab(TAB_MAS.includes(moi) ? moi : TAB_MAC_DINH);
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
            khoaThaoTac={!ketNoi ? "Chưa tải xong thông tin gian hàng." : false}
            thaoTac={[
              {
                ma: "lay-don-theo-ngay",
                nhan: "Lấy đơn theo khoảng ngày…",
                moTa: "Đơn đã có trong FCentric không bị tạo lại",
                Icon: CalendarRange,
                onChon: () => setMoLayDon(true),
              },
            ]}
          />
        }
      />
      <MockModeNotice show={isChannelMock || isChannelOrderMock} />

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={<StatusTabs label="Lọc đơn theo trạng thái" tabs={statusTabs} value={tab} onChange={doiTab} />}
            hasFilter={dangLoc}
            onClear={xoaLoc}
          >
            <SearchInput
              label="Tìm đơn"
              placeholder="Nhập số đơn hàng..."
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
          </ListToolbar>
        }
        footer={
          cfg.data && !ds.initialLoading && (!ds.error || ds.loiTaiLai) ? (
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
                      <div className="font-semibold uppercase tracking-wide text-bo-primary">{don.soDonHang}</div>
                      {don.maDonHangKenh ? <div className="text-xs tabular-nums text-bo-muted">#{don.maDonHangKenh} trên {SAN.ten}</div> : null}
                    </td>
                    <td className="px-3 py-3 font-medium text-bo-foreground">{don.khachHang?.tenKhachHang || "Khách lẻ"}</td>
                    <td className="px-3 py-3 text-bo-muted">{don.khoXuat?.tenKho || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-bo-muted">{formatDate(don.ngayDatHang)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-bo-heading">{formatCurrency(don.tongCong)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge quyTrinh="donBan" label={st.label} />
                      {don.canXuLy ? (
                        <div className="mt-1">
                          <OrderFlagBadges value={don.canXuLy} />
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
        />
      ) : null}
    </PageContainer>
  );
}
