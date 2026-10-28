import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { chonKhiEnter, khoaSanPham, timHang } from "./tinhTaoYeuCau";

const DANH_SACH = "absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[380px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg";

/**
 * Ô tìm / quét thêm hàng của màn Tạo yêu cầu nhập hàng (combobox): tìm tên, SKU, mã vạch, mã sản phẩm, màu, cỡ (không
 * dấu). Kết quả gom theo sản phẩm, mỗi sản phẩm có nút "Thêm cả n biến thể"; ↑ ↓ chọn, Enter thêm, Shift+Enter thêm cả
 * sản phẩm của mã đó. Enter khi trùng đúng SKU / mã vạch (máy quét) thì thêm luôn mã đó, kể cả khi chuột đang đặt trên một
 * dòng khác của danh sách (chỉ chọn bằng phím ↑ ↓ mới thắng). Chọn lại mã đã có: cộng 1 (màn xử lý trong `onThem`).
 *
 * - `dsHang`, `chiMuc`: danh mục hàng Kho tổng và chỉ mục (tinhTaoYeuCau.taoChiMuc). `dong`: các dòng đang có.
 * - `onThem(bienThe)`, `onThemCa(khoaSanPham)`. `oRef`: ref ô nhập (màn đưa tiêu điểm về sau khi thêm).
 * - `chuTrong`: câu khi danh mục trống (đang tải, lỗi tải…).
 */
export default function OTimThemHang({ dsHang, chiMuc, dong, khoa = false, onThem, onThemCa, oRef, chuTrong, className }) {
  const id = useId();
  const henDongRef = useRef(0);
  const chonBangPhimRef = useRef(false); // dòng đang sáng do ↑ ↓ (không phải do rê chuột)
  const [tuKhoa, setTuKhoa] = useState("");
  const [mo, setMo] = useState(false);
  const [chiSo, setChiSo] = useState(-1);
  const [goiY, setGoiY] = useState("");

  useEffect(() => () => clearTimeout(henDongRef.current), []);

  const kq = useMemo(() => timHang(dsHang, tuKhoa), [dsHang, tuKhoa]);
  const slTheoId = useMemo(() => new Map((dong ?? []).map((d) => [String(d.bienTheId), d.soLuong])), [dong]);
  const nhom = useMemo(() => {
    const ds = [];
    kq.ds.forEach((bt, i) => {
      const khoa = khoaSanPham(bt);
      let n = ds.find((x) => x.khoa === khoa);
      if (!n) {
        const caSanPham = chiMuc?.theoSanPham?.get(khoa) ?? [bt];
        n = { khoa, bt, thieu: caSanPham.filter((x) => !slTheoId.has(String(x.bienTheId))).length, tong: caSanPham.length, muc: [] };
        ds.push(n);
      }
      n.muc.push({ bt, i });
    });
    return ds;
  }, [kq, chiMuc, slTheoId]);

  const dangMo = mo && !khoa;
  const idDs = `${id}-ds`;

  useEffect(() => {
    if (chiSo >= 0) document.getElementById(`${id}-muc-${chiSo}`)?.scrollIntoView({ block: "nearest" });
  }, [chiSo, id]);

  // `xoa`: thêm bằng Enter / máy quét → xóa chữ và đóng danh sách (quét mã kế tiếp); bấm chuột vào một dòng → giữ danh
  // sách để thêm tiếp mã khác cùng kết quả
  const them = (bt, xoa = true) => {
    onThem?.(bt);
    if (xoa) { setTuKhoa(""); setMo(false); }
    setGoiY("");
    setChiSo(-1);
    oRef?.current?.focus();
  };

  const themCa = (khoa) => {
    onThemCa?.(khoa);
    setTuKhoa("");
    setGoiY("");
    setMo(false);
    setChiSo(-1);
  };

  const enter = (caSanPham) => {
    const chon = chonKhiEnter(dsHang, chiMuc, tuKhoa);
    if (!chon) return;
    if (chon.bienThe) {
      if (caSanPham) themCa(khoaSanPham(chon.bienThe));
      else them(chon.bienThe);
      return;
    }
    const tho = tuKhoa.trim();
    setMo(true);
    setGoiY(chon.loi === "nhieu"
      ? `Nhiều sản phẩm khớp “${tho}”, chọn trong danh sách (phím ↑ ↓ rồi Enter).`
      : `Không tìm thấy sản phẩm “${tho}”.`);
  };

  const phim = (e) => {
    const soMuc = kq.ds.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!dangMo) { setMo(true); setChiSo(soMuc ? 0 : -1); chonBangPhimRef.current = soMuc > 0; return; }
      if (!soMuc) return;
      chonBangPhimRef.current = true;
      const buoc = e.key === "ArrowDown" ? 1 : -1;
      setChiSo((cu) => (cu < 0 ? (buoc > 0 ? 0 : soMuc - 1) : (cu + buoc + soMuc) % soMuc));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Dòng sáng chỉ thắng khi chọn bằng phím, hoặc khi chữ gõ không trùng đúng mã nào (máy quét luôn ra đúng mã)
      const sangDuoc = dangMo && chiSo >= 0 && chiSo < soMuc
        && (chonBangPhimRef.current || !chiMuc?.theoMa?.has(tuKhoa.trim().toLowerCase()));
      if (!sangDuoc) enter(e.shiftKey);
      else if (e.shiftKey) themCa(khoaSanPham(kq.ds[chiSo]));
      else them(kq.ds[chiSo]);
    } else if (e.key === "Escape" && dangMo) {
      setMo(false);
      setChiSo(-1);
    }
  };

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <label htmlFor={`${id}-o`} className="sr-only">Thêm sản phẩm: tìm hoặc quét mã</label>
      <ScanBarcode className="pointer-events-none absolute left-3 top-2.5 size-4 text-bo-muted" aria-hidden="true" />
      <input
        id={`${id}-o`}
        ref={oRef}
        value={tuKhoa}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={dangMo}
        aria-controls={dangMo ? idDs : undefined}
        aria-activedescendant={dangMo && chiSo >= 0 ? `${id}-muc-${chiSo}` : undefined}
        aria-describedby={goiY ? `${id}-goi-y` : undefined}
        disabled={khoa}
        placeholder="Thêm sản phẩm: tìm tên, mã SKU hoặc quét mã vạch rồi Enter"
        onChange={(e) => { setTuKhoa(e.target.value); setGoiY(""); setChiSo(-1); chonBangPhimRef.current = false; setMo(true); }}
        // Chỉ mở danh sách khi người dùng gõ, bấm ↑ ↓ hay bấm chuột vào ô: tiêu điểm được trả về ô (đóng hộp thoại, bỏ dòng)
        // thì không bung danh sách đè lên bảng
        onFocus={() => clearTimeout(henDongRef.current)}
        onMouseDown={() => setMo(true)}
        onBlur={() => { henDongRef.current = setTimeout(() => { setMo(false); setChiSo(-1); }, 150); }}
        onKeyDown={phim}
        className={cn(O_NHAP, "pl-9")}
      />
      {goiY ? <p id={`${id}-goi-y`} className="mt-1.5 text-xs leading-4 text-bo-warning">{goiY}</p> : null}
      {dangMo ? (
        <div id={idDs} role="listbox" aria-label="Sản phẩm khớp" className={DANH_SACH}>
          {nhom.length ? nhom.map((n) => (
            <Fragment key={n.khoa}>
              <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-2 first:pt-1.5" role="presentation">
                <AnhBienThe src={n.bt.anh} co="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-[18px] text-bo-foreground" title={n.bt.tenSanPham}>{n.bt.tenSanPham}</span>
                  <span className="block text-xs leading-4 text-bo-muted">
                    {[n.bt.maSanPham, n.bt.nhomHang, `${soVN(n.tong)} biến thể`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {n.thieu > 0 ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => themCa(n.khoa)}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-bo-border bg-bo-surface px-2 text-xs font-medium text-bo-primary hover:border-blue-200 hover:bg-bo-primary-soft"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {n.thieu === n.tong ? `Thêm cả ${soVN(n.thieu)} biến thể` : `Thêm ${soVN(n.thieu)} biến thể còn lại`}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-bo-muted">Đã thêm đủ biến thể</span>
                )}
              </div>
              {n.muc.map(({ bt, i }) => {
                const daCo = slTheoId.get(String(bt.bienTheId));
                return (
                  <button
                    key={bt.bienTheId}
                    id={`${id}-muc-${i}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === chiSo}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => { chonBangPhimRef.current = false; setChiSo(i); }}
                    onClick={() => them(bt, false)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md py-1.5 pl-12 pr-2.5 text-left hover:bg-slate-100",
                      i === chiSo && "bg-slate-100",
                    )}
                  >
                    <span className="min-w-0">
                      <MauKichCo tenMau={bt.tenMau} maMauHex={bt.maMauHex} kichCo={bt.tenSize} className="text-[13px] text-slate-700" />
                      <span className="block break-all font-mono text-xs leading-4 text-bo-muted">{bt.maSku}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3.5 text-xs leading-4 tabular-nums">
                      <span className="text-bo-muted">Khả dụng {soVN(bt.khaDung)}</span>
                      <span className={cn("min-w-11 text-right", daCo != null ? "text-bo-muted" : "font-medium text-bo-primary")}>
                        {daCo != null ? `Đang có ${soVN(daCo)} · +1` : "Thêm"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </Fragment>
          )) : (
            <p className="px-2.5 py-2 text-sm text-bo-muted">
              {!dsHang?.length ? chuTrong || "Chưa có sản phẩm nào nhập được." : `Không tìm thấy sản phẩm khớp “${tuKhoa.trim()}”. Thử tên, mã SKU hoặc mã vạch khác.`}
            </p>
          )}
          {nhom.length ? (
            <p className="hidden border-t border-slate-100 px-2.5 pb-1 pt-2 text-xs leading-4 text-bo-muted sm:block">
              <kbd className="font-sans font-medium text-slate-600">↑ ↓</kbd> chọn · <kbd className="font-sans font-medium text-slate-600">Enter</kbd> thêm mã ·{" "}
              <kbd className="font-sans font-medium text-slate-600">Shift + Enter</kbd> thêm cả sản phẩm
            </p>
          ) : null}
          {kq.tong > kq.ds.length ? (
            <p className="px-2.5 py-2 text-xs text-bo-muted">
              Còn {soVN(kq.tong - kq.ds.length)} biến thể khác, gõ thêm tên, màu hoặc cỡ để lọc.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
