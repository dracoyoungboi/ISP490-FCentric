// src/pages/bin-move/BinMoveHistory.jsx
import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, MoveRight, Warehouse } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import SearchInput from "@/components/shared/SearchInput";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { ChamNhan } from "@/components/chuyen-ke/KeHienThi";
import { hienGhiChu } from "@/components/chuyen-ke/nhanKe";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { layLichSuChuyenKe } from "@/services/chuyenKeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";
import { t, tDuLieu } from "@/i18n";

const TH = "h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const TD = "px-3 py-3 align-middle text-sm text-bo-foreground";

// Lọc nhanh theo ngày thực hiện: số ngày tính cả hôm nay (null = tất cả)
const KHOANG = [
  { ma: "hom-nay", nhan: t("Hôm nay"), ngay: 1 },
  { ma: "7-ngay", nhan: t("7 ngày"), ngay: 7 },
  { ma: "30-ngay", nhan: t("30 ngày"), ngay: 30 },
  { ma: "tat-ca", nhan: t("Tất cả"), ngay: null },
];

/** Ngày bắt đầu (yyyy-mm-dd theo giờ máy) của khoảng `ngay` ngày tính cả hôm nay. */
function tuNgayCua(ngay) {
  if (!ngay) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - (ngay - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "A-01-02, A-01-03" — tối đa 3 mã, còn lại "+n". */
function dsMa(ds) {
  const a = ds ?? [];
  return a.slice(0, 3).join(", ") + (a.length > 3 ? ` +${a.length - 3}` : "");
}

/**
 * Lịch sử chuyển kệ (/warehouse/bin-moves/history?khoId=&tim=): các phiếu MV của kho, mới nhất trước, để quản lý kho thẩm
 * định (BA "Secondary Actor"). Bấm một dòng để xem từng dòng dịch chuyển [SKU – lô – kệ nguồn → kệ đích – số lượng].
 */
export default function BinMoveHistory() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kho = useKhoKiemKe();
  const khoId = kho.khoId;
  const [tim, setTim] = useState(params.get("tim") ?? "");
  const [timGui, setTimGui] = useState(tim.trim());
  const [trang, setTrang] = useState(0);
  const [kichThuoc, setKichThuoc] = useState(20);
  const [mo, setMo] = useState(() => new Set());
  const [khoang, setKhoang] = useState("tat-ca");
  const tuNgay = tuNgayCua(KHOANG.find((k) => k.ma === khoang)?.ngay);

  // Gõ tìm: chờ 300ms mới gọi máy chủ
  useEffect(() => {
    const id = setTimeout(() => {
      setTimGui(tim.trim());
      setTrang(0);
    }, 300);
    return () => clearTimeout(id);
  }, [tim]);

  const tai = useCallback(() => layLichSuChuyenKe(khoId, { tim: timGui, tuNgay, trang, kichThuoc }), [khoId, timGui, tuNgay, trang, kichThuoc]);
  const q = useTaiDuLieu(tai, `chuyen-ke-lich-su-${khoId}-${timGui}-${tuNgay ?? ""}-${trang}-${kichThuoc}`, { enabled: khoId != null });
  const duLieu = q.dungKhoa ? q.data : undefined;
  const ds = duLieu?.ds ?? [];

  // Mở từ "Xem phiếu" (?tim=mã phiếu): tìm đúng một phiếu thì mở sẵn chi tiết
  const timUrl = params.get("tim");
  const phieuDuyNhat = ds.length === 1 && timUrl && ds[0].maPhieu === timUrl ? ds[0].id : null;
  const [daDongMoSan, setDaDongMoSan] = useState(false);
  const dangMoPhieu = (id) => mo.has(id) || (id === phieuDuyNhat && !daDongMoSan);

  /** Bỏ ?tim= trên URL (liên kết "Xem phiếu"): sửa / xóa ô tìm thì F5 không lọc lại theo mã cũ. */
  const boTimTrenUrl = () => {
    if (!params.get("tim")) return;
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.delete("tim");
        return moi;
      },
      { replace: true },
    );
  };

  const doiKho = (id) => {
    setTrang(0);
    setMo(new Set());
    kho.doiKho(id);
  };
  const batTat = (id) => {
    if (id === phieuDuyNhat && !daDongMoSan) {
      setDaDongMoSan(true);
      return;
    }
    setMo((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  };

  const khongCoKho = !kho.dangTai && !kho.loi && kho.dsKho.length === 0;

  const bang = q.error ? (
    <ErrorState title={t("Không tải được lịch sử chuyển kệ")} description={getApiErrorMessage(q.error, t("Lỗi kết nối"))} onRetry={q.reload} />
  ) : duLieu === undefined ? (
    <LoadingState />
  ) : ds.length === 0 ? (
    <EmptyState
      icon={MoveRight}
      title={timGui || tuNgay ? t("Không có phiếu nào khớp") : t("Chưa có phiếu chuyển kệ")}
      description={timGui || tuNgay ? t("Thử mã phiếu, mã kệ, SKU, mã lô khác hoặc chọn Tất cả.") : t("Phiếu được ghi mỗi lần xác nhận chuyển hàng giữa các kệ.")}
    />
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 z-[1] bg-bo-surface-subtle">
          <tr className="border-b border-bo-border">
            <th className={cn(TH, "w-10")} aria-label={t("Mở chi tiết")} />
            <th className={TH}>{t("Mã phiếu chuyển kệ")}</th>
            <th className={TH}>{t("Thời gian")}</th>
            <th className={TH}>{t("Người thực hiện")}</th>
            <th className={TH}>{t("Kệ nguồn → kệ đích")}</th>
            <th className={cn(TH, "text-right")}>{t("Số lượng")}</th>
            <th className={TH}>{t("Ghi chú")}</th>
          </tr>
        </thead>
        <tbody>
          {ds.map((p) => {
            const dangMo = dangMoPhieu(p.id);
            return (
              <Fragment key={p.id}>
                <tr className={cn("cursor-pointer border-b border-bo-border", dangMo ? "bg-[#f3f7fe]" : "hover:bg-bo-surface-subtle")} onClick={() => batTat(p.id)}>
                  <td className={TD}>
                    <button
                      type="button"
                      aria-expanded={dangMo}
                      aria-label={dangMo ? t("Thu gọn phiếu {{ma}}", { ma: p.maPhieu }) : t("Xem dòng của phiếu {{ma}}", { ma: p.maPhieu })}
                      onClick={(e) => {
                        e.stopPropagation();
                        batTat(p.id);
                      }}
                      className="grid size-7 place-items-center rounded-md text-bo-muted hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                    >
                      <ChevronDown className={cn("size-4 transition-transform", dangMo && "rotate-180")} aria-hidden="true" />
                    </button>
                  </td>
                  <td className={TD}>
                    <span className="font-mono text-sm font-semibold text-bo-primary-strong">{p.maPhieu}</span>
                    {p.vuotSucChua ? <ChamNhan tone="bad" className="ml-2">{t("Vượt sức chứa")}</ChamNhan> : null}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatDateTime(p.ngayThucHien)}</td>
                  <td className={TD}>{p.nguoiThucHien ? tDuLieu(p.nguoiThucHien) : "—"}</td>
                  <td className={cn(TD, "font-mono text-[13px]")}>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {dsMa(p.keNguon)}
                      <ArrowRight className="size-3.5 text-bo-muted" aria-hidden="true" />
                      {dsMa(p.keDich)}
                    </span>
                  </td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{soVN(p.tongSoLuong)}</td>
                  <td className={cn(TD, "max-w-[240px] truncate text-bo-muted")} title={p.ghiChu ? hienGhiChu(p.ghiChu) : undefined}>
                    {p.ghiChu ? hienGhiChu(p.ghiChu) : "—"}
                  </td>
                </tr>
                {dangMo ? (
                  <tr className="border-b border-bo-border bg-[#f3f7fe]">
                    <td />
                    <td colSpan={6} className="px-3 pb-3">
                      <table className="w-full border-collapse overflow-hidden rounded-md border border-bo-border bg-white text-[13px]">
                        <thead>
                          <tr className="border-b border-bo-border">
                            <th className={TH}>{t("Sản phẩm")}</th>
                            <th className={TH}>{t("SKU")}</th>
                            <th className={TH}>{t("Lô")}</th>
                            <th className={TH}>{t("Kệ nguồn")}</th>
                            <th className={TH}>{t("Kệ đích")}</th>
                            <th className={cn(TH, "text-right")}>{t("Số lượng")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                          {p.dong.map((d) => (
                            <tr key={d.id}>
                              <td className="px-3 py-2">
                                <span className="font-medium">{d.tenSanPham ? tDuLieu(d.tenSanPham) : "—"}</span>
                                <MauKichCo tenMau={d.mau} maMauHex={d.maMauHex} kichCo={d.kichCo} className="mt-0.5 flex" />
                              </td>
                              <td className="px-3 py-2 font-mono">{d.maSku}</td>
                              <td className="px-3 py-2 font-mono">{d.maLo}</td>
                              <td className="px-3 py-2 font-mono">{d.keNguon}</td>
                              <td className="px-3 py-2 font-mono">{d.keDich}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{soVN(d.soLuong)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <PageContainer fill className="gap-4">
      <ListPageHeader
        title={t("Lịch sử chuyển kệ")}
        actions={
          <Button onClick={() => navigate(`/warehouse/bin-moves${khoId ? `?khoId=${khoId}` : ""}`)} className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
            <MoveRight className="size-4" />
            {t("Chuyển hàng giữa kệ")}
          </Button>
        }
      />
      {kho.loi ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState title={t("Không tải được danh sách kho")} description={getApiErrorMessage(kho.loi, t("Lỗi kết nối"))} onRetry={kho.taiLai} />
        </div>
      ) : khongCoKho ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <EmptyState icon={Warehouse} title={t("Bạn chưa được phân kho nào")} description={t("Nhờ quản trị viên phân kho để xem lịch sử chuyển kệ.")} />
        </div>
      ) : (
        <TableShell
          fill
          toolbar={
            <div className="flex flex-wrap items-center gap-3 border-b border-bo-border px-4 py-3">
              {kho.dsKho.length > 1 ? <ChonKhoKiemKe dsKho={kho.dsKho} value={khoId} onChange={doiKho} className="w-full sm:w-[240px]" /> : null}
              <SearchInput
                value={tim}
                onChange={(e) => {
                  setTim(e.target.value);
                  boTimTrenUrl();
                }}
                onClear={() => {
                  setTim("");
                  boTimTrenUrl();
                }}
                placeholder={t("Tìm mã phiếu, mã kệ, SKU, mã lô")}
                label={t("Tìm phiếu chuyển kệ")}
              />
              <div className="flex rounded-md border border-bo-border p-0.5 text-[13px]" role="group" aria-label={t("Thời gian thực hiện")}>
                {KHOANG.map((k) => (
                  <button
                    key={k.ma}
                    type="button"
                    aria-pressed={khoang === k.ma}
                    onClick={() => {
                      setKhoang(k.ma);
                      setTrang(0);
                    }}
                    className={cn("h-7 rounded px-2.5", khoang === k.ma ? "bg-bo-primary-soft font-medium text-bo-primary-strong" : "text-slate-600 hover:bg-slate-50")}
                  >
                    {k.nhan}
                  </button>
                ))}
              </div>
            </div>
          }
          footer={
            ds.length ? (
              <TablePagination
                page={trang}
                size={kichThuoc}
                total={duLieu?.tong ?? 0}
                onPageChange={setTrang}
                onSizeChange={(s) => {
                  setKichThuoc(s);
                  setTrang(0);
                }}
                totalLabel={t("phiếu chuyển kệ")}
              />
            ) : null
          }
        >
          {bang}
        </TableShell>
      )}
    </PageContainer>
  );
}
