// src/pages/stock-take/StockTakeList.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, Eye, Grid2x2, Play, Plus, SearchX } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { TAB_DOT, TT_DOT, moTaPhamVi, nhanPhamVi, nhanTrangThaiDot, tienCoDau } from "@/components/kiem-ke/kiemKe";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { layDanhSachDot } from "@/services/stockTakeService";
import { hasAnyRole, ROLES } from "@/utils/roles";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatDate } from "@/utils/formatters";

const TAB_VALUES = TAB_DOT.map((t) => t.value);
const TAB_MAC_DINH = "tat-ca";
const TAB_CHO_DUYET = "cho-duyet";

const khopTab = (item, tab) => {
  const trangThai = TAB_DOT.find((t) => t.value === tab)?.trangThai;
  return trangThai == null || Number(item.trangThai) === trangThai;
};

const khopTuKhoa = (item, tuKhoa) => {
  const tu = boDau(tuKhoa.trim()).toLowerCase();
  if (!tu) return true;
  return [item.ma, item.ten, item.kho?.ten, item.nguoiChuTri?.hoTen, nhanPhamVi(item.loaiKiemKe)].some((x) =>
    boDau(String(x ?? "")).toLowerCase().includes(tu),
  );
};

/** Ngày hiển thị của đợt: đã bắt đầu → ngày bắt đầu, nháp → ngày tạo. */
const ngayCua = (d) => d.ngayBatDau ?? d.ngayTao;

const TH_CLASS = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/** Thanh tiến độ nhỏ trong bảng: "12/40" + vạch. Nháp: "Chưa chốt". */
function TienDo({ d }) {
  const tk = d.thongKe ?? {};
  if (Number(d.trangThai) === TT_DOT.NHAP) return <span className="text-xs text-bo-muted">Chưa chốt dòng</span>;
  const tong = tk.tongDong ?? 0;
  const da = tk.daDem ?? 0;
  const pt = tong ? Math.floor((da / tong) * 100) : 0;
  return (
    <span className="block min-w-[112px]">
      <span className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="font-semibold text-bo-foreground">
          {soVN(da)}
          <span className="font-normal text-bo-muted">/{soVN(tong)}</span>
        </span>
        <span className="text-bo-muted">{pt}%</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200/80" aria-hidden="true">
        <span
          className={cn("block h-full rounded-full", pt >= 100 ? "bg-bo-success" : "bg-bo-primary")}
          // data-viz: bề rộng theo phần trăm dòng đã đếm
          style={{ width: `${pt}%` }}
        />
      </span>
    </span>
  );
}

/** Chênh lệch ròng (hiện từ lúc trình duyệt, khi số đếm đã chốt). */
function ChenhLech({ d }) {
  const tt = Number(d.trangThai);
  const tk = d.thongKe ?? {};
  if (tt !== TT_DOT.CHO_DUYET && tt !== TT_DOT.DA_DUYET) return <span className="text-bo-muted">—</span>;
  if (!tk.lech) return <span className="text-xs font-semibold text-bo-success">Khớp sổ</span>;
  const rong = Number(tk.giaTriRong) || 0;
  return (
    <span className="block text-right leading-5">
      <span className={cn("block font-semibold tabular-nums", rong < 0 ? "text-bo-danger" : "text-bo-primary-strong")}>{tienCoDau(rong)}</span>
      <span className="block text-xs text-bo-muted tabular-nums">{soVN(tk.lech)} dòng lệch</span>
    </span>
  );
}

/**
 * Danh sách đợt kiểm kê (/stock-take). Tab trên URL ?trangThai= (Tổng quan liên kết tới "dang-kiem-ke"). Dòng chú ý:
 * quản lý kho / quản trị thấy đợt chờ duyệt; nhân viên kho thấy đợt đang kiểm kê. Lối vào Sơ đồ khóa ở đầu trang.
 */
export default function StockTakeList() {
  const navigate = useNavigate();
  const [ds, setDs] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(false);
  const [tuKhoa, setTuKhoa] = useState("");
  const [tab, setTab] = useTabTrenUrl(TAB_VALUES, TAB_MAC_DINH);
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState(SO_DONG_MAC_DINH);
  const [laQuanLy] = useState(() => hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]));
  const [laNhanVien] = useState(() => !hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]) && hasAnyRole([ROLES.NHAN_VIEN_KHO]));

  const lanTaiRef = useRef(0);
  const tai = useCallback(async ({ ngam = false } = {}) => {
    const lan = ++lanTaiRef.current;
    if (!ngam) {
      setDangTai(true);
      setLoiTai(false);
    }
    try {
      const data = await layDanhSachDot();
      if (lan !== lanTaiRef.current) return;
      setDs(data);
      setLoiTai(false);
    } catch (error) {
      if (lan !== lanTaiRef.current) return;
      if (ngam) {
        console.error(error);
        return;
      }
      setDs([]);
      setLoiTai(true);
      toast.error(error.response?.data?.message || "Không thể tải danh sách kiểm kê");
    } finally {
      if (lan === lanTaiRef.current) setDangTai(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => tai());
  }, [tai]);
  useTaiLaiKhiQuayLai(() => tai({ ngam: true }), { bat: !dangTai });

  const doiTab = (v) => {
    setTab(v);
    setTrang(0);
  };
  const doiTuKhoa = (v) => {
    setTuKhoa(v);
    setTrang(0);
  };
  const xoaTuKhoa = () => doiTuKhoa("");

  const daTim = useMemo(() => ds.filter((x) => khopTuKhoa(x, tuKhoa)), [ds, tuKhoa]);
  const daLoc = useMemo(() => daTim.filter((x) => khopTab(x, tab)), [daTim, tab]);
  const tabs = useMemo(
    () =>
      TAB_DOT.map(({ value, label, tone }) => ({
        value,
        label,
        tone,
        count: dangTai || loiTai ? null : daTim.filter((x) => khopTab(x, value)).length,
      })),
    [daTim, dangTai, loiTai],
  );

  const choDuyet = ds.filter((x) => Number(x.trangThai) === TT_DOT.CHO_DUYET && x.quyen?.pheDuyet).length;
  const dangKiem = ds.filter((x) => Number(x.trangThai) === TT_DOT.DANG_KIEM_KE).length;
  const chuY =
    dangTai || loiTai
      ? null
      : laQuanLy && choDuyet && tab !== TAB_CHO_DUYET
        ? { tone: "warning", so: choDuyet, chu: "đợt kiểm kê chờ bạn thẩm định.", nut: "Xem đợt chờ duyệt", tab: TAB_CHO_DUYET }
        : laNhanVien && dangKiem && tab !== "dang-kiem-ke"
          ? { tone: "info", so: dangKiem, chu: "đợt kiểm kê đang đếm.", nut: "Xem đợt đang kiểm kê", tab: "dang-kiem-ke" }
          : null;

  const tong = daLoc.length;
  const soTrang = Math.max(1, Math.ceil(tong / coTrang));
  const trangAnToan = Math.min(trang, soTrang - 1);
  const muc = daLoc.slice(trangAnToan * coTrang, (trangAnToan + 1) * coTrang);
  const dangTim = Boolean(tuKhoa.trim());
  const nhanTab = TAB_DOT.find((t) => t.value === tab)?.label;
  const moDot = (d) => navigate(`/stock-take/${d.id}`);

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/stock-take/lock-map")}
              className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
            >
              <Grid2x2 className="size-4" />
              Sơ đồ khóa
            </Button>
            {laQuanLy ? (
              <Button onClick={() => navigate("/stock-take/new")} className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Plus className="size-4" />
                Tạo đợt kiểm kê
              </Button>
            ) : null}
          </>
        }
      />

      <AttentionBar tone={chuY?.tone} count={chuY?.so ?? null} actionLabel={chuY?.nut} onAction={() => chuY && doiTab(chuY.tab)}>
        <strong className="font-semibold">{soVN(chuY?.so ?? 0)}</strong> {chuY?.chu}
      </AttentionBar>

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={<StatusTabs label="Lọc đợt kiểm kê theo trạng thái" tabs={tabs} value={tab} onChange={doiTab} />}
            hasFilter={dangTim}
            onClear={xoaTuKhoa}
          >
            <SearchInput
              placeholder="Tìm mã đợt, tên đợt, kho, người chủ trì..."
              label="Tìm đợt kiểm kê"
              value={tuKhoa}
              onChange={(e) => doiTuKhoa(e.target.value)}
              onClear={xoaTuKhoa}
              className="sm:w-[300px]"
            />
          </ListToolbar>
        }
        footer={
          !dangTai && !loiTai && tong > 0 ? (
            <TablePagination
              page={trangAnToan}
              size={coTrang}
              total={tong}
              onPageChange={(p) => p >= 0 && p < soTrang && setTrang(p)}
              onSizeChange={(n) => {
                setCoTrang(n);
                setTrang(0);
              }}
            />
          ) : null
        }
      >
        {dangTai ? (
          <LoadingState rows={6} label="Đang tải danh sách đợt kiểm kê" />
        ) : loiTai ? (
          <ErrorState description="Không thể tải danh sách đợt kiểm kê. Vui lòng thử lại." onRetry={() => tai()} />
        ) : muc.length === 0 ? (
          dangTim ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy đợt kiểm kê phù hợp"
              description="Thử đổi từ khóa tìm kiếm."
              action={
                <Button variant="outline" onClick={xoaTuKhoa} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                  Xóa lọc
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={ClipboardList}
              title={`Không có đợt kiểm kê nào ở trạng thái "${nhanTab}"`}
              description="Chọn tab Tất cả để xem mọi đợt kiểm kê."
              action={
                <Button
                  variant="outline"
                  onClick={() => doiTab(TAB_MAC_DINH)}
                  className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  Xem tất cả
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Chưa có đợt kiểm kê nào"
              description={
                laQuanLy
                  ? "Kiểm kê theo khu vực, theo kệ hay theo danh mục để chỉ tạm dừng đúng phần hàng cần đếm."
                  : "Quản lý kho sẽ lập đợt kiểm kê; đợt đang đếm sẽ hiện ở đây."
              }
              action={
                laQuanLy ? (
                  <Button onClick={() => navigate("/stock-take/new")} className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                    <Plus className="size-4" />
                    Tạo đợt đầu tiên
                  </Button>
                ) : null
              }
            />
          )
        ) : (
          <>
            {/* Điện thoại: mỗi đợt một thẻ — mã + trạng thái, tên + kho, phạm vi, tiến độ */}
            <ul className="divide-y divide-bo-border md:hidden">
              {muc.map((d) => (
                <li key={d.id}>
                  <Link to={`/stock-take/${d.id}`} className="grid grid-cols-1 gap-1.5 px-4 py-3 active:bg-bo-surface-subtle">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-[15px] font-semibold tracking-wide text-bo-primary">{d.ma}</span>
                      <StatusBadge quyTrinh="kiemKe" label={nhanTrangThaiDot(d.trangThai)} />
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-bo-foreground">{d.ten || "—"}</span>
                      {d.kho?.ten ? <span className="shrink-0 text-bo-muted">{d.kho.ten}</span> : null}
                    </span>
                    <span className="min-w-0 truncate text-[13px] text-bo-muted">
                      {nhanPhamVi(d.loaiKiemKe)}
                      {d.loaiKiemKe !== "toan_bo" ? ` · ${moTaPhamVi(d, 2)}` : ""} · {formatDate(ngayCua(d))}
                    </span>
                    {Number(d.trangThai) !== TT_DOT.NHAP ? <TienDo d={d} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
            <table className="w-full min-w-[1040px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={`${TH_CLASS} text-left`}>Đợt kiểm kê</th>
                  <th className={`${TH_CLASS} text-left`}>Kho</th>
                  <th className={`${TH_CLASS} text-left`}>Phạm vi</th>
                  <th className={`${TH_CLASS} w-[150px] text-left cam-ung:max-lg:hidden`}>Tiến độ</th>
                  <th className={`${TH_CLASS} w-[140px] text-right cam-ung:max-lg:hidden`}>Chênh lệch</th>
                  <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                  <th className={`${TH_CLASS} text-center`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {muc.map((d) => {
                  const dangDem = Number(d.trangThai) === TT_DOT.DANG_KIEM_KE && d.quyen?.dem;
                  return (
                    <tr key={d.id} className="transition-colors hover:bg-bo-surface-subtle">
                      <td className="max-w-[260px] px-4 py-3.5 align-middle">
                        <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-bo-primary">
                          {d.ma}
                        </span>
                        <span className="mt-1 block truncate font-semibold leading-snug text-bo-foreground" title={d.ten}>
                          {d.ten || "—"}
                        </span>
                        <span className="block text-xs text-bo-muted">
                          {formatDate(ngayCua(d))}
                          {d.nguoiChuTri?.hoTen ? ` · ${d.nguoiChuTri.hoTen}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-medium text-bo-foreground">{d.kho?.ten || "—"}</span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3.5 align-middle">
                        <span className="block font-medium text-bo-foreground">{nhanPhamVi(d.loaiKiemKe)}</span>
                        {d.loaiKiemKe !== "toan_bo" ? (
                          <span className="block truncate text-xs text-bo-muted" title={moTaPhamVi(d, 50)}>
                            {moTaPhamVi(d, 3)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 align-middle cam-ung:max-lg:hidden">
                        <TienDo d={d} />
                      </td>
                      <td className="px-4 py-3.5 text-right align-middle cam-ung:max-lg:hidden">
                        <ChenhLech d={d} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <StatusBadge quyTrinh="kiemKe" label={nhanTrangThaiDot(d.trangThai)} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <RowActions>
                          <RowActionButton
                            icon={dangDem ? Play : Eye}
                            label={dangDem ? "Tiếp tục đếm" : "Xem chi tiết"}
                            onClick={() => moDot(d)}
                          />
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </TableShell>
    </PageContainer>
  );
}
