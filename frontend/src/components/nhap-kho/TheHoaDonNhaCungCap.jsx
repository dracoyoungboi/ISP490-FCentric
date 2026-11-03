import { useEffect, useId, useState } from "react";
import { FileText, Loader2, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  THUE_SUAT,
  formHoaDon,
  hienNgay,
  kiemTraHoaDon,
  ngayIso,
  payloadHoaDon,
} from "@/components/ke-toan/tinhKeToan";

const O_NHAP =
  "h-9 border-bo-border bg-white text-sm text-bo-foreground shadow-none focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15";
const O_LOI = "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";

function NhanTrangThai({ data }) {
  if (!data?.daNhap) {
    return <span className="rounded-[3px] bg-bo-warning-soft px-1.5 py-0.5 text-xs font-semibold text-bo-warning">Chưa nhập</span>;
  }
  return data.coHoaDon ? (
    <span className="rounded-[3px] bg-bo-success-soft px-1.5 py-0.5 text-xs font-semibold text-bo-success">Có hóa đơn GTGT</span>
  ) : (
    <span className="rounded-[3px] bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">Không có hóa đơn</span>
  );
}

function O({ id, nhan, loi, children, className }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-bo-muted">{nhan}</label>
      {children}
      {loi ? <p id={`${id}-loi`} role="alert" className="text-xs text-bo-danger">{loi}</p> : null}
    </div>
  );
}

/**
 * Hóa đơn của nhà cung cấp cho phiếu nhập mua hàng đã hoàn tất. Đơn giá đơn mua đã gồm thuế, nên khi xuất sang kế
 * toán thuế tách theo thuế suất trên hóa đơn này. Sửa được tới khi phiếu được xuất sang kế toán (máy chủ khóa).
 */
export default function TheHoaDonNhaCungCap({ phieuNhapKhoId, coTheSua }) {
  const idGoc = useId();
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(null);
  const [dangSua, setDangSua] = useState(false);
  const [form, setForm] = useState(() => formHoaDon(null));
  const [loi, setLoi] = useState({});
  const [dangLuu, setDangLuu] = useState(false);
  const [lanTai, setLanTai] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    keToanService
      .layHoaDonDauVao(phieuNhapKhoId, { signal: ctrl.signal })
      .then((d) => {
        setData(d);
        setLoiTai(null);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setLoiTai(getApiErrorMessage(e, "Không tải được hóa đơn nhà cung cấp"));
      })
      .finally(() => !ctrl.signal.aborted && setDangTai(false));
    return () => ctrl.abort();
  }, [phieuNhapKhoId, lanTai]);

  const batDauSua = () => {
    setForm(formHoaDon(data));
    setLoi({});
    setDangSua(true);
  };

  const doi = (ten, giaTri) => {
    setForm((f) => ({ ...f, [ten]: giaTri }));
    if (loi[ten]) setLoi((l) => ({ ...l, [ten]: undefined }));
  };

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuu) return;
    const loiMoi = kiemTraHoaDon(form, ngayIso(new Date()));
    setLoi(loiMoi);
    if (Object.keys(loiMoi).length) return;
    setDangLuu(true);
    try {
      const moi = await keToanService.luuHoaDonDauVao(phieuNhapKhoId, payloadHoaDon(form));
      setData(moi);
      setDangSua(false);
      toast.success("Đã lưu hóa đơn nhà cung cấp.");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không lưu được hóa đơn nhà cung cấp"));
      // Phiếu vừa được xuất sang kế toán (đã khóa): đóng form, tải lại để thấy trạng thái khóa
      if (e?.response?.status === 409) {
        setDangSua(false);
        setDangTai(true);
        setLanTai((k) => k + 1);
      }
    } finally {
      setDangLuu(false);
    }
  };

  const fid = (ten) => `${idGoc}-${ten}`;
  // Ô đang lỗi: đánh dấu và trỏ tới câu báo lỗi (id do O tạo: `${id}-loi`) cho trình đọc màn hình
  const moTaLoi = (ten, coLoi) => (coLoi ? { "aria-invalid": true, "aria-describedby": `${fid(ten)}-loi` } : {});
  const coHoaDon = form.coHoaDon === "co";

  return (
    <section aria-labelledby={fid("tieu-de")} className="rounded-lg border border-bo-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h2 id={fid("tieu-de")} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-bo-heading">
            <FileText className="size-4 text-bo-muted" aria-hidden="true" />
            Hóa đơn nhà cung cấp
            {!dangTai && !loiTai ? <NhanTrangThai data={data} /> : null}
          </h2>
          <p className="mt-0.5 text-xs text-bo-muted">
            Đơn giá đơn mua đã gồm thuế. Khi xuất sang kế toán, thuế tách theo thuế suất trên hóa đơn này.
          </p>
        </div>
        {!dangTai && !loiTai && !dangSua && coTheSua && !data?.daKhoa ? (
          <Button type="button" variant="outline" size="sm" onClick={batDauSua} className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
            <Pencil className="size-3.5" aria-hidden="true" />
            {data?.daNhap ? "Sửa" : "Nhập hóa đơn"}
          </Button>
        ) : null}
      </div>

      {dangTai ? (
        <p className="flex items-center gap-2 px-4 pb-4 text-sm text-bo-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang tải hóa đơn
        </p>
      ) : loiTai ? (
        <p className="px-4 pb-4 text-sm text-bo-danger">{loiTai}</p>
      ) : dangSua ? (
        <form onSubmit={luu} noValidate className="flex flex-col gap-3 px-4 pb-4">
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="sr-only">Nhà cung cấp có xuất hóa đơn GTGT không</legend>
            <label className="inline-flex items-center gap-2 text-sm text-bo-foreground">
              <input type="radio" name={fid("co")} value="co" checked={coHoaDon} onChange={() => doi("coHoaDon", "co")} className="accent-bo-primary" />
              Có hóa đơn GTGT
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-bo-foreground">
              <input type="radio" name={fid("co")} value="khong" checked={!coHoaDon} onChange={() => doi("coHoaDon", "khong")} className="accent-bo-primary" />
              Nhà cung cấp không xuất hóa đơn
            </label>
          </fieldset>
          {coHoaDon ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <O id={fid("mau-so")} nhan="Ký hiệu mẫu số" loi={loi.mauSo}>
                <Input id={fid("mau-so")} value={form.mauSo} maxLength={20} onChange={(e) => doi("mauSo", e.target.value)}
                  className={cn(O_NHAP, loi.mauSo && O_LOI)} {...moTaLoi("mau-so", loi.mauSo)} />
              </O>
              <O id={fid("ky-hieu")} nhan="Ký hiệu hóa đơn" loi={loi.kyHieu}>
                <Input id={fid("ky-hieu")} value={form.kyHieu} maxLength={20} placeholder="VD: C26TAA" spellCheck={false}
                  onChange={(e) => doi("kyHieu", e.target.value)} className={cn(O_NHAP, "uppercase", loi.kyHieu && O_LOI)}
                  {...moTaLoi("ky-hieu", loi.kyHieu)} />
              </O>
              <O id={fid("so")} nhan="Số hóa đơn" loi={loi.soHoaDon}>
                <Input id={fid("so")} value={form.soHoaDon} maxLength={20} inputMode="numeric"
                  onChange={(e) => doi("soHoaDon", e.target.value.replace(/\D/g, ""))} className={cn(O_NHAP, "tabular-nums", loi.soHoaDon && O_LOI)}
                  {...moTaLoi("so", loi.soHoaDon)} />
              </O>
              <O id={fid("ngay")} nhan="Ngày hóa đơn" loi={loi.ngayHoaDon}>
                <Input id={fid("ngay")} type="date" value={form.ngayHoaDon} max={ngayIso(new Date())}
                  onChange={(e) => doi("ngayHoaDon", e.target.value)} className={cn(O_NHAP, loi.ngayHoaDon && O_LOI)}
                  {...moTaLoi("ngay", loi.ngayHoaDon)} />
              </O>
              <O id={fid("thue")} nhan="Thuế suất" loi={loi.thueSuat}>
                <select id={fid("thue")} value={form.thueSuat} onChange={(e) => doi("thueSuat", e.target.value)}
                  className={cn(O_NHAP, "rounded-md border px-2", loi.thueSuat && O_LOI)}>
                  {THUE_SUAT.map((t) => <option key={t} value={String(t)}>{t}%</option>)}
                </select>
              </O>
            </div>
          ) : (
            <p className="text-xs text-bo-muted">Toàn bộ đơn giá là giá nhập, không có thuế đầu vào được khấu trừ.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDangSua(false)} disabled={dangLuu}
              className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
              Hủy
            </Button>
            <Button type="submit" disabled={dangLuu} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
              {dangLuu ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Lưu hóa đơn
            </Button>
          </div>
        </form>
      ) : (
        <div className="px-4 pb-4">
          {data?.daNhap && data.coHoaDon ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-5">
              <div><dt className="text-xs text-bo-muted">Ký hiệu mẫu số</dt><dd className="m-0 font-medium">{data.mauSo || "—"}</dd></div>
              <div><dt className="text-xs text-bo-muted">Ký hiệu</dt><dd className="m-0 font-medium">{data.kyHieu}</dd></div>
              <div><dt className="text-xs text-bo-muted">Số hóa đơn</dt><dd className="m-0 font-medium tabular-nums">{data.soHoaDon}</dd></div>
              <div><dt className="text-xs text-bo-muted">Ngày hóa đơn</dt><dd className="m-0 font-medium tabular-nums">{hienNgay(data.ngayHoaDon)}</dd></div>
              <div><dt className="text-xs text-bo-muted">Thuế suất</dt><dd className="m-0 font-medium">{Number(data.thueSuat)}%</dd></div>
            </dl>
          ) : data?.daNhap ? (
            <p className="text-sm text-bo-foreground">Nhà cung cấp không xuất hóa đơn GTGT cho phiếu này.</p>
          ) : data?.daKhoa ? (
            <p className="text-sm text-bo-muted">
              Chưa nhập hóa đơn. Phiếu đã sang kế toán ở dạng "Không kèm hóa đơn", giá nhập tách thuế theo mức chung.
            </p>
          ) : (
            <p className="text-sm text-bo-muted">
              Chưa nhập hóa đơn. Nếu xuất sang kế toán lúc này, phiếu đi ở dạng "Không kèm hóa đơn" và giá nhập tách thuế theo mức chung.
            </p>
          )}
          {data?.daKhoa ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-bo-muted">
              <Lock className="size-3.5" aria-hidden="true" />
              Đã xuất sang kế toán ở lô {data.soLoXuat}, không sửa được. Quản trị viên mở khóa chứng từ ở màn Xuất dữ liệu kế toán nếu cần.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
