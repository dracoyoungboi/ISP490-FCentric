import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { thanhToanService } from "@/services/thanhToanService";
import { toast } from "@/lib/thongBaoNhanh";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";

const TOI_DA_DOI_CHIEU = 200;
/** Màu hai cách thu (cùng sắc xanh hệ thống, khác độ đậm để phân biệt được cả khi không thấy màu). */
const MAU_TIEN_MAT = "#0b4fb3";
const MAU_CHUYEN_KHOAN = "#69b1ff";

/**
 * Phiếu chuyển khoản chưa đối chiếu sao kê (quản trị viên): tích các phiếu đã thấy tiền trên sao kê rồi đánh dấu. Không
 * thấy tiền thì mở đơn, hủy phiếu ở đó. khoId: cửa hàng đang lọc (trống = mọi cửa hàng).
 */
function HopDoiChieu({ khoId, onClose, onXong }) {
  const [trang, setTrang] = useState(null); // { ds, tong }
  const [loi, setLoi] = useState("");
  const [chon, setChon] = useState(() => new Set());
  const [dang, setDang] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    thanhToanService.choDoiChieu({ khoId, size: TOI_DA_DOI_CHIEU }, { signal: ctrl.signal })
      .then((page) => setTrang({ ds: page?.content ?? [], tong: Number(page?.totalElements) || 0 }))
      .catch((e) => { if (!ctrl.signal.aborted) setLoi(e?.response?.data?.message || "Không tải được danh sách phiếu."); });
    return () => ctrl.abort();
  }, [khoId]);
  const ds = trang?.ds;
  const doi = (id) => setChon((cu) => {
    const moi = new Set(cu);
    if (moi.has(id)) moi.delete(id); else moi.add(id);
    return moi;
  });
  const gui = async () => {
    if (!chon.size || dang) return;
    setDang(true);
    setLoi("");
    try {
      const so = await thanhToanService.doiChieu([...chon]);
      toast.success(`Đã đánh dấu đối chiếu ${formatNumber(so ?? chon.size)} phiếu.`);
      onXong();
    } catch (e) {
      setLoi(e?.response?.data?.message || "Không đánh dấu được. Thử lại.");
      setDang(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !dang) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Đối chiếu chuyển khoản</DialogTitle>
          <DialogDescription>
            Tích các phiếu đã thấy tiền trên sao kê ngân hàng. Không thấy tiền thì mở đơn và hủy phiếu ở đó.
          </DialogDescription>
        </DialogHeader>
        {trang === null && !loi ? <p className="text-sm text-bo-muted">Đang tải…</p> : null}
        {ds?.length === 0 ? <p className="text-sm text-bo-muted">Không còn phiếu nào chờ đối chiếu.</p> : null}
        {ds?.length ? (
          <ul className="m-0 list-none divide-y divide-bo-border rounded-md border border-bo-border p-0 text-sm">
            {ds.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-bo-surface-subtle">
                  <input checked={chon.has(p.id)} className="mt-1 size-4 shrink-0 accent-bo-primary" onChange={() => doi(p.id)} type="checkbox" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-bo-foreground">{p.maThamChieu}</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatCurrency(p.soTien)}</span>
                    </span>
                    <span className="block text-xs text-bo-muted">
                      {formatDate(p.thoiDiemThu)} · <Link className="text-bo-primary hover:underline" onClick={(e) => e.stopPropagation()} to={`/sales-orders/${p.donBanHangId}`}>{p.soDonHang || "Mở đơn"}</Link>
                      {p.tenNguoiThu ? ` · ${p.tenNguoiThu} ghi` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        {trang && trang.tong > (ds?.length ?? 0) ? (
          <p className="text-xs text-bo-muted">Đang hiện {formatNumber(ds.length)} phiếu cũ nhất trên tổng {formatNumber(trang.tong)}. Đánh dấu xong mở lại để xem tiếp.</p>
        ) : null}
        {loi ? <p className="text-xs text-red-600" role="alert">{loi}</p> : null}
        <DialogFooter>
          <Button className="border-bo-border bg-bo-surface" disabled={dang} onClick={onClose} variant="outline">Đóng</Button>
          <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dang || !chon.size} onClick={gui}>
            {dang ? "Đang lưu…" : `Đã thấy trên sao kê${chon.size ? ` (${chon.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Dong({ mau, ten, phu, so, am = false }) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 border-b border-[#eef1f5] py-2.5 last:border-b-0">
      {mau ? <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: mau }} /> : <span />}
      <dt className="font-medium text-bo-foreground">{ten}</dt>
      <dd className={`m-0 font-semibold tabular-nums ${am ? "text-bo-danger" : "text-bo-foreground"}`}>{so}</dd>
      {phu ? <><span /><span className="col-span-2 text-xs text-bo-muted">{phu}</span></> : null}
    </div>
  );
}

const trieu = (v) => `${(Number(v) / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;

/**
 * Thẻ "Tiền thu trong kỳ" của Báo cáo doanh thu (máy chủ: /admin/dashboard/bao-cao/tien-thu): tiền mặt, chuyển khoản,
 * hoàn, sàn thu hộ và còn phải thu tới hôm nay. Tính theo ngày thu tiền nên khác doanh thu (theo ngày giao hàng) là bình
 * thường. Tải riêng: lỗi ở đây không chặn phần doanh thu.
 */
export default function KhoiTienThu({ tienThu, loi, loading, khoId, onTaiLai, className }) {
  const [moDoiChieu, setMoDoiChieu] = useState(false);
  const t = tienThu;
  const tm = Number(t?.tienMat) || 0;
  const ck = Number(t?.chuyenKhoan) || 0;
  const tong = tm + ck;
  const phanTm = tong > 0 ? Math.round((tm / tong) * 100) : 0;
  const chuaDoiChieu = Number(t?.chuaDoiChieu) || 0;
  const conPhaiThu = Number(t?.conPhaiThu) || 0;
  return (
    <Card
      bodyClassName="px-5 py-4 @max-[520px]:px-4"
      className={className}
      error={Boolean(loi)}
      loading={loading && !t}
      onRetry={onTaiLai}
      scope="theo ngày thu"
      title="Tiền thu trong kỳ"
    >
      {t ? (
        <div className="flex flex-col gap-3.5 text-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-xs text-bo-muted">
              <span>Đã thu {formatCurrency(tong)}</span>
              {tong > 0 ? <span>{phanTm}% tiền mặt</span> : null}
            </div>
            <div aria-hidden="true" className="flex h-2 overflow-hidden rounded bg-[#eef1f5]">
              <div style={{ width: `${phanTm}%`, background: MAU_TIEN_MAT }} />
              <div style={{ width: `${tong > 0 ? 100 - phanTm : 0}%`, background: MAU_CHUYEN_KHOAN }} />
            </div>
          </div>
          <dl className="m-0 flex flex-col">
            <Dong mau={MAU_TIEN_MAT} phu={`Tại quầy ${trieu(t.tienMatTaiQuay)} · đơn thường ${trieu(t.tienMatDonThuong)}`} so={formatCurrency(tm)} ten="Tiền mặt" />
            <Dong mau={MAU_CHUYEN_KHOAN} phu={`QR payOS ${trieu(t.qrPayos)} · ghi tay ${trieu(t.chuyenKhoanGhiTay)}`} so={formatCurrency(ck)} ten="Chuyển khoản" />
            <Dong am={Number(t.hoan) > 0} phu={`${formatNumber(t.soPhieuHoan)} phiếu hoàn`} so={Number(t.hoan) > 0 ? `−${formatCurrency(t.hoan)}` : formatCurrency(0)} ten="Hoàn tiền" />
            <Dong phu={`${formatNumber(t.soDonSan)} đơn sàn đã giao · đối soát với sàn`} so={formatCurrency(t.sanThuHo)} ten="Sàn thu hộ" />
          </dl>
          <div className={`flex flex-col gap-0.5 rounded-lg border px-3.5 py-3 ${conPhaiThu > 0 ? "border-orange-200 bg-bo-warning-soft" : "border-bo-border bg-bo-surface-subtle"}`}>
            <span className={`text-xs ${conPhaiThu > 0 ? "text-orange-800" : "text-bo-muted"}`}>Còn phải thu tới hôm nay</span>
            <span className={`text-xl font-bold leading-7 tabular-nums ${conPhaiThu > 0 ? "text-orange-800" : "text-bo-foreground"}`}>{formatCurrency(conPhaiThu)}</span>
            <span className={`text-xs ${conPhaiThu > 0 ? "text-orange-900" : "text-bo-muted"}`}>
              {formatNumber(t.soDonConPhaiThu)} đơn chưa thu đủ
              {Number(t.soDonConPhaiThu) > 0 ? (
                <> · <Link className="font-semibold text-orange-800 hover:underline" to="/sales-orders?thanhToan=con_phai_thu">Xem đơn ›</Link></>
              ) : null}
            </span>
          </div>
          {chuaDoiChieu > 0 ? (
            <button className="self-start text-[13px] font-medium text-bo-primary hover:underline" onClick={() => setMoDoiChieu(true)} type="button">
              {formatNumber(chuaDoiChieu)} phiếu chuyển khoản chưa đối chiếu ›
            </button>
          ) : null}
          {t.theoKhoPhuTrach ? <p className="m-0 text-xs text-bo-muted">Chỉ tính các cửa hàng bạn phụ trách.</p> : null}
        </div>
      ) : null}
      {moDoiChieu ? (
        <HopDoiChieu khoId={khoId} onClose={() => setMoDoiChieu(false)} onXong={() => { setMoDoiChieu(false); onTaiLai(); }} />
      ) : null}
    </Card>
  );
}
