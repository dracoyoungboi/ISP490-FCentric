import { useMemo, useRef, useState } from "react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";
import { Loader2, Printer } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { Truong } from "./KhungHop";
import { NUT_CHINH, NUT_PHU, O_NHAP, dinhDangSo, soSanhViTri } from "./kieuNhap";

// Tem kệ khổ A4, ba cột 60 mm; chỉ áp cho tài liệu in tem, không đổi CSS in phiếu của hệ thống.
const KIEU_TRANG_IN = `
  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    .tem-ke-to { display: grid !important; grid-template-columns: repeat(3, 60mm) !important; gap: 4mm !important; padding: 0 !important; background: #fff !important; }
    .tem-ke { width: 60mm !important; box-sizing: border-box !important; padding: 3mm !important; border: 0.2mm solid #999 !important; border-radius: 0 !important; box-shadow: none !important; break-inside: avoid !important; page-break-inside: avoid !important; }
    .tem-ke * { color: #000 !important; }
    .tem-ke svg { display: block !important; max-width: 100% !important; height: auto !important; margin: 0 auto !important; }
  }
`;

// CODE128 chỉ nhận ký tự ASCII in được
const maInDuoc = (ma) => /^[\x20-\x7E]+$/.test(String(ma ?? ""));

/**
 * In tem dán kệ: mỗi vị trí một tem có mã vạch của mã vị trí, để màn kiểm đếm quét chọn kệ khi khóa lô.
 * Chọn in cả kho hoặc một khu vực; `dsChon` (tùy chọn) là các vị trí đã chọn ở danh sách — khi có thì in đúng các vị trí đó.
 */
export default function HopInMaKe({ open, onOpenChange, khuVucs, viTris, khuMacDinh, dsChon }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung khuVucs={khuVucs} viTris={viTris} khuMacDinh={khuMacDinh} dsChon={dsChon} onDong={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ khuVucs, viTris, khuMacDinh, dsChon, onDong }) {
  const [pham, setPham] = useState(khuMacDinh ? String(khuMacDinh) : "tat-ca");
  const [dangIn, setDangIn] = useState(false);
  const toRef = useRef(null);
  const dangInRef = useRef(false);

  const tenKhu = useMemo(() => new Map(khuVucs.map((k) => [k.id, k.tenKhuVuc])), [khuVucs]);
  const ds = useMemo(
    () =>
      (dsChon?.length ? [...dsChon] : viTris.filter((v) => pham === "tat-ca" || String(v.khuVucId) === pham)).sort(soSanhViTri),
    [viTris, pham, dsChon],
  );
  const soLoi = ds.filter((v) => !maInDuoc(v.maViTri)).length;

  const xong = () => {
    dangInRef.current = false;
    setDangIn(false);
  };
  const inTem = useReactToPrint({
    contentRef: toRef,
    documentTitle: "FCentric - Tem vị trí kệ",
    pageStyle: KIEU_TRANG_IN,
    onAfterPrint: xong,
    onPrintError: () => {
      xong();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    },
  });
  const batDauIn = () => {
    if (!ds.length || soLoi || dangInRef.current) return;
    dangInRef.current = true;
    setDangIn(true);
    try {
      inTem();
    } catch {
      xong();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    }
  };

  return (
    <DialogContent showCloseButton={!dangIn} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[900px]">
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 text-left">
        <DialogTitle className="text-base text-bo-foreground">In tem vị trí kệ</DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          Dán tem lên đúng ô kệ. Khi khóa lô, nhân viên quét tem để chọn vị trí.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {dsChon?.length ? (
            <p className="text-sm font-medium text-bo-foreground">In tem cho {dinhDangSo(dsChon.length)} vị trí đã chọn</p>
          ) : (
            <Truong nhan="In cho" htmlFor="in-pham-vi" className="w-full sm:w-80">
              <select id="in-pham-vi" value={pham} onChange={(e) => setPham(e.target.value)} className={O_NHAP}>
                <option value="tat-ca">Tất cả khu vực</option>
                {khuVucs.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.tenKhuVuc} · {k.maKhuVuc}
                  </option>
                ))}
              </select>
            </Truong>
          )}
          <span className="pb-2 text-[13px] text-bo-muted">{dinhDangSo(ds.length)} tem · khổ A4, 3 tem mỗi hàng</span>
        </div>

        {soLoi ? (
          <DongThongBao tone="warn">{soLoi} vị trí có mã chứa ký tự không in được thành mã vạch. Sửa mã trước khi in.</DongThongBao>
        ) : null}

        <div className="rounded-lg bg-bo-surface-subtle p-3 sm:p-4">
          {ds.length ? (
            <div ref={toRef} className="tem-ke-to grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ds.map((v) => (
                <article key={v.id} className="tem-ke rounded-md border border-bo-border bg-white p-3 text-black">
                  <p className="text-center font-mono text-lg font-bold leading-6">{v.maViTri}</p>
                  {maInDuoc(v.maViTri) ? (
                    <div className="mt-1.5 flex justify-center" role="img" aria-label={`Mã vạch ${v.maViTri}`}>
                      <Barcode
                        value={String(v.maViTri)}
                        format="CODE128"
                        renderer="svg"
                        width={1.6}
                        height={48}
                        displayValue={false}
                        background="#ffffff"
                        lineColor="#000000"
                        margin={0}
                        className="block h-auto max-w-full"
                      />
                    </div>
                  ) : (
                    <p className="my-3 text-center text-sm text-bo-danger">Không in được mã vạch</p>
                  )}
                  <p className="mt-1.5 truncate text-center text-[11px] leading-4 text-slate-600">
                    {tenKhu.get(v.khuVucId) ?? "—"} · Dãy {v.day} · Hàng {v.hang} · Tầng {v.tang}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-bo-muted">Khu này chưa có vị trí kệ để in.</p>
          )}
        </div>
      </div>

      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        <Button type="button" variant="outline" onClick={onDong} disabled={dangIn} className={NUT_PHU}>
          Đóng
        </Button>
        <Button type="button" onClick={batDauIn} disabled={!ds.length || Boolean(soLoi) || dangIn} className={`gap-1.5 ${NUT_CHINH}`}>
          {dangIn ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
          {dangIn ? "Đang mở bản in…" : `In ${dinhDangSo(ds.length)} tem`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
