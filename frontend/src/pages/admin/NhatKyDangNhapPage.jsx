import { useEffect, useState } from "react";
import { ArrowLeft, ScrollText, SearchX, ShieldAlert } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import PageContainer from "@/components/backoffice/PageContainer";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { KetQuaPill } from "@/components/nguoi-dung/chi-tiet/DangNhapNguoiDung";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { adminService } from "@/services/adminService";
import { formatDateTime } from "@/utils/formatters";
import { t } from "@/i18n";

const KET_QUA_TABS = [
  { value: "all", label: t("Tất cả") },
  { value: "thanh_cong", label: t("Thành công") },
  { value: "that_bai", label: t("Thất bại") },
];
const KET_QUA_VALUES = KET_QUA_TABS.map((tab) => tab.value);

const KHOANG_NGAY = [
  { value: "1", label: t("24 giờ qua") },
  { value: "7", label: t("7 ngày qua") },
  { value: "30", label: t("30 ngày qua") },
  { value: "90", label: t("90 ngày qua") },
];
const KHOANG_NGAY_VALUES = KHOANG_NGAY.map((o) => o.value);

const SEARCH_DEBOUNCE_MS = 350;
const MAC_DINH = { q: "", ketQua: "all", soNgay: "7", page: 0, size: SO_DONG_MAC_DINH };

/** Câu mô tả tài khoản trong khung "Cần chú ý". */
function lyDoChuY(item) {
  if (item.lyDo === "khoa_dung_mat_khau") return t("nhập đúng mật khẩu khi tài khoản đang khóa");
  return t("sai mật khẩu {{count}} lần", { count: item.soLan });
}

/**
 * Màn Nhật ký đăng nhập toàn hệ thống (quản trị viên), mở từ nút trên trang Người dùng — không thêm mục menu.
 * Dựng từ dữ liệu sẵn có (không thêm bảng): các lần đăng nhập thành công / thất bại trong lich_su_thay_doi.
 * Không tính đăng xuất và không tính công cụ tự động (dò tên không tồn tại) — hệ thống không ghi hai loại này.
 */
export default function NhatKyDangNhapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const backTo =
    typeof location.state?.from === "string" && location.state.from.startsWith("/users")
      ? location.state.from
      : "/users";

  const [filters, setFilters] = useState(MAC_DINH);
  const [searchText, setSearchText] = useState("");

  const duLieu = useTaiDuLieu(
    () =>
      adminService.layNhatKyDangNhapHeThong({
        q: filters.q || undefined,
        ketQua: filters.ketQua,
        soNgay: filters.soNgay,
        page: filters.page,
        size: filters.size,
      }),
    JSON.stringify(filters),
  );
  const canChuY = useTaiDuLieu(() => adminService.layCanChuYDangNhap(), "");

  // Debounce ô tìm → filters.q (về trang đầu)
  useEffect(() => {
    const keyword = searchText.trim();
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.q === keyword ? prev : { ...prev, q: keyword, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const changeFilter = (key, value) =>
    setFilters((prev) => (prev[key] === value ? prev : { ...prev, [key]: value, page: 0 }));

  const clearFilters = () => {
    setSearchText("");
    setFilters((prev) => ({ ...MAC_DINH, size: prev.size }));
  };

  const hasFilter = Boolean(searchText.trim()) || filters.ketQua !== "all" || filters.soNgay !== "7";

  const page = duLieu.data ?? {};
  const rows = Array.isArray(page.content) ? page.content : [];
  const total = page.totalElements ?? 0;
  const dsChuY = Array.isArray(canChuY.data) ? canChuY.data : [];

  return (
    <PageContainer fill className="space-y-4">
      <div className="flex items-center gap-3.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => navigate(backTo)}
          aria-label={t("Quay lại danh sách người dùng")}
          title={t("Quay lại danh sách người dùng")}
          className="shrink-0 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <ListPageHeader title={t("Nhật ký đăng nhập")} />
        </div>
      </div>

      {/* ── Cần chú ý (24 giờ) ── */}
      {dsChuY.length > 0 ? (
        <div className="rounded-lg border border-bo-danger/30 bg-bo-danger-soft px-4 py-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 size-[18px] shrink-0 text-bo-danger" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-800">
                {t("{{count}} tài khoản cần chú ý trong 24 giờ qua", { count: dsChuY.length })}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {dsChuY.map((item) => (
                  <li key={item.nguoiDungId} className="text-[13px] leading-5 text-slate-700">
                    <Link
                      to={`/users/${item.nguoiDungId}?tab=dang-nhap`}
                      state={{ from: `${location.pathname}${location.search}` }}
                      className="font-medium text-bo-foreground underline-offset-2 hover:text-bo-primary hover:underline"
                    >
                      {item.hoTen?.trim() || item.tenDangNhap}
                    </Link>
                    {item.tenDangNhap && item.hoTen?.trim() ? (
                      <span className="text-bo-muted"> @{item.tenDangNhap}</span>
                    ) : null}
                    <span className="text-slate-600"> — {lyDoChuY(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label={t("Lọc theo kết quả đăng nhập")}
                tabs={KET_QUA_TABS}
                value={filters.ketQua}
                onChange={(value) => KET_QUA_VALUES.includes(value) && changeFilter("ketQua", value)}
              />
            }
            hasFilter={hasFilter}
            onClear={clearFilters}
          >
            <SearchInput
              label={t("Tìm theo tên hoặc IP")}
              placeholder={t("Tên, tài khoản, IP")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilters((prev) => ({ ...prev, q: searchText.trim(), page: 0 }));
              }}
              onClear={() => setSearchText("")}
              className="sm:w-[300px]"
            />
            <FilterSelect
              label={t("Khoảng thời gian")}
              value={KHOANG_NGAY_VALUES.includes(filters.soNgay) ? filters.soNgay : "7"}
              options={KHOANG_NGAY}
              onChange={(value) => changeFilter("soNgay", value)}
              align="end"
            />
          </ListToolbar>
        }
        footer={
          !duLieu.loading && !duLieu.error && rows.length > 0 ? (
            <TablePagination
              page={filters.page}
              size={filters.size}
              total={total}
              onPageChange={(p) => p >= 0 && setFilters((prev) => ({ ...prev, page: p }))}
              onSizeChange={(size) =>
                setFilters((prev) => (prev.size === size ? prev : { ...prev, size, page: 0 }))
              }
            />
          ) : null
        }
      >
        {duLieu.initialLoading ? (
          <LoadingState label={t("Đang tải nhật ký đăng nhập")} />
        ) : duLieu.error && !duLieu.data ? (
          <ErrorState
            description={t("Không tải được nhật ký đăng nhập. Vui lòng thử lại.")}
            error={duLieu.error}
            onRetry={duLieu.reload}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={hasFilter ? SearchX : ScrollText}
            title={hasFilter ? t("Không có lần nào phù hợp bộ lọc") : t("Chưa có lần đăng nhập nào")}
            description={
              hasFilter
                ? t("Thử đổi từ khóa, kết quả hoặc khoảng thời gian.")
                : t("Các lần đăng nhập của mọi người sẽ hiện ở đây.")
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                <th scope="col" className="h-10 w-px whitespace-nowrap px-4">{t("Thời gian")}</th>
                <th scope="col" className="h-10 px-4">{t("Người dùng")}</th>
                <th scope="col" className="h-10 px-4">{t("Kết quả")}</th>
                <th scope="col" className="h-10 px-4 text-right">{t("Địa chỉ IP")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {rows.map((r) => {
                const ten = r.hoTen?.trim() || r.tenDangNhap || t("Không rõ");
                return (
                  <tr key={r.id} className="hover:bg-bo-surface-subtle">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-bo-muted">{formatDateTime(r.luc)}</td>
                    <td className="px-4 py-2.5">
                      {r.nguoiDungId != null ? (
                        <Link
                          to={`/users/${r.nguoiDungId}?tab=dang-nhap`}
                          state={{ from: `${location.pathname}${location.search}` }}
                          className="font-medium text-bo-foreground hover:text-bo-primary hover:underline"
                        >
                          {ten}
                        </Link>
                      ) : (
                        <span className="font-medium text-bo-foreground">{ten}</span>
                      )}
                      {r.tenDangNhap && r.hoTen?.trim() ? (
                        <span className="ml-1 text-[13px] text-bo-muted">@{r.tenDangNhap}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5"><KetQuaPill ketQua={r.ketQua} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] text-bo-muted">
                      {r.diaChiIp || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableShell>
    </PageContainer>
  );
}
