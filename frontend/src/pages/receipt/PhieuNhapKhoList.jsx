import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  SearchX,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import FilterSelect from "@/components/shared/FilterSelect";
import useHangLoiCho from "@/components/nhap-kho/tra-hang/useHangLoiCho";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LocKhoangNgay from "@/components/shared/LocKhoangNgay";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { nguoiDungService } from "@/services/nguoiDungService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getAllSupplier } from "@/services/supplierService";
import {
  GOODS_RECEIPT_TABS,
  getGoodsReceiptStatus,
} from "@/constants/goodsReceipt";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";
import { formatDate } from "@/utils/formatters";
import { t } from "@/i18n";
import { VAI_TRO_KHO } from "@/constants/vaiTroTheoNghiepVu";

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = GOODS_RECEIPT_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const TAB_CHO_NHAP_KHO = "cho-nhap-kho";
const TONE_TAB = { [TAB_CHO_NHAP_KHO]: "warning" };
const trangThaiCuaTab = (ma) => GOODS_RECEIPT_TABS.find((tab) => tab.ma === ma)?.trangThai ?? null;

// Vai trò xử lý phiếu chờ nhập kho (dòng chú ý, R4)
const VAI_TRO_NHAP_KHO = [ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];
// Ô tìm kiếm / nhà cung cấp: chỉ gọi API khi ngừng gõ
const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_FILTERS = {
  keyword: "",
  nhaCungCap: "",
  tuNgay: "",
  denNgay: "",
  page: 0,
  size: SO_DONG_MAC_DINH,
};

function parseRoles(vaiTro) {
  if (!vaiTro) return [];
  return vaiTro.split(/\s+/).filter(Boolean);
}

function buildFilterPayload(filters) {
  const filterList = [];
  if (filters.keyword?.trim()) {
    const kw = filters.keyword.trim();
    ["soPhieuNhap", "donMuaHang.soDonMua"].forEach(field => {
      filterList.push({ fieldName: field, operation: "LIKE", value: kw, logicType: "OR" });
    });
  }
  if (filters.nhaCungCap) {
    filterList.push({ fieldName: "nhaCungCap.id", operation: "EQUALS", value: Number(filters.nhaCungCap) });
  }
  if (filters.trangThai != null) {
    filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: Number(filters.trangThai) });
  }
  // Ngày nhập lọc ở máy chủ (trước đây lọc trên trang đang xem nên tổng số và số trên tab không theo ngày)
  // Ngày nhập: khoảng ngày, bỏ trống một đầu được
  if (filters.tuNgay) {
    filterList.push({ fieldName: "ngayNhap", operation: "GREATER_THAN_OR_EQUAL", value: filters.tuNgay });
  }
  if (filters.denNgay) {
    filterList.push({ fieldName: "ngayNhap", operation: "LESS_THAN_OR_EQUAL", value: `${filters.denNgay}T23:59:59` });
  }
  // Ô lọc "Hàng lỗi chờ trả": lọc theo mã phiếu (bộ lọc IN sẵn có của API); không có phiếu nào thì lọc rỗng
  if (filters.idIn) {
    filterList.push(filters.idIn.length
      ? { fieldName: "id", operation: "IN", value: filters.idIn }
      : { fieldName: "id", operation: "EQUALS", value: -1 });
  }
  return {
    page: filters.page,
    size: filters.size,
    filters: filterList,
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
  };
}

// Đếm số phiếu khớp điều kiện: cùng yêu cầu của danh sách, chỉ lấy 1 dòng để đọc totalElements
async function demPhieu(filters) {
  const res = await phieuNhapKhoService.filter(buildFilterPayload({ ...filters, page: 0, size: 1 }));
  return res?.totalElements ?? 0;
}

export default function PhieuNhapKhoList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  // Trang tải ngay khi mở: bắt đầu ở trạng thái đang tải để không nháy ô "chưa có phiếu"
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);

  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = trangThaiCuaTab(tab);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Ô tìm đổi ngay khi gõ; filters.keyword đổi sau khi ngừng gõ. Nhà cung cấp chọn trong danh sách (id)
  const [keywordInput, setKeywordInput] = useState("");
  const dsNcc = useTaiDuLieu(() => getAllSupplier(), "ncc-phieu-nhap");

  // Quản lý kho / Nhân viên kho thấy dòng "N phiếu đang chờ nhập kho"
  const [xuLyNhapKho, setXuLyNhapKho] = useState(false);
  // Việc hàng lỗi còn treo của kho: dòng chú ý + lọc (thay cho màn Trả hàng nhà cung cấp riêng)
  const laKho = hasAnyRole(VAI_TRO_KHO);
  const hangLoi = useHangLoiCho(laKho);
  const [locHangLoi, setLocHangLoi] = useState(false);
  const idIn = locHangLoi ? hangLoi.phieuChoGiaoTra : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      const keyword = keywordInput.trim();
      setFilters(p => (p.keyword === keyword ? p : { ...p, keyword, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // Vai trò đọc từ hồ sơ người dùng hiện tại (như trang Yêu cầu nhập hàng)
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) return undefined;
    let huy = false;
    nguoiDungService.getById(userId)
      .then((res) => {
        if (huy) return;
        const roles = parseRoles(res?.data?.vaiTro);
        setXuLyNhapKho(roles.some((role) => VAI_TRO_NHAP_KHO.includes(role)));
      })
      .catch((err) => console.error("Lỗi khi tải vai trò người dùng:", err));
    return () => { huy = true; };
  }, []);

  // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    try {
      const res = await phieuNhapKhoService.filter(buildFilterPayload({ ...filters, trangThai: tabTrangThai, idIn }));
      if (requestId !== requestIdRef.current) return;
      // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
      const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
      if (trangCuoi != null) {
        setFilters((p) => ({ ...p, page: trangCuoi }));
        return;
      }
      setData(res.content || []);
      setTotal(res.totalElements || 0);
      setLoadError(false);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Lỗi tải danh sách phiếu nhập:", err);
      if (silent) throw err;
      // Không giữ dòng + tổng số của lần tải trước (R9). Giữ lỗi để ô lỗi phân biệt 403 (không có quyền)
      setLoadError(err);
      setData([]);
      setTotal(0);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [filters, tabTrangThai, idIn]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // ── Số trên tab: cùng từ khóa + nhà cung cấp đang lọc, chỉ thay trạng thái (R1) ──
  const tabCounts = useDemTheoTrangThai(
    TAB_MAS,
    (ma) => demPhieu({ ...filters, trangThai: trangThaiCuaTab(ma), idIn }),
    `${filters.keyword}|${filters.nhaCungCap}|${filters.tuNgay}|${filters.denNgay}|${idIn ? idIn.join(",") : ""}`
  );

  // ── Dòng chú ý: phiếu chờ nhập kho trong phạm vi danh sách, bỏ qua các bộ lọc khác (R4) ──
  const choNhapKho = useDemTheoTrangThai(
    [TAB_CHO_NHAP_KHO],
    () => demPhieu({ ...DEFAULT_FILTERS, trangThai: trangThaiCuaTab(TAB_CHO_NHAP_KHO) }),
    TAB_CHO_NHAP_KHO,
    { enabled: xuLyNhapKho }
  );

  // Đổi tab: ghi lên URL và về trang đầu
  const changeTab = (value) => {
    setTab(value);
    setFilters(p => (p.page === 0 ? p : { ...p, page: 0 }));
  };

  const hasActiveFilters = Boolean(keywordInput.trim() || filters.nhaCungCap || filters.tuNgay || filters.denNgay || locHangLoi);

  // "Xóa lọc": bỏ từ khóa, nhà cung cấp, ngày nhập; giữ tab đang chọn
  const clearFilters = () => {
    setKeywordInput("");
    setLocHangLoi(false);
    setFilters(p => ({ ...DEFAULT_FILTERS, size: p.size }));
  };

  // Nút của dòng chú ý: mở tab Chờ nhập kho, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
  const showPending = () => {
    clearFilters();
    setTab(TAB_CHO_NHAP_KHO);
  };

  const handleRetry = () => {
    fetchData();
    tabCounts.reload();
    choNhapKho.reload();
  };

  // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: kiểm đếm, QC, xác nhận nhập do nhân viên kho làm
  const capNhat = useTaiLaiDanhSach({
    duLieu: data,
    taiNgam: () => {
      tabCounts.reload();
      choNhapKho.reload();
      return fetchData({ silent: true });
    },
    bat: !loading,
  });

  // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
  const statusTabs = GOODS_RECEIPT_TABS.map((tg) => ({
    value: tg.ma,
    label: t(tg.label),
    tone: TONE_TAB[tg.ma],
    count: loadError ? null : tabCounts.counts[tg.ma],
  }));

  const pendingCount = xuLyNhapKho && tab !== TAB_CHO_NHAP_KHO ? choNhapKho.counts[TAB_CHO_NHAP_KHO] : null;
  const emptyTabLabel = t(GOODS_RECEIPT_TABS.find((tg) => tg.ma === tab)?.label);

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          // Nhân viên mua hàng chỉ xem phiếu nhập (SRS 4.4 "Goods Receipt"): không tạo phiếu
          hasAnyRole(VAI_TRO_KHO) ? (
            <Button asChild className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
              <Link to="/goods-receipts/create">
                <Plus className="size-4" /> {t("Tạo phiếu nhập kho")}
              </Link>
            </Button>
          ) : null
        }
      />

      <AttentionBar
        count={pendingCount}
        actionLabel={t("Xem phiếu chờ nhập kho")}
        onAction={showPending}
      >
        <strong className="font-semibold">{pendingCount?.toLocaleString("vi-VN")} {t("phiếu", { count: Number(pendingCount) || 0 })}</strong> {t("đang chờ nhập kho.")}
      </AttentionBar>

      {/* Dòng chú ý cho kho: phiếu đã nhập kho còn hàng lỗi nằm ở kho chờ giao trả nhà cung cấp */}
      <AttentionBar
        count={laKho && !locHangLoi ? hangLoi.phieuChoGiaoTra.length : 0}
        actionLabel={t("Xem phiếu có hàng lỗi")}
        onAction={() => {
          clearFilters();
          setLocHangLoi(true);
          setTab("tat-ca");
        }}
      >
        <strong className="font-semibold">{t("{{count}} phiếu", { count: hangLoi.phieuChoGiaoTra.length })}</strong>{" "}
        {t("còn hàng lỗi ở kho chờ giao trả hoặc tiêu hủy theo lựa chọn của nhà cung cấp.")}
      </AttentionBar>

      {/* ── TABLE ── */}
      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label={t("Lọc phiếu nhập kho theo trạng thái")}
                tabs={statusTabs}
                value={tab}
                onChange={changeTab}
              />
            }
            hasFilter={hasActiveFilters}
            onClear={clearFilters}
          >
            <SearchInput
              label={t("Tìm phiếu nhập kho")}
              placeholder={t("Số phiếu, số đơn mua")}
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onClear={() => setKeywordInput("")}
              className="sm:w-[300px]"
            />

            <FilterSelect
              label={t("Nhà cung cấp")}
              value={filters.nhaCungCap}
              options={[
                { value: "", label: t("Tất cả nhà cung cấp") },
                ...(Array.isArray(dsNcc.data) ? dsNcc.data : []).map((n) => ({ value: String(n.id), label: n.tenNhaCungCap })),
              ]}
              onChange={(v) => setFilters(p => ({ ...p, nhaCungCap: v, page: 0 }))}
              onClear={() => setFilters(p => ({ ...p, nhaCungCap: "", page: 0 }))}
              clearLabel={t("Bỏ lọc nhà cung cấp")}
              className="sm:w-[220px]"
            />

            <LocKhoangNgay
              nhan={t("Ngày nhập")}
              tuNgay={filters.tuNgay}
              denNgay={filters.denNgay}
              onDoi={({ tuNgay, denNgay }) => setFilters(p => ({ ...p, tuNgay, denNgay, page: 0 }))}
            />

            {/* Ô lọc hàng lỗi chỉ hiện khi đang lọc (mở từ dòng chú ý) */}
            {laKho && locHangLoi ? (
              <FilterSelect
                label={t("Hàng lỗi")}
                value={locHangLoi ? "cho-giao-tra" : "tat-ca"}
                options={[
                  { value: "tat-ca", label: t("Mọi phiếu") },
                  { value: "cho-giao-tra", label: t("Hàng lỗi chờ trả") },
                ]}
                onChange={(v) => { setLocHangLoi(v === "cho-giao-tra"); setFilters(p => ({ ...p, page: 0 })); }}
                onClear={() => { setLocHangLoi(false); setFilters(p => ({ ...p, page: 0 })); }}
                clearLabel={t("Bỏ lọc hàng lỗi")}
                className="sm:w-[200px]"
              />
            ) : null}
          </ListToolbar>
        }
        footer={
          !loading && !loadError ? (
            <TablePagination
              page={filters.page}
              size={filters.size}
              total={total}
              onPageChange={(page) => setFilters(p => ({ ...p, page }))}
              onSizeChange={(size) => setFilters(p => ({ ...p, size, page: 0 }))}
              capNhat={capNhat}
            />
          ) : null
        }
      >
        {loading ? (
          <LoadingState rows={5} label={t("Đang tải danh sách phiếu nhập kho")} />
        ) : loadError ? (
          <ErrorState
            description={t("Không thể tải danh sách phiếu nhập kho. Vui lòng thử lại.")}
            error={loadError}
            onRetry={handleRetry}
          />
        ) : data.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title={t("Không tìm thấy phiếu nhập kho phù hợp")}
              description={t("Thử đổi từ khóa, nhà cung cấp hoặc ngày nhập.")}
              action={
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  {t("Xóa lọc")}
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={ClipboardList}
              title={t("Không có phiếu nhập kho nào ở trạng thái \"{{emptyTabLabel}}\"", { emptyTabLabel })}
              description={t("Chọn tab Tất cả để xem mọi phiếu nhập kho.")}
              action={
                <Button
                  variant="outline"
                  onClick={() => changeTab(TAB_MAC_DINH)}
                  className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  {t("Xem tất cả")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={t("Chưa có phiếu nhập kho")}
              description={t("Phiếu nhập kho từ đơn mua hàng, chuyển kho nội bộ và hoàn trả sẽ hiện ở đây.")}
            />
          )
        ) : (
          <>
          {/* Điện thoại: mỗi phiếu một thẻ — số phiếu + trạng thái, nhà cung cấp + đơn mua, ngày tạo · kho nhập + ngày nhập */}
          <ul className="divide-y divide-bo-border md:hidden">
            {data.map((item) => (
              <li key={item.id}>
                <Link to={`/goods-receipts/${item.id}`} className="grid grid-cols-1 gap-1 px-4 py-3 active:bg-bo-surface-subtle">
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] font-semibold text-bo-primary">{item.soPhieuNhap}</span>
                    <StatusBadge quyTrinh="phieuNhap" label={getGoodsReceiptStatus(item.trangThai).label} />
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-bo-foreground">{item.tenNhaCungCap || "—"}</span>
                    {item.soDonMua ? <span className="shrink-0 text-bo-muted">{item.soDonMua}</span> : null}
                  </span>
                  <span className="flex items-baseline justify-between gap-3 text-[13px] text-bo-muted">
                    <span className="min-w-0 truncate">
                      {formatDate(item.ngayTao)}
                      {item.tenKho || item.kho?.tenKho ? ` · ${item.tenKho || item.kho?.tenKho}` : ""}
                    </span>
                    {item.ngayNhap ? <span className="shrink-0">{t("Ngày nhập {{ngayNhap}}", { ngayNhap: formatDate(item.ngayNhap) })}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên.
              Máy tính bảng dọc (cảm ứng): bỏ cột STT, Ngày tạo (đưa thành dòng phụ dưới số phiếu) để không vuốt ngang */}
          <table className="w-full min-w-[900px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 w-14 whitespace-nowrap bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("STT")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Số phiếu nhập")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Đơn mua / nhà cung cấp")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Kho nhập")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Ngày tạo")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Ngày nhập")}</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Trạng thái")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/goods-receipts/${item.id}`)}
                  className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                >
                  <td className="w-14 px-4 py-3 text-center align-middle cam-ung:max-lg:hidden">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-bo-surface-subtle text-xs font-semibold text-bo-muted">
                      {filters.page * filters.size + index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle font-semibold text-bo-primary">
                    {item.soPhieuNhap}
                    <span className="mt-0.5 hidden text-xs font-normal text-bo-muted cam-ung:max-lg:block">{formatDate(item.ngayTao)}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-bo-foreground">{item.soDonMua || "—"}</span>
                      <span className="text-xs text-bo-muted">{item.tenNhaCungCap || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-bo-foreground">
                    {item.tenKho || item.kho?.tenKho || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-bo-muted cam-ung:max-lg:hidden">
                    {formatDate(item.ngayTao)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-bo-muted">
                    {item.ngayNhap ? formatDate(item.ngayNhap) : t("Chưa nhập kho")}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge quyTrinh="phieuNhap" label={getGoodsReceiptStatus(item.trangThai).label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </TableShell>
    </PageContainer>
  );
}
