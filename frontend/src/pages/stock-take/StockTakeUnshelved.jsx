// src/pages/stock-take/StockTakeUnshelved.jsx
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CircleCheck, PackageOpen, Search } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { boDau, docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { docSoDem } from "@/components/kiem-ke/kiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { layHangChuaCoKe, laySoDo, xepKe } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { setKhoLamViecId, getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/**
 * Hàng chưa có kệ (/stock-take/unshelved?khoId=) — Đ4: lô còn tồn ở kho mà sổ kệ chưa ghi đủ (tồn lô ở kho − Σ kệ). Kiểm
 * kê toàn kho / theo danh mục bị chặn khi còn hàng này trong phạm vi; xếp lên kệ ở đây rồi bắt đầu lại. Kệ gợi ý là kệ lô
 * đang nằm (nếu có).
 */
export default function StockTakeUnshelved() {
  const navigate = useNavigate();
  const kho = useKhoKiemKe();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const tai = useCallback(() => layHangChuaCoKe(kho.khoId), [kho.khoId]);
  const q = useTaiDuLieu(tai, `kk-chua-ke-${kho.khoId}`, { enabled: kho.khoId != null });
  const taiKe = useCallback(() => laySoDo(kho.khoId), [kho.khoId]);
  const [moHop, setMoHop] = useState(null);
  const qKe = useTaiDuLieu(taiKe, `kk-ke-xep-${kho.khoId}`, { enabled: kho.khoId != null && moHop != null });
  const [tim, setTim] = useState("");
  const ds = useMemo(() => {
    const tu = boDau(tim.trim()).toLowerCase();
    return (q.data ?? []).filter((h) => !tu || boDau(`${h.maLo} ${h.sanPham?.tenSanPham ?? ""} ${h.sanPham?.maSku ?? ""}`).toLowerCase().includes(tu));
  }, [q.data, tim]);
  const tongChua = (q.data ?? []).reduce((s, h) => s + docSo(h.chuaCoKe), 0);

  // Hộp xếp kệ
  const [keId, setKeId] = useState("");
  const [soLuong, setSoLuong] = useState(null);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState(null);
  const moXep = (h) => {
    setMoHop(h);
    setKeId(h.keGoiY?.id ? String(h.keGoiY.id) : "");
    setSoLuong(docSo(h.chuaCoKe));
    setLoi(null);
  };
  const dsKe = useMemo(
    () =>
      (qKe.data?.khuVuc ?? [])
        .flatMap((kv) => (kv.ke ?? []).map((k) => ({ ...k, khu: kv.ten || kv.ma })))
        .filter((k) => k.trangThai !== "BAO_TRI" && k.khoa !== "toan_ke")
        .sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi", { numeric: true })),
    [qKe.data],
  );
  const xep = async () => {
    if (!moHop) return;
    setLoi(null);
    setDangChay(true);
    try {
      if (!laQtv && getKhoLamViecId() !== kho.khoId) setKhoLamViecId(kho.khoId);
      await xepKe(kho.khoId, { loHangId: moHop.loHangId, viTriKhoId: Number(keId), soLuong });
      const ke = dsKe.find((k) => String(k.id) === String(keId));
      toast.success("Đã xếp lên kệ", { description: `${soVN(soLuong)} sản phẩm lô ${moHop.maLo} → kệ ${ke?.ma ?? ""}` });
      setMoHop(null);
      q.reload();
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa xếp được lên kệ"));
    } finally {
      setDangChay(false);
    }
  };
  const thieu = !keId ? "Chọn kệ" : !soLuong ? "Nhập số lượng" : moHop && soLuong > docSo(moHop.chuaCoKe) ? `Tối đa ${soVN(moHop.chuaCoKe)}` : null;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title="Hàng chưa có kệ"
        scope={kho.dsKho.find((k) => Number(k.id) === kho.khoId)?.tenKho}
        actions={
          <Button
            variant="outline"
            onClick={() => navigate("/stock-take")}
            className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <ArrowLeft className="size-4" />
            Đợt kiểm kê
          </Button>
        }
      />

      <TableShell
        fill
        toolbar={
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            {kho.dsKho.length > 1 ? (
              <label className="flex items-center gap-2 text-[13px] font-medium text-bo-foreground">
                Kho
                <select value={kho.khoId ?? ""} onChange={(e) => kho.doiKho(e.target.value)} className={cn(O_NHAP, "h-9 w-auto min-w-[180px]")}>
                  {kho.dsKho.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.tenKho}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="relative flex min-w-[220px] max-w-sm flex-1 items-center">
              <span className="sr-only">Tìm lô</span>
              <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
              <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mã lô, SKU, tên sản phẩm" className={cn(O_NHAP, "pl-8")} />
            </label>
            {q.data?.length ? (
              <span className="text-[13px] text-bo-muted tabular-nums lg:ml-auto">
                {soVN(q.data.length)} lô · <b className="font-semibold text-bo-foreground">{soVN(tongChua)}</b> sản phẩm chưa có kệ
              </span>
            ) : null}
          </div>
        }
      >
        {kho.dangTai || (q.loading && !q.data) ? (
          <LoadingState rows={5} label="Đang tải hàng chưa có kệ" />
        ) : q.error && !q.data ? (
          <ErrorState description={`Không tải được: ${getApiErrorMessage(q.error, "lỗi kết nối")}.`} onRetry={q.reload} />
        ) : !q.data?.length ? (
          <EmptyState
            icon={CircleCheck}
            title="Mọi hàng trong kho đã có kệ"
            description="Sổ kệ khớp tồn lô; có thể kiểm kê toàn kho hoặc theo danh mục."
          />
        ) : !ds.length ? (
          <EmptyState icon={Search} title={`Không có lô nào khớp “${tim.trim()}”`} />
        ) : (
          <>
          {/* Điện thoại: mỗi lô một thẻ, nút Xếp lên kệ trong tầm tay */}
          <ul className="divide-y divide-bo-border md:hidden">
            {ds.map((h) => (
              <li key={h.loHangId} className="grid gap-2 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <AnhBienThe src={h.sanPham?.anh} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
                    <span className="block truncate text-xs text-bo-muted">
                      <MauKichCo dong={h.sanPham} className="align-bottom" /> · lô <span className="font-mono">{h.maLo}</span>
                    </span>
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13px] tabular-nums text-bo-muted">
                    Tồn {soVN(h.tonLo)} · trên kệ {soVN(h.trenKe)} ·{" "}
                    <b className="font-semibold text-bo-warning">chưa có kệ {soVN(h.chuaCoKe)}</b>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => moXep(h)} className="h-8 shrink-0 gap-1.5 border-bo-border bg-bo-surface text-[13px] hover:bg-bo-surface-subtle">
                    <PackageOpen className="size-3.5" />
                    Xếp kệ
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <table className="w-full min-w-[760px] text-sm max-md:hidden">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} text-left`}>Sản phẩm</th>
                <th className={`${TH} text-left`}>Lô</th>
                <th className={`${TH} text-right`}>Tồn lô</th>
                <th className={`${TH} text-right`}>Trên kệ</th>
                <th className={`${TH} text-right`}>Chưa có kệ</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {ds.map((h) => (
                <tr key={h.loHangId} className="hover:bg-bo-surface-subtle">
                  <td className="px-4 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <AnhBienThe src={h.sanPham?.anh} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
                        <span className="block text-xs text-bo-muted">
                          <MauKichCo dong={h.sanPham} className="align-bottom" /> · <span className="font-mono">{h.sanPham?.maSku}</span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-slate-700">{h.maLo}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{soVN(h.tonLo)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-bo-muted">{soVN(h.trenKe)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-bo-warning">{soVN(h.chuaCoKe)}</td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => moXep(h)} className="h-8 gap-1.5 border-bo-border bg-bo-surface text-[13px] hover:bg-bo-surface-subtle">
                      <PackageOpen className="size-3.5" />
                      Xếp lên kệ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </TableShell>

      <HopXacNhanChungTu
        mo={Boolean(moHop)}
        onDoiMo={(m) => !m && !dangChay && setMoHop(null)}
        tieuDe={moHop ? `Xếp lô ${moHop.maLo} lên kệ` : ""}
        moTa={moHop ? `${moHop.sanPham?.tenSanPham ?? ""} · còn ${soVN(moHop.chuaCoKe)} sản phẩm chưa có kệ. Chỉ ghi sổ kệ, tồn kho không đổi.` : undefined}
        nhanXacNhan="Xếp lên kệ"
        iconXacNhan={PackageOpen}
        dangChay={dangChay}
        khoaXacNhan={Boolean(thieu)}
        lyDoKhoa={thieu ?? undefined}
        loi={loi}
        onXacNhan={xep}
      >
        <label className="grid gap-1.5">
          <span className={NHAN_O}>
            Kệ <span className="text-bo-danger">*</span>
          </span>
          <select value={keId} onChange={(e) => setKeId(e.target.value)} className={O_NHAP} disabled={qKe.loading && !qKe.data}>
            <option value="">{qKe.loading && !qKe.data ? "Đang tải kệ…" : "Chọn kệ…"}</option>
            {dsKe.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ma} · {k.khu}
                {k.sucChua ? ` · ${soVN(k.dangChua)}/${soVN(k.sucChua)}` : ""}
                {moHop?.keGoiY?.id === k.id ? " (lô đang ở kệ này)" : ""}
              </option>
            ))}
          </select>
          <span className={GOI_Y_O}>Kệ bảo trì và kệ đang khóa kiểm kê không chọn được</span>
        </label>
        <label className="grid gap-1.5">
          <span className={NHAN_O}>
            Số lượng <span className="text-bo-danger">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={soLuong == null ? "" : String(soLuong)}
            onChange={(e) => setSoLuong(docSoDem(e.target.value, 1_000_000) || null)}
            className={cn(O_NHAP, "max-w-[160px] tabular-nums")}
          />
        </label>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
