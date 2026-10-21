import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, RotateCcw, ScanLine, ScanSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { THE_LENH, tenDayDu } from "@/pages/receipt/kiemDem";
import { TIEN_TO_THE_LENH, ganGiong, moTaDangMa, phanDauCua } from "@/utils/maVach";
import StatusBadge from "@/components/shared/StatusBadge";

const O_NHAP =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-bo-foreground placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-[3px] focus:ring-bo-primary/20";

/**
 * Hộp "Mã chưa có trong hệ thống" (chốt 19/10/2026).
 * Bước 1/2: mã này là gì? Trả lời bằng máy quét — quét lại đúng tem đó (2 lần trùng) là "đúng mã NCC";
 * thẻ HOÀN TÁC là "quét lỗi, bỏ qua"; ra mã đã có là lần đầu đọc lệch, dùng luôn mã mới. Có gợi ý mã gần giống.
 * Bước 2/2: chọn biến thể FCentric (chỉ biến thể trong phiếu) để liên kết; chỉ làm một lần cho mỗi mã.
 *
 * - `nhanBiet(ma)`: "san-pham" nếu mã đã có (SKU / mã vạch FCentric / mã NCC đã liên kết của biến thể trong phiếu),
 *   "ke" nếu là mã kệ, null nếu chưa có.
 * - `onDungMa(ma, nguon)`: đóng hộp và xử lý `ma` như vừa quét đúng mã đó.
 * - `onLienKet({ bienTheSanPhamId, maHangNcc })`: Promise; lỗi thì hộp giữ nguyên và hiện câu báo.
 * - `traMa(ma)`: hỏi máy chủ mã có trong hệ thống không (SKU / mã NCC của biến thể ngoài phiếu): lần quét lại ra mã
 *   có thật thì là lần đầu đọc lệch, xử lý mã đó như quét ở ô chính (không báo nhầm là máy đọc lệch).
 * - `ref.nhanMa(ma)`: mã quét đến ô quét chính lúc hộp đang mở (máy quét bắn liền) được đưa vào hộp, không bị bỏ.
 * - `quet.dangGo`: phần mã máy quét đã gõ vào ô chính trước khi hộp mở, ghép tiếp ở ô quét của hộp.
 * - `layPhanConLai()`: phần phím lọt vào ô chính trong lúc hộp đang mở (trước khi hộp lấy được con trỏ); hộp lấy
 *   và ghép tiếp ngay khi có con trỏ, ô chính được xóa (không dính vào đầu lần quét sau).
 */
export default function HopMaChuaCo({ quet, ref, ...props }) {
  return (
    <Dialog open={Boolean(quet)} onOpenChange={(mo) => !mo && props.onBoQua("Đã bỏ qua")}>
      {quet ? <NoiDung key={`${quet.ma}-${quet.lan}`} quet={quet} dieuKhienRef={ref} {...props} /> : null}
    </Dialog>
  );
}

function NoiDung({ quet, dieuKhienRef, phieu, items, bienTheDangKiemId, ungVienGanGiong, nhanBiet, traMa, layPhanConLai, onDungMa, onBoQua, onLienKet, onBip }) {
  const [buoc, setBuoc] = useState(1);
  const [quetLai, setQuetLai] = useState(quet.dangGo ?? "");
  const [ketQua, setKetQua] = useState("");
  const [chon, setChon] = useState(null);
  const [tim, setTim] = useState("");
  const [maHang, setMaHang] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const [loiLuu, setLoiLuu] = useState("");
  const oQuetLaiRef = useRef(null);
  const oTimRef = useRef(null);

  const ma = quet.ma;
  const dang = useMemo(() => moTaDangMa(ma), [ma]);
  // Mã GS1 đúng số kiểm tra thì không gợi ý: mã cùng nhà cung cấp vốn chỉ khác vài số cuối, gợi ý sẽ sai.
  const ganDung = useMemo(() => (dang.gs1.ok === true ? [] : ganGiong(ma, ungVienGanGiong)), [dang, ma, ungVienGanGiong]);
  // Không có mã lệch 1–2 ký tự: thử xem mã quét có phải phần đầu của mã đã có (máy đọc thiếu đuôi)
  const phanDau = useMemo(() => (ganDung.length || dang.gs1.ok === true ? [] : phanDauCua(ma, ungVienGanGiong)), [ganDung, dang, ma, ungVienGanGiong]);
  const goiY = ganDung.length ? ganDung : phanDau;

  // Bước 2 cần chuột (chọn biến thể): đưa con trỏ vào ô tìm. Bước 1 lấy con trỏ ngay lúc mở (onOpenAutoFocus).
  useEffect(() => {
    if (buoc !== 2) return undefined;
    const id = setTimeout(() => oTimRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [buoc]);

  const xuLyQuetLai = async (lan2) => {
    const hoa2 = lan2.toUpperCase();
    if (hoa2 === THE_LENH.HOAN_TAC) {
      onBoQua("Đã bỏ qua");
      return;
    }
    if (hoa2.startsWith(TIEN_TO_THE_LENH)) {
      setKetQua("Ở bước này chỉ dùng được thẻ HOÀN TÁC. Quét lại tem sản phẩm để xác nhận.");
      onBip("sai");
      return;
    }
    if (hoa2 === ma.toUpperCase()) {
      if (dang.gs1.ok === false) {
        setKetQua("Quét lại vẫn ra mã sai số kiểm tra: tem có thể bị in hỏng. Nhập SKU in trên tem FCentric, hoặc bấm Bỏ qua và để riêng sản phẩm.");
        onBip("sai");
        return;
      }
      setKetQua("");
      setBuoc(2);
      onBip("ok");
      return;
    }
    const loai = nhanBiet(lan2);
    if (loai === "san-pham") {
      onDungMa(lan2, `lần quét lại (lần đầu đọc lệch ${ma})`);
      return;
    }
    if (loai === "ke") {
      setKetQua(`${lan2} là mã kệ. Quét lại tem trên sản phẩm để xác nhận.`);
      onBip("sai");
      return;
    }
    // Mã có thật ở nơi khác (SKU / mã NCC của biến thể ngoài phiếu): lần đầu đọc lệch, để màn chính báo đúng mã này
    let coThat = false;
    try {
      coThat = Boolean((await traMa?.(lan2))?.timThay);
    } catch {
      coThat = false;
    }
    if (coThat) {
      onDungMa(lan2, `lần quét lại (lần đầu đọc lệch ${ma})`);
      return;
    }
    setKetQua(`Lần quét lại ra ${lan2}, khác lần đầu. Máy đang đọc lệch: lau tem, quét chậm lại rồi quét lại.`);
    onBip("sai");
  };

  const traLoiBangMayQuet = (e) => {
    e.preventDefault();
    const lan2 = quetLai.trim();
    setQuetLai("");
    oQuetLaiRef.current?.focus();
    if (!lan2) return;
    xuLyQuetLai(lan2);
  };

  useImperativeHandle(dieuKhienRef, () => ({
    // Mã đến từ ô quét chính lúc hộp đang mở: ở bước 1 coi như lần quét lại; ở bước 2 (đang chọn biến thể) thì nhắc
    nhanMa: (raw) => {
      const lan2 = String(raw ?? "").trim();
      if (!lan2) return;
      if (buoc === 1) {
        xuLyQuetLai(lan2);
        return;
      }
      setLoiLuu(`Mã ${lan2} chưa được tính: đang liên kết mã ${ma}. Liên kết hoặc Bỏ qua xong rồi quét lại.`);
      onBip("sai");
    },
  }));

  const q = tim.trim().toLowerCase();
  // Biến thể đang kiểm lên đầu: thường chính là sản phẩm mang tem vừa quét
  const dsBienThe = items
    .filter((it) => !q || [it.tenBienThe, it.mauSac, it.kichCo, it.sku].filter(Boolean).join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.bienTheSanPhamId === bienTheDangKiemId) - (a.bienTheSanPhamId === bienTheDangKiemId));
  const chonKhac = chon != null && chon !== bienTheDangKiemId;

  const lienKet = async () => {
    if (chon == null || dangLuu) return;
    setDangLuu(true);
    setLoiLuu("");
    try {
      await onLienKet({ bienTheSanPhamId: chon, maHangNcc: maHang.trim() });
    } catch (error) {
      setLoiLuu(error?.message || "Không liên kết được mã vạch. Vui lòng thử lại.");
      setDangLuu(false);
    }
  };

  return (
    <DialogContent
      showCloseButton={false}
      onOpenAutoFocus={(e) => {
        // Lấy con trỏ ngay khi mở: phần còn lại của mã máy quét đang gõ rơi đúng vào ô quét lại
        e.preventDefault();
        const o = oQuetLaiRef.current;
        if (o) {
          o.focus();
          const them = layPhanConLai?.() ?? "";
          if (them) setQuetLai((v) => v + them);
          o.setSelectionRange?.(o.value.length, o.value.length);
        }
      }}
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        if (!dangLuu) onBoQua("Đã bỏ qua");
      }}
      onInteractOutside={(e) => e.preventDefault()}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[600px]"
    >
      {buoc === 1 ? (
        <>
          <div className="flex items-start gap-3 border-b border-bo-border px-6 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-50 text-amber-700">
              <ScanSearch className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-bo-foreground">Mã chưa có trong hệ thống</DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                Không khớp SKU, mã kệ hay mã vạch nào đã liên kết với nhà cung cấp của phiếu này.
              </DialogDescription>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 *:shrink-0">
            <div className="flex flex-col gap-1">
              <span className="break-all font-mono text-lg font-semibold leading-[26px] tracking-[0.02em] text-bo-heading">{ma}</span>
              <span className={cn("flex items-center gap-1.5 text-[12.5px] leading-[18px]", dang.tone === "ok" ? "text-green-700" : dang.tone === "bad" ? "text-red-700" : "text-bo-muted")}>
                {dang.tone === "ok" ? <Check className="size-3.5" /> : dang.tone === "bad" ? <AlertCircle className="size-3.5" /> : null}
                {dang.chu}
                {quet.sl > 1 ? ` · lượt ${quet.sl} cái` : ""}
              </span>
            </div>

            {goiY.length ? (
              <div className="shrink-0 overflow-hidden rounded-lg border border-orange-200 bg-orange-50/40">
                <p className="border-b border-orange-200 px-3 py-2 text-[13px] font-semibold text-orange-900">
                  {ganDung.length ? "Gần giống mã đã có, có thể máy quét đọc lệch" : "Là phần đầu của mã đã có, có thể máy quét đọc thiếu"}
                </p>
                {goiY.map((g) => (
                  <div key={g.ma} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-orange-100 px-3 py-2.5 first:border-t-0">
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <span className="break-all font-mono text-sm font-semibold">
                        {g.kyTu.map((k, i) => (
                          <span key={i} className={k.lech ? "rounded-sm bg-orange-300 text-orange-950" : undefined}>{k.c}</span>
                        ))}
                      </span>
                      <span className="text-xs text-bo-muted">{g.nhan}</span>
                    </div>
                    <span className="whitespace-nowrap text-xs font-medium text-orange-800">{g.lech ? `lệch ${g.lech} ký tự` : `thiếu ${g.thieu} ký tự cuối`}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDungMa(g.ma, `sửa từ mã quét lệch ${ma}`)} className="border-bo-border bg-white text-xs">
                      Dùng mã này
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-lg border border-bo-border p-4">
              <p className="text-sm font-semibold text-bo-heading">Đây có phải mã vạch in trên tem của nhà cung cấp?</p>
              <div className={cn("flex items-start gap-2.5 text-[13px] leading-5", dang.gs1.ok === false && "opacity-60")}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-50 text-bo-primary"><ScanLine className="size-4" /></span>
                <span>
                  {dang.gs1.ok === false ? (
                    "Không thể là mã in trên tem vì sai số kiểm tra. Quét lại sản phẩm, hoặc dùng mã gần giống ở trên."
                  ) : (
                    <><b>Đúng:</b> quét lại tem này một lần nữa. Hai lần trùng nhau thì chuyển sang chọn sản phẩm.</>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-[13px] leading-5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><RotateCcw className="size-4" /></span>
                <span><b>Không, quét lỗi:</b> quét thẻ HOÀN TÁC hoặc bấm Bỏ qua, rồi quét lại sản phẩm. Lượt này không được tính.</span>
              </div>
              <form onSubmit={traLoiBangMayQuet} className="flex gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Quét lại mã</span>
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                  <input
                    ref={oQuetLaiRef}
                    value={quetLai}
                    onChange={(e) => setQuetLai(e.target.value)}
                    placeholder="Đang chờ quét…"
                    autoComplete="off"
                    spellCheck={false}
                    className={cn(O_NHAP, "pl-10 font-mono")}
                  />
                </label>
                <Button type="submit" variant="outline" className="h-10 border-bo-border bg-white">Nhận</Button>
              </form>
              {ketQua ? (
                <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-5 text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" /> {ketQua}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
            <span className="mr-auto text-xs text-bo-muted">Bước 1/2</span>
            <Button type="button" variant="outline" onClick={() => onBoQua("Đã bỏ qua")} className="min-w-24 border-bo-border bg-white">Bỏ qua</Button>
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-bo-border px-6 py-4">
            <DialogTitle className="text-base font-semibold text-bo-foreground">Liên kết mã vạch nhà cung cấp</DialogTitle>
            <DialogDescription className="mt-0.5 text-[13px] leading-5 text-bo-muted">
              Chọn đúng biến thể mang tem này. Liên kết hiện ngay ở trang Mã vạch nhà cung cấp; lần sau quét mã sẽ tự nhận.
            </DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 *:shrink-0">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[repeat(3,auto)]">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-bo-muted">Mã vạch NCC</dt>
                <dd className="break-all font-mono font-semibold text-bo-heading">{ma}</dd>
                <dd className="mt-0.5 flex items-center gap-1 text-xs text-green-700"><Check className="size-3.5" /> Quét 2 lần trùng</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-bo-muted">Nhà cung cấp</dt>
                <dd className="font-medium text-bo-heading">{phieu?.tenNhaCungCap || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-bo-muted">Từ phiếu nhập</dt>
                <dd className="font-mono font-medium text-bo-heading">{phieu?.soPhieuNhap}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-bo-foreground">Biến thể FCentric</span>
              <label className="relative">
                <span className="sr-only">Tìm biến thể</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                <input
                  ref={oTimRef}
                  value={tim}
                  onChange={(e) => setTim(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  placeholder="Tìm theo tên, màu, kích cỡ hoặc SKU"
                  className={cn(O_NHAP, "pl-10")}
                />
              </label>
              <div role="radiogroup" aria-label="Biến thể FCentric trong phiếu nhập" className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {dsBienThe.map((it) => {
                  const dangChon = chon === it.bienTheSanPhamId;
                  return (
                    <button
                      key={it.bienTheSanPhamId}
                      type="button"
                      role="radio"
                      aria-checked={dangChon}
                      onClick={() => setChon(it.bienTheSanPhamId)}
                      className={cn(
                        "flex min-h-[52px] w-full items-center gap-2.5 rounded-md border bg-white px-3 py-2 text-left text-sm",
                        dangChon ? "border-bo-primary bg-[#f5f9ff] shadow-[inset_0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border hover:border-slate-300",
                      )}
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]", dangChon ? "border-bo-primary" : "border-slate-300")}>
                        {dangChon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-bo-heading">{it.tenBienThe}</span>
                        <span className="truncate text-xs text-bo-muted">
                          {[it.mauSac, it.kichCo ? `Kích cỡ ${it.kichCo}` : null, it.sku].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {it.bienTheSanPhamId === bienTheDangKiemId ? (
                        <StatusBadge label="Đang kiểm đếm" />
                      ) : null}
                    </button>
                  );
                })}
                {dsBienThe.length === 0 ? <p className="py-6 text-center text-sm text-bo-muted">Không có biến thể nào khớp.</p> : null}
              </div>
              <p className="text-xs leading-5 text-bo-muted">
                Chỉ hiện biến thể có trong phiếu nhập này. Sản phẩm không có trong phiếu: bấm Bỏ qua, để riêng và báo quản lý kho.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-bo-foreground">
                Mã hàng NCC <span className="font-normal text-bo-muted">(không bắt buộc)</span>
              </span>
              <input value={maHang} maxLength={100} onChange={(e) => setMaHang(e.target.value)} placeholder="Mã sản phẩm in trên tem, VD: PN-JB-030" className={cn(O_NHAP, "font-mono")} />
            </label>

            {chonKhac ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900">
                Biến thể đã chọn ({tenDayDu(items.find((it) => it.bienTheSanPhamId === chon))}) không phải biến thể đang kiểm. Mã vẫn được liên kết,
                nhưng sản phẩm này không được đếm ở đây: để riêng và kiểm ở biến thể đó.
              </p>
            ) : null}
            {loiLuu ? (
              <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-5 text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {loiLuu}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
            <span className="w-full text-xs text-bo-muted sm:mr-auto sm:w-auto">Bước 2/2</span>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="outline" disabled={dangLuu} onClick={() => onBoQua("Chưa liên kết")} className="min-w-24 border-bo-border bg-white">Bỏ qua</Button>
              <Button type="button" disabled={chon == null || dangLuu} onClick={lienKet} className="min-w-28 flex-1 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover sm:flex-none">
                {dangLuu ? <Loader2 className="size-4 animate-spin" /> : null}
                {chonKhac ? "Liên kết" : "Liên kết và tính lượt quét"}
              </Button>
            </div>
          </div>
        </>
      )}
    </DialogContent>
  );
}
