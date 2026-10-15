import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarRange, Loader2, SearchX, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
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
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import LayDonDialog from "@/components/channel/LayDonDialog";
import { ngayIso } from "@/components/channel/ngay";
import { ketQuaLayDon } from "@/components/channel/ketQuaThaoTac";
import { daKetNoi } from "@/components/channel/ketNoiShopify";
import { CHANNELS, SAN_BAN_HANG, locKhoDongBo } from "@/constants/channel";
import { DON_BAN_HANG_TABS, getDonBanHangStatus } from "@/constants/donBanHang";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { getKhoList } from "@/services/khoService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import { getApiErrorMessage } from "@/utils/apiError";
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

/** Đơn bán hàng nhận từ gian hàng Shopify: cùng tab, cùng cột với Đơn bán hàng; bấm một dòng để mở đơn. */
export default function ChannelOrdersPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [khoId, setKhoId] = useState("");
  const [soNgay, setSoNgay] = useState("");
  const [trang, setTrang] = useState({ page: 0, size: SO_DONG_MAC_DINH });

  const cfg = useTaiDuLieu(() => kenhBanHangService.getShopifyConfig(), "cau-hinh-shopify");
  const ketNoi = daKetNoi(cfg.data);
  const kenhId = cfg.data?.id ?? CHANNELS.SHOPIFY.id;
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

  const [moLayDon, setMoLayDon] = useState(false);
  const [dangLay, setDangLay] = useState(false);
  const dangLayRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const moi = searchText.trim();
      if (moi === tuKhoa) return;
      setTuKhoa(moi);
      setTrang((cu) => ({ ...cu, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, tuKhoa]);

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
  const taiLai = () => {
    ds.reload();
    demLai();
  };

  // Lấy đơn mới trong 24 giờ qua (đơn đã có không tạo lại)
  const layDonMoi = async () => {
    if (dangLayRef.current) return;
    dangLayRef.current = true;
    setDangLay(true);
    try {
      const res = await kenhBanHangService.layDon(SAN.maKenh, {
        tu: new Date(Date.now() - 86_400_000).toISOString(),
        den: new Date().toISOString(),
      });
      const kq = ketQuaLayDon(res, SAN.ten);
      toast.success(kq.title, kq.message ? { description: kq.message } : undefined);
      taiLai();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lấy được đơn hàng"));
    } finally {
      dangLayRef.current = false;
      setDangLay(false);
    }
  };

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title={`Đơn hàng ${SAN.ten}`}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMoLayDon(true)}
              disabled={!ketNoi || dangLay}
              className="h-10 gap-2 rounded-lg px-3 text-bo-foreground hover:bg-slate-100"
            >
              <CalendarRange className="size-4" />
              Lấy đơn theo ngày
            </Button>
            <Button type="button" onClick={layDonMoi} disabled={!ketNoi || dangLay} className={NUT_CHINH}>
              {dangLay ? <Loader2 className="size-4 animate-spin" /> : null}
              {dangLay ? "Đang lấy đơn…" : "Lấy đơn mới"}
            </Button>
          </>
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
          !ds.error && tong > 0 ? (
            <TablePagination
              page={trang.page}
              size={trang.size}
              total={tong}
              onPageChange={(page) => page >= 0 && setTrang((cu) => ({ ...cu, page }))}
              onSizeChange={(size) => setTrang({ page: 0, size })}
            />
          ) : null
        }
      >
        {cfg.initialLoading || ds.initialLoading ? (
          <LoadingState label="Đang tải đơn hàng" />
        ) : ds.error || (cfg.error && !cfg.data) ? (
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
              description={`Đơn mới được lấy tự động theo Cấu hình, hoặc bấm "Lấy đơn mới".`}
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
                      <TrangThaiCham label={st.label} tone={st.tone} />
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
