import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, ClipboardList, Download, Eye, Loader2, Plus, SearchX, Settings } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { HopHuyLo } from "@/components/ke-toan/HopKeToan";
import { NHAN_LO, homQuaIso, kyChungTu, loCoTheHuy, locDanhSachLo } from "@/components/ke-toan/tinhKeToan";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { toast } from "@/lib/thongBaoNhanh";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { t } from "@/i18n";

const TH = "h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const TD = "px-4 py-3 align-middle";
const NUT_PHU = "gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle";
const tien = (v) => (Number(v) ? formatCurrency(v) : "—");

/**
 * Xuất dữ liệu kế toán sang AMIS Kế toán doanh nghiệp: danh sách lô đã tạo (như các trang danh sách chứng từ).
 * Tạo lô ở trang riêng (/reports/accounting-export/new), xem lô ở /reports/accounting-export/:id. Chỉ quản trị viên.
 */
export default function XuatDuLieuKeToan() {
  const navigate = useNavigate();
  const [dsLo, setDsLo] = useState(null);
  const [loi, setLoi] = useState(null);
  const [lanTai, setLanTai] = useState(0);
  const [tab, setTab] = useState("tat_ca");
  const [tim, setTim] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(SO_DONG_MAC_DINH);
  const [dangTai, setDangTai] = useState(null);
  const [huyLo, setHuyLo] = useState(null);
  // Số chứng từ chưa giao kế toán đến hết hôm qua (kiểm tra chỉ đọc, chạy nền); null = chưa biết hoặc lỗi
  const [choXuat, setChoXuat] = useState(null);
  const lanDemRef = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    keToanService
      .danhSachLo({ signal: ctrl.signal })
      .then((ds) => {
        setDsLo(ds);
        setLoi(null);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setLoi(e);
      });
    return () => ctrl.abort();
  }, [lanTai]);

  const demChoXuat = useCallback(() => {
    const lan = ++lanDemRef.current;
    keToanService
      .xemTruoc(homQuaIso())
      .then((kq) => {
        if (lan !== lanDemRef.current) return;
        const so = (kq?.tongHop ?? []).reduce((s, d) => s + (d.soChungTu || 0), 0);
        setChoXuat(kq?.coTheTaoLo ? so : 0);
      })
      .catch(() => lan === lanDemRef.current && setChoXuat(null));
  }, []);

  useEffect(() => {
    queueMicrotask(demChoXuat);
  }, [demChoXuat]);

  const taiLai = () => {
    setDsLo(null);
    setLanTai((k) => k + 1);
  };

  const taiTep = async (lo) => {
    setDangTai(lo.id);
    try {
      await keToanService.taiTep(lo);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Không tải được tệp của lô")));
    } finally {
      setDangTai(null);
    }
  };

  const loHuyDuoc = dsLo ? loCoTheHuy(dsLo) : null;
  const dem = useMemo(() => ({
    tat_ca: dsLo?.length ?? null,
    hieu_luc: dsLo ? dsLo.filter((l) => l.trangThai !== "da_huy").length : null,
    da_huy: dsLo ? dsLo.filter((l) => l.trangThai === "da_huy").length : null,
  }), [dsLo]);
  const tabs = [
    { value: "tat_ca", label: t("Tất cả"), count: dem.tat_ca },
    { value: "hieu_luc", label: t("Đã giao kế toán"), count: dem.hieu_luc },
    { value: "da_huy", label: t("Đã hủy"), count: dem.da_huy },
  ];
  const locRa = useMemo(() => locDanhSachLo(dsLo ?? [], tab, tim), [dsLo, tab, tim]);
  const trang = locRa.slice(page * size, page * size + size);
  const dangLoc = Boolean(tim.trim());

  const doiTab = (v) => {
    setTab(v);
    setPage(0);
  };

  const thaoTac = (lo) => (
    <RowActions>
      <RowActionButton icon={Eye} label={t("Xem lô {{soLo}}", { soLo: lo.soLo })} onClick={() => navigate(`/reports/accounting-export/${lo.id}`)} />
      <RowActionButton icon={dangTai === lo.id ? Loader2 : Download} label={t("Tải tệp của lô {{soLo}}", { soLo: lo.soLo })}
        disabled={dangTai === lo.id} onClick={() => taiTep(lo)} className={dangTai === lo.id ? "[&_svg]:animate-spin" : undefined} />
      {loHuyDuoc?.id === lo.id ? (
        <RowActionButton icon={Ban} tone="danger" label={t("Hủy lô {{soLo}}", { soLo: lo.soLo })} onClick={() => setHuyLo(lo)} />
      ) : (
        <span className="size-8 shrink-0" aria-hidden="true" />
      )}
    </RowActions>
  );

  let noiDung;
  if (loi) {
    noiDung = <ErrorState description={getApiErrorMessage(loi, t("Không tải được danh sách lô"))} error={loi} onRetry={taiLai} />;
  } else if (dsLo === null) {
    noiDung = <LoadingState className="min-h-64" label={t("Đang tải danh sách lô")} />;
  } else if (trang.length === 0) {
    noiDung = dangLoc ? (
      <EmptyState icon={SearchX} title={t("Không tìm thấy lô phù hợp")} description={t("Thử đổi số lô hoặc ghi chú cần tìm.")}
        action={<Button variant="outline" onClick={() => setTim("")} className={NUT_PHU}>{t("Xóa lọc")}</Button>} />
    ) : tab !== "tat_ca" ? (
      <EmptyState icon={ClipboardList} title={t("Không có lô nào ở trạng thái này")} description={t("Chọn tab Tất cả để xem mọi lô.")}
        action={<Button variant="outline" onClick={() => doiTab("tat_ca")} className={NUT_PHU}>{t("Xem tất cả")}</Button>} />
    ) : (
      <EmptyState icon={ClipboardList} title={t("Chưa có lô nào")}
        description={t("Mỗi lô gom chứng từ chưa giao kế toán thành một tệp nén để nhập vào AMIS.")}
        action={
          <Button asChild className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
            <Link to="/reports/accounting-export/new"><Plus className="size-4" aria-hidden="true" />{t("Tạo lô xuất")}</Link>
          </Button>
        } />
    );
  } else {
    noiDung = (
      <>
        {/* Điện thoại: mỗi lô một thẻ */}
        <ul className="divide-y divide-bo-border md:hidden">
          {trang.map((lo) => (
            <li key={lo.id} className="flex items-start gap-3 px-4 py-3">
              <Link to={`/reports/accounting-export/${lo.id}`} className="grid min-w-0 flex-1 gap-1 active:bg-bo-surface-subtle">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-bo-primary">{lo.soLo}</span>
                  <StatusBadge label={NHAN_LO[lo.trangThai] ?? lo.trangThai} />
                </span>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-bo-foreground">{kyChungTu(lo.tuNgay, lo.denNgay)}</span>
                  <span className="shrink-0 tabular-nums text-bo-foreground">{tien(lo.tongCong)}</span>
                </span>
                <span className="truncate text-[13px] text-bo-muted">
                  {t("{{count}} chứng từ", { count: Number(lo.soChungTu) || 0 })} · {formatDateTime(lo.ngayTao)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <table className="w-full min-w-[980px] text-sm max-md:hidden">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-bo-border">
              <th className={`${TH} w-14 text-center`}>{t("STT")}</th>
              <th className={TH}>{t("Số lô", { context: "ke_toan" })}</th>
              <th className={TH}>{t("Kỳ chứng từ")}</th>
              <th className={`${TH} text-right`}>{t("Chứng từ")}</th>
              <th className={`${TH} text-right`}>{t("Tiền khách trả")}</th>
              <th className={TH}>{t("Người tạo")}</th>
              <th className={TH}>{t("Ngày tạo")}</th>
              <th className={TH}>{t("Trạng thái")}</th>
              <th className={`${TH} text-center`}>{t("Thao tác")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {trang.map((lo, i) => (
              <tr key={lo.id} onClick={() => navigate(`/reports/accounting-export/${lo.id}`)} className="cursor-pointer transition-colors hover:bg-bo-surface-subtle">
                <td className={`${TD} w-14 text-center`}>
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-bo-surface-subtle text-xs font-semibold text-bo-muted">{page * size + i + 1}</span>
                </td>
                <td className={TD}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="whitespace-nowrap font-semibold text-bo-primary">{lo.soLo}</span>
                    {lo.coTonDauKy ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-600">{t("Có tồn đầu kỳ")}</span>
                    ) : null}
                  </span>
                  {lo.ghiChu ? <span className="mt-0.5 block max-w-[260px] truncate text-xs text-bo-muted" title={lo.ghiChu}>{lo.ghiChu}</span> : null}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>{kyChungTu(lo.tuNgay, lo.denNgay)}</td>
                <td className={`${TD} text-right tabular-nums`}>{lo.soChungTu}</td>
                <td className={`${TD} text-right tabular-nums`}>{tien(lo.tongCong)}</td>
                <td className={`${TD} whitespace-nowrap`}>{lo.nguoiTao || "—"}</td>
                <td className={`${TD} whitespace-nowrap text-xs text-bo-muted tabular-nums`}>{formatDateTime(lo.ngayTao)}</td>
                <td className={TD}><StatusBadge label={NHAN_LO[lo.trangThai] ?? lo.trangThai} /></td>
                <td className={TD}>{thaoTac(lo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          <>
            <Button asChild variant="outline" className={NUT_PHU}>
              <Link to="/settings/accounting"><Settings className="size-4" aria-hidden="true" />{t("Thiết lập")}</Link>
            </Button>
            <Button asChild className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
              <Link to="/reports/accounting-export/new"><Plus className="size-4" aria-hidden="true" />{t("Tạo lô xuất")}</Link>
            </Button>
          </>
        }
      />

      <AttentionBar count={choXuat} tone="info" actionLabel={t("Tạo lô xuất")} onAction={() => navigate("/reports/accounting-export/new")}>
        <strong className="font-semibold">{t("{{count}} chứng từ", { count: Number(choXuat) || 0 })}</strong> {t("chưa giao kế toán, tính đến hết hôm qua.")}
      </AttentionBar>

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={<StatusTabs label={t("Lọc lô theo trạng thái")} tabs={tabs} value={tab} onChange={doiTab} />}
            hasFilter={dangLoc}
            onClear={() => setTim("")}
          >
            <SearchInput label={t("Tìm lô")} placeholder={t("Tìm số lô, ghi chú...")} value={tim}
              onChange={(e) => { setTim(e.target.value); setPage(0); }} onClear={() => setTim("")} />
          </ListToolbar>
        }
        footer={
          locRa.length > 0 ? (
            <TablePagination page={page} size={size} total={locRa.length} onPageChange={setPage}
              onSizeChange={(s) => { setSize(s); setPage(0); }} />
          ) : null
        }
      >
        {noiDung}
      </TableShell>

      {huyLo ? (
        <HopHuyLo
          lo={huyLo}
          onDong={() => setHuyLo(null)}
          onLoiXungDot={taiLai}
          onXong={(kq) => {
            setDsLo((cu) => (cu ? cu.map((l) => (l.id === kq.id ? kq : l)) : cu));
            setHuyLo(null);
            demChoXuat();
          }}
        />
      ) : null}
    </PageContainer>
  );
}
