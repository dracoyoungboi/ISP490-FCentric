import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Lock, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NSX_SOM_NHAT, conTrongKe, keDungDuoc } from "@/pages/receipt/kiemDem";
import { TIEN_TO_THE_LENH } from "@/utils/maVach";
import { taoBoNhanQuetNhanh } from "@/utils/quetNhanh";
import { formatNumber } from "@/utils/formatters";

const O_NHAP =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-bo-foreground placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-[3px] focus:ring-bo-primary/20 disabled:bg-bo-surface-subtle";
// Thẻ lệnh dính ở cuối ô Mã lô (FC-KHOA-LO, FC-HOAN-TAC, FC-KHONG-DAT, FC-DAT, FC-LD-n)
const DUOI_THE_LENH = new RegExp(`${TIEN_TO_THE_LENH}(KHOA-LO|HOAN-TAC|KHONG-DAT|DAT|LD-\\d+)$`, "i");

/**
 * Hộp Khóa lô (PA2). Ô quét trong hộp nhận mã kệ và thẻ KHÓA LÔ; thẻ HOÀN TÁC đóng hộp.
 * Kệ chỉ cần khi lô có hàng đạt; hàng không đạt để ở khu chờ trả nhà cung cấp, không lên kệ.
 *
 * Máy quét gõ như bàn phím: nếu con trỏ đang ở ô Mã lô / Ngày sản xuất / chọn kệ mà người kiểm bóp máy quét,
 * mã quét KHÔNG được ghi vào ô đó — hộp nhận ra lần quét (gõ rất nhanh + Enter), trả ô về giá trị cũ và xử lý mã
 * như quét ở ô quét. Ô chọn kệ không nhảy theo chữ gõ (phím chữ được chuyển sang ô quét).
 * Chọn kệ / chọn ngày bằng chuột, hoặc Enter ở các ô, thì con trỏ về ô quét; gõ tay bằng bàn phím thì con trỏ ở yên.
 *
 * Mã lô và ngày sản xuất đang gõ giữ trong hộp, chỉ ghi vào lô đang kiểm khi rời ô / Enter / dừng gõ / khóa:
 * mỗi phím không vẽ lại cả màn kiểm đếm (màn chậm thì phím của máy quét bị dãn ra, không nhận ra lần quét).
 */
export default function HopKhoaLo({ open, onHuy, ...props }) {
  return (
    <Dialog open={open} onOpenChange={(mo) => !mo && onHuy()}>
      {open ? <NoiDung onHuy={onHuy} {...props} /> : null}
    </Dialog>
  );
}

function NoiDung({
  t,
  dk,
  viTris,
  khuVucs,
  coKe,
  keDangTai,
  keId,
  nsx,
  maLo,
  homNay,
  nhomLoi,
  dangKhoa,
  loiQuet,
  nhacThieu,
  onQuet,
  onChonKe,
  onDoiMaLo,
  onDoiNsx,
  onKhoa,
  onHuy,
}) {
  const [maQuet, setMaQuet] = useState("");
  // Mã lô / ngày đang sửa trong hộp (null = chưa sửa, hiện giá trị của lô đang kiểm, kể cả mã lô gợi ý)
  const [maLoSua, setMaLoSua] = useState(null);
  const [nsxSua, setNsxSua] = useState(null);
  // Đổi key để vẽ lại ô ngày sau khi khôi phục (ô ngày đang gõ dở không nhận lại giá trị từ React)
  const [lamMoiNgay, setLamMoiNgay] = useState(0);
  const oQuetRef = useRef(null);
  const henGhiRef = useRef(null);
  // Lúc gõ phím gần nhất ở ô ngày / ô chọn kệ: đổi giá trị ngay sau phím là gõ bàn phím, không phải chọn bằng chuột
  const phimNgayRef = useRef(-Infinity);
  const phimKeRef = useRef(-Infinity);
  // Giá trị và hàm xử lý mới nhất, đọc lúc nhận ra lần quét / lúc ghi (không đọc trong lúc vẽ)
  const moiNhatRef = useRef({});
  useEffect(() => {
    moiNhatRef.current = { keId, maLoSua, nsxSua, onChonKe, onDoiMaLo, onDoiNsx, onQuet };
  });
  // Đóng hộp bằng cách nào (Hủy, Esc, quét HOÀN TÁC) cũng giữ phần mã lô / ngày vừa sửa trong lô đang kiểm
  useEffect(() => {
    const nhat = moiNhatRef;
    const hen = henGhiRef;
    return () => {
      clearTimeout(hen.current);
      const m = nhat.current;
      if (m.maLoSua !== null && m.maLoSua !== undefined) m.onDoiMaLo(m.maLoSua);
      if (m.nsxSua !== null && m.nsxSua !== undefined) m.onDoiNsx(m.nsxSua);
    };
  }, []);
  const veOQuet = () => oQuetRef.current?.focus();
  const tuBanPhim = (ref) => performance.now() - ref.current < 400;

  // Ghi mã lô / ngày đang sửa vào lô đang kiểm (điều kiện khóa, bản tạm của trình duyệt tính theo giá trị này)
  const ghi = () => {
    clearTimeout(henGhiRef.current);
    const m = moiNhatRef.current;
    if (m.maLoSua !== null) m.onDoiMaLo(m.maLoSua);
    if (m.nsxSua !== null) m.onDoiNsx(m.nsxSua);
    // Đã ghi: lần đóng hộp sau không ghi lại giá trị cũ
    m.maLoSua = null;
    m.nsxSua = null;
    setMaLoSua(null);
    setNsxSua(null);
  };
  // Dừng gõ một lúc thì ghi (hộp báo ngay mã lô trùng / ngày sai); máy quét gõ liền nên không ghi giữa chừng
  const henGhi = () => {
    clearTimeout(henGhiRef.current);
    henGhiRef.current = setTimeout(ghi, 300);
  };

  // Bộ nhận lần quét tạo lúc có phím đầu tiên (trong xử lý sự kiện, không trong lúc vẽ)
  const boNhanRef = useRef(null);
  const nhanQuetNhanh = (e) => {
    if (!boNhanRef.current) {
      boNhanRef.current = taoBoNhanQuetNhanh({
        layAnhChup: () => {
          const { keId: ke, maLoSua: ma, nsxSua: ngay } = moiNhatRef.current;
          return { keId: ke, maLoSua: ma, nsxSua: ngay };
        },
        khoiPhuc: (anh) => {
          if (!anh) return;
          clearTimeout(henGhiRef.current);
          const m = moiNhatRef.current;
          if ((anh.keId ?? null) !== (m.keId ?? null)) m.onChonKe(anh.keId ?? null);
          // Trả đúng trạng thái trước lần quét: ô chưa sửa thì vẫn theo mã lô gợi ý (không biến gợi ý thành mã cố định)
          m.maLoSua = anh.maLoSua;
          m.nsxSua = anh.nsxSua;
          setMaLoSua(anh.maLoSua);
          setNsxSua(anh.nsxSua);
          setLamMoiNgay((n) => n + 1);
        },
        onMa: (ma) => {
          oQuetRef.current?.focus();
          ghi();
          moiNhatRef.current.onQuet(ma);
        },
      });
    }
    boNhanRef.current(e);
  };

  const guiMa = (e) => {
    e.preventDefault();
    const ma = maQuet;
    setMaQuet("");
    oQuetRef.current?.focus();
    ghi();
    if (ma.trim()) onQuet(ma);
  };

  const canKe = t.datLo > 0 && coKe;
  const tenKhu = new Map(khuVucs.map((k) => [k.id, k.tenKhuVuc]));
  const loiChu = nhomLoi.map((l) => `${l.lyDo} ${l.soLuong}`).join(", ");

  return (
    <DialogContent
      showCloseButton={false}
      onOpenAutoFocus={(e) => {
        // Lấy con trỏ ngay (không chờ): mã quét kế tiếp không bị chia đôi giữa ô quét chính và ô quét của hộp
        e.preventDefault();
        veOQuet();
      }}
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        if (!dangKhoa) onHuy();
      }}
      onInteractOutside={(e) => e.preventDefault()}
      onKeyDownCapture={(e) => {
        if (e.target === oQuetRef.current) return;
        nhanQuetNhanh(e);
      }}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[560px]"
    >
      <div className="border-b border-bo-border px-6 py-4">
        <DialogTitle className="text-base font-semibold text-bo-foreground">Khóa lô</DialogTitle>
        <DialogDescription className="mt-0.5 text-[13px] leading-5 text-bo-muted">
          Lô đang có {formatNumber(t.datLo)} đạt{t.choLo ? ` · ${formatNumber(t.choLo)} chờ chọn` : ""}. Khóa xong, bộ đếm về 0 cho thùng tiếp theo.
        </DialogDescription>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 *:shrink-0">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-bo-foreground">
            {canKe ? "Quét mã kệ cho hàng đạt, rồi quét thẻ KHÓA LÔ" : "Quét thẻ KHÓA LÔ"}
          </span>
          <form onSubmit={guiMa} className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Mã kệ hoặc thẻ lệnh</span>
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
              <input
                ref={oQuetRef}
                value={maQuet}
                onChange={(e) => setMaQuet(e.target.value)}
                placeholder="Đang chờ quét…"
                autoComplete="off"
                spellCheck={false}
                disabled={dangKhoa}
                className={cn(O_NHAP, "pl-10 font-mono")}
              />
            </label>
            <Button type="submit" variant="outline" disabled={dangKhoa} className="h-10 border-bo-border bg-bo-surface">Nhận</Button>
          </form>
          {canKe ? (
            <select
              aria-label="Chọn tay kệ"
              value={keId ?? ""}
              disabled={dangKhoa}
              onKeyDown={(e) => {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
                  // Ô chọn tự nhảy tới kệ có chữ đầu trùng phím gõ: máy quét bắn mã kệ khi con trỏ ở đây sẽ chọn nhầm kệ.
                  // Không cho nhảy theo chữ; đưa phím sang ô quét để mã quét được ghép đủ ở đó.
                  e.preventDefault();
                  veOQuet();
                  setMaQuet((v) => v + e.key);
                  return;
                }
                phimKeRef.current = performance.now();
                if (e.key === "Enter") {
                  e.preventDefault();
                  veOQuet();
                }
              }}
              onChange={(e) => {
                onChonKe(e.target.value ? Number(e.target.value) : null);
                // Chọn bằng chuột: về ô quét. Chọn bằng phím mũi tên: con trỏ ở yên để chọn tiếp, Enter mới về ô quét
                if (!tuBanPhim(phimKeRef)) veOQuet();
              }}
              className={O_NHAP}
            >
              <option value="">Hoặc chọn tay kệ chưa dán mã</option>
              {khuVucs.map((k) => {
                const ds = viTris.filter((v) => v.khuVucId === k.id);
                if (!ds.length) return null;
                return (
                  <optgroup key={k.id} label={k.tenKhuVuc}>
                    {ds.map((v) => {
                      const kt = keDungDuoc(v, t.datLo);
                      const con = conTrongKe(v);
                      return (
                        <option key={v.id} value={v.id} disabled={!kt.duoc && v.id !== keId}>
                          {v.maViTri} · {kt.duoc ? (con === null ? "không giới hạn" : `còn trống ${formatNumber(con)}`) : kt.lyDo}
                        </option>
                      );
                    })}
                  </optgroup>
                );
              })}
            </select>
          ) : null}
          {canKe && dk.ke ? (
            <p className="text-xs text-bo-muted">
              {/* Mã kệ đã hiện ở ô chọn kệ: dòng này chỉ thêm khu và sức chứa */}
              {tenKhu.get(dk.ke.khuVucId) ?? "Chưa gắn khu"}
              {conTrongKe(dk.ke) !== null
                ? ` · sức chứa ${formatNumber(dk.ke.sucChua)}, đang chứa ${formatNumber(Number(dk.ke.dangChua) || 0)}${Number(dk.ke.choNhap) > 0 ? `, chờ nhập ${formatNumber(dk.ke.choNhap)}` : ""}`
                : " · không giới hạn sức chứa"}
            </p>
          ) : null}
          {loiQuet ? (
            <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-5 text-bo-danger-strong">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {loiQuet}
            </p>
          ) : null}
        </div>

        {t.datLo === 0 && t.trongLo > 0 ? <p className="text-[13px] text-bo-muted">Lô không có hàng đạt nên không cần kệ.</p> : null}
        {t.datLo > 0 && !coKe && !keDangTai ? (
          <p className="text-[13px] text-bo-muted">
            {viTris.length ? "Kho không có kệ đang hoạt động" : "Kho chưa có vị trí kệ"}: hàng đạt được nhập kho chưa gắn kệ.
          </p>
        ) : null}
        {t.loiLo > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900">
            {formatNumber(t.loiLo)} sản phẩm không đạt{loiChu ? ` (${loiChu})` : ""} để ở khu chờ trả nhà cung cấp, không đưa lên kệ.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-bo-foreground">Mã lô</span>
            <input
              value={maLoSua ?? maLo}
              maxLength={50}
              disabled={dangKhoa}
              onChange={(e) => {
                setMaLoSua(e.target.value);
                henGhi();
              }}
              onBlur={ghi}
              onKeyDown={(e) => {
                // Gõ tay xong mã lô thì Enter đưa con trỏ về ô quét, không gửi gì
                if (e.key !== "Enter" || e.defaultPrevented) return;
                e.preventDefault();
                // Máy quét chậm gõ thẻ lệnh vào cuối ô mà không nhận ra là lần quét: tách thẻ lệnh ra, xử lý như quét
                const giaTri = e.currentTarget.value;
                const the = giaTri.match(DUOI_THE_LENH);
                if (the) {
                  const conLai = giaTri.slice(0, giaTri.length - the[0].length);
                  moiNhatRef.current.maLoSua = conLai;
                  setMaLoSua(conLai);
                  ghi();
                  veOQuet();
                  moiNhatRef.current.onQuet(the[0]);
                  return;
                }
                veOQuet();
              }}
              className={cn(O_NHAP, "font-mono")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-bo-foreground">Ngày sản xuất</span>
            <input
              key={lamMoiNgay}
              type="date"
              min={NSX_SOM_NHAT}
              max={homNay}
              value={nsxSua ?? nsx}
              disabled={dangKhoa}
              onKeyDown={(e) => {
                phimNgayRef.current = performance.now();
                if (e.key === "Enter") {
                  e.preventDefault();
                  veOQuet();
                }
              }}
              onChange={(e) => {
                setNsxSua(e.target.value);
                if (tuBanPhim(phimNgayRef)) {
                  // Gõ bằng bàn phím (ngày, tháng, năm từng phần): con trỏ ở yên tới khi gõ xong, Enter hoặc rời ô
                  henGhi();
                  return;
                }
                // Chọn ngày trên lịch bằng chuột: ghi và về ô quét
                moiNhatRef.current.nsxSua = e.target.value;
                ghi();
                veOQuet();
              }}
              onBlur={ghi}
              className={O_NHAP}
            />
          </label>
        </div>

        {dk.loi.length ? (
          <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-5 text-bo-danger-strong">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {dk.loi.join(" ")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        {dk.thieu.length ? (
          <span className={cn("w-full text-xs sm:mr-auto sm:w-auto", nhacThieu ? "font-semibold text-bo-danger-strong" : "text-bo-muted")}>
            Còn thiếu: {dk.thieu.join(", ")}
          </span>
        ) : (
          <span className="hidden sm:mr-auto sm:block" />
        )}
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" disabled={dangKhoa} onClick={onHuy} className="min-w-24 flex-1 border-bo-border bg-bo-surface sm:flex-none">Hủy</Button>
          <Button
            type="button"
            disabled={!dk.ok || dangKhoa}
            onClick={() => {
              // Safari không đưa con trỏ vào nút khi bấm (ô đang sửa không rời): ghi trước khi khóa
              ghi();
              onKhoa();
            }}
            className="min-w-28 flex-1 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover sm:flex-none"
          >
            {dangKhoa ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Khóa lô
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
