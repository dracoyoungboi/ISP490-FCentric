import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { Ban, Download, Info, Loader2, Minus, Plus, Printer, ScanBarcode, TriangleAlert } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import TemSanPham from "@/components/print/TemSanPham";
import ToTem from "@/components/print/ToTem";
import { usePreviewViewportSize } from "@/components/print/usePreviewViewportSize";
import { KHO_TEM, KHO_TEM_MAC_DINH, getLabelPageCss, layKhoTem } from "@/components/print/paperStyles";
import {
  CHE_DO_SO_TEM,
  LY_DO_BO_QUA,
  boDongTrung,
  chuanHoaDongInTem,
  cheDoMacDinh,
  dungLanIn,
  gioiHanSoTem,
  lyDoBoQua,
  nhanBienThe,
  pxMoiMmXemTruoc,
  soTemCuaDong,
  timDongTheoMa,
} from "@/components/print/tinhTem";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { temSanPhamService } from "@/services/temSanPhamService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { formatNumber } from "@/utils/formatters";

const NGUONG_MAC_DINH = 200;
const COT = "grid grid-cols-[minmax(0,1fr)_110px_76px_112px] items-center";

/**
 * Hộp "In tem sản phẩm" (thay BarcodePrint): mở từ màn Giá bán & tem mã vạch (SKU đã chọn, sau khi đổi giá) hoặc từ
 * phiếu nhập đã hoàn tất.
 * - `nguon`: "chon" | "doi-gia" | "phieu" — quyết định dòng phụ đầu hộp và cách tính số tem mặc định.
 * - `dong`: SKU cần in ({ id, tenSanPham, tenMau, kichCo, maSku, maVachSku, giaBan, trangThai, tonKho, soLuong? }).
 * - `maPhieu`: số phiếu nhập khi `nguon` = "phieu".
 * - `onDatGia(dong)`: quản trị viên bấm "Đặt giá" ở dòng chưa có giá (không truyền thì không có nút).
 * - `onDaIn()`: gọi khi đóng hộp sau ít nhất một lần mở hộp thoại in.
 * Dòng không in được chỉ bị bỏ qua (ghi lý do), không chặn cả lần in. In xong hộp vẫn mở (trình duyệt không cho biết
 * người dùng bấm In hay Hủy trong hộp thoại in), nên in lại hay sửa số tem không phải quét lại từ đầu.
 */
export default function HopInTem({ open, onOpenChange, nguon = "chon", dong = [], maPhieu, onDatGia, onDaIn }) {
  // Đã mở hộp thoại in ít nhất một lần trong lần mở hộp này: hộp đóng (nút, dấu X, Esc, bấm ra ngoài, hay trang tự
  // đóng khi bấm "Đặt giá") thì báo onDaIn một lần
  const daInRef = useRef(false);
  useEffect(() => {
    if (open || !daInRef.current) return;
    daInRef.current = false;
    onDaIn?.();
  }, [open, onDaIn]);
  const dongHop = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={(mo) => (mo ? onOpenChange(true) : dongHop())}>
      {open ? (
        <NoiDung
          nguon={nguon}
          dongBanDau={dong}
          maPhieu={maPhieu}
          onDatGia={onDatGia}
          onDaMoIn={() => {
            daInRef.current = true;
          }}
          onDong={dongHop}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ nguon, dongBanDau, maPhieu, onDatGia, onDaMoIn, onDong }) {
  const id = useId();
  const cauHinh = useTaiDuLieu(() => temSanPhamService.cauHinh(), "cau-hinh-tem");
  const [dsDong, setDsDong] = useState(() => boDongTrung(dongBanDau.map((d) => ({ ...d }))));
  const [cheDo, setCheDo] = useState(() => cheDoMacDinh(nguon));
  const [soTemDaSua, setSoTemDaSua] = useState({});
  const [mauChon, setMauChon] = useState(null);
  const [quet, setQuet] = useState("");
  const [quetMsg, setQuetMsg] = useState(null);
  const [dangTra, setDangTra] = useState(false);
  const [xacNhan, setXacNhan] = useState(false);
  // Kiểu in đang chạy ("in" | "pdf"); tờ in (có thể hàng nghìn tem) chỉ dựng lúc này, không dựng lại mỗi lần sửa số tem
  const [dangIn, setDangIn] = useState(null);
  // Số tem của lần mở hộp thoại in gần nhất (null: chưa in lần nào)
  const [daIn, setDaIn] = useState(null);
  const toRef = useRef(null);
  const dangInRef = useRef(false);
  const quetRef = useRef(null);
  // Mã quét liên tiếp lúc đang tra máy chủ: xếp hàng, xử lý lần lượt (không mất lần quét, không dính chuỗi)
  const hangDoiRef = useRef([]);
  const dangXuLyRef = useRef(false);
  const dsDongRef = useRef(dsDong);
  const soTemRef = useRef(soTemDaSua);
  const khoRef = useRef(null);
  const cheDoRef = useRef(cheDo);
  useEffect(() => {
    dsDongRef.current = dsDong;
  }, [dsDong]);
  useEffect(() => {
    soTemRef.current = soTemDaSua;
  }, [soTemDaSua]);

  const ch = cauHinh.data;
  const daCoCauHinh = Boolean(ch) || Boolean(cauHinh.error);
  const khoCauHinh = ch?.kho && KHO_TEM[ch.kho] ? ch.kho : KHO_TEM_MAC_DINH;
  const maKho = mauChon ?? khoCauHinh;
  const kho = layKhoTem(maKho);
  useEffect(() => {
    khoRef.current = kho;
    cheDoRef.current = cheDo;
  });
  const nguong = ch?.nguongXacNhan > 0 ? ch.nguongXacNhan : NGUONG_MAC_DINH;
  const inTenCuaHang = Boolean(ch?.inTenCuaHang);
  const inSku = Boolean(ch?.inSku);
  const tenCuaHang = ch?.tenCuaHang ?? null;
  const suaCauHinh = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const xemCauHinh = suaCauHinh || hasAnyRole([ROLES.QUAN_LY_KHO]);

  const lan = dungLanIn({ dong: dsDong, cheDo, soTemDaSua, kho });
  const lyDoCua = new Map(lan.boQua.map((b) => [b.dong.id, b.lyDo]));
  const temDau = lan.hang[0]?.[0] ?? null;
  // Tem xem trước phóng vừa khung (tối đa 280 px, trừ đệm 2 × 12 px): màn hẹp tự thu nhỏ, không cuộn ngang
  const khungXemTruoc = usePreviewViewportSize();
  const rongXemTruoc = khungXemTruoc.width ? Math.min(280, khungXemTruoc.width - 24) : 280;
  const cacCheDo = [
    ...(nguon === "phieu" ? [[CHE_DO_SO_TEM.nhap, "Theo SL nhập"]] : []),
    [CHE_DO_SO_TEM.ton, "Theo tồn"],
    [CHE_DO_SO_TEM.mot, "1 tem mỗi SKU"],
  ];
  const nguonTxt =
    nguon === "phieu"
      ? `Từ phiếu nhập ${maPhieu ?? ""} · số tem bằng số lượng thực nhận`
      : nguon === "doi-gia"
        ? "Sau khi đổi giá · thay tem giá cũ cho hàng đang tồn"
        : `${formatNumber(dsDong.length)} SKU đã chọn`;

  const doiCheDo = (giaTri) => {
    if (giaTri === cheDo) return;
    setCheDo(giaTri);
    setSoTemDaSua({});
    setXacNhan(false);
  };

  const datSoTem = (dong, giaTri) => {
    setXacNhan(false);
    setSoTemDaSua((cu) => ({ ...cu, [dong.id]: gioiHanSoTem(giaTri) }));
  };

  /** Quét trúng một dòng: +1 tem (dòng mới thêm thì 1 tem); dòng đang bị bỏ qua thì báo lý do, không cộng. */
  const themMotTem = (d, laDongMoi) => {
    const nhan = `${d.tenSanPham} · ${nhanBienThe(d)}`;
    const lyDo = lyDoBoQua(d, khoRef.current ?? kho);
    if (lyDo) {
      setQuetMsg({ ok: false, chu: `${nhan} · ${lyDo}, không in được` });
      return;
    }
    setXacNhan(false);
    const soMoi = gioiHanSoTem(laDongMoi ? 1 : soTemCuaDong(d, cheDoRef.current, soTemRef.current) + 1);
    soTemRef.current = { ...soTemRef.current, [d.id]: soMoi };
    setSoTemDaSua(soTemRef.current);
    setQuetMsg({ ok: true, chu: `+1 tem · ${nhan} · nay ${formatNumber(soMoi)} tem` });
  };

  const xuLyMa = async (ma) => {
    const coSan = timDongTheoMa(dsDongRef.current, ma);
    if (coSan) {
      themMotTem(coSan, false);
      return;
    }
    setDangTra(true);
    try {
      const timThay = await temSanPhamService.traMa(ma);
      if (!timThay) {
        setQuetMsg({ ok: false, chu: `Không có SKU mang mã ${ma}` });
        return;
      }
      const moi = chuanHoaDongInTem(timThay);
      const daCo = dsDongRef.current.find((d) => d.id === moi.id);
      if (daCo) {
        themMotTem(daCo, false);
        return;
      }
      dsDongRef.current = [...dsDongRef.current, moi];
      setDsDong((cu) => (cu.some((d) => d.id === moi.id) ? cu : [...cu, moi]));
      themMotTem(moi, true);
    } catch (error) {
      setQuetMsg({ ok: false, chu: getApiErrorMessage(error, `Không tra được mã ${ma}`) });
    } finally {
      setDangTra(false);
    }
  };

  const quetMa = async () => {
    const ma = quet.trim();
    if (!ma) return;
    setQuet("");
    hangDoiRef.current.push(ma);
    if (dangXuLyRef.current) return;
    dangXuLyRef.current = true;
    try {
      while (hangDoiRef.current.length) await xuLyMa(hangDoiRef.current.shift());
    } finally {
      dangXuLyRef.current = false;
    }
  };

  const xongIn = () => {
    dangInRef.current = false;
    setDangIn(null);
  };
  const inTem = useReactToPrint({
    contentRef: toRef,
    documentTitle: nguon === "phieu" && maPhieu ? `Tem sản phẩm - ${maPhieu}` : "Tem sản phẩm",
    pageStyle: getLabelPageCss(kho),
    // Gọi cả khi người dùng bấm Hủy trong hộp thoại in: chỉ ghi nhận, giữ hộp mở để in lại / đóng khi xong
    onAfterPrint: () => {
      const tong = lan.tong;
      xongIn();
      // In lại lần nữa vẫn phải xác nhận ngưỡng
      setXacNhan(false);
      setDaIn(tong);
      onDaMoIn();
    },
    onPrintError: () => {
      xongIn();
      setXacNhan(false);
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    },
  });
  // Tờ in vừa dựng xong thì mở hộp thoại in
  useEffect(() => {
    if (!dangIn) return;
    if (!toRef.current) {
      xongIn();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
      return;
    }
    try {
      inTem();
    } catch {
      xongIn();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
      return;
    }
    // Thư viện có lúc không gọi lại (khung in không dựng được, stylesheet treo): sau 20 giây thì mở khóa hộp. Lúc hộp
    // thoại in đang mở, trình duyệt dừng hẹn giờ của trang nên không nhả khóa giữa chừng.
    const henGio = window.setTimeout(() => {
      if (!dangInRef.current) return;
      xongIn();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    }, 20000);
    return () => window.clearTimeout(henGio);
    // Chỉ chạy khi bắt đầu một lần in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangIn]);
  const batDauIn = (kieu) => {
    if (!lan.tong || dangInRef.current || !daCoCauHinh) return;
    // Cả "Tải PDF" cũng qua ngưỡng: hộp thoại in lúc đó vẫn chọn được máy in tem
    if (lan.tong > nguong && !xacNhan) {
      setXacNhan(true);
      return;
    }
    if (kieu === "pdf") toast.info("Đang mở hộp thoại in · chọn “Lưu thành PDF”");
    dangInRef.current = true;
    setDangIn(kieu);
  };

  return (
    <DialogContent
      showCloseButton={!dangIn}
      onEscapeKeyDown={(event) => {
        // Đang mở bản in: không đóng giữa chừng. Esc trong ô quét còn chữ: chỉ xóa ô, không mất danh sách đã quét
        if (dangIn) event.preventDefault();
        else if (quet && document.activeElement === quetRef.current) {
          event.preventDefault();
          setQuet("");
        }
      }}
      onInteractOutside={(event) => {
        if (dangIn) event.preventDefault();
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        quetRef.current?.focus();
      }}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(1040px,calc(100%-2rem))]"
    >
      <DialogHeader className="shrink-0 border-b border-bo-border px-5 py-4 pr-12 text-left">
        <DialogTitle className="text-[17px] text-bo-foreground">In tem sản phẩm</DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">{nguonTxt}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-wrap gap-5 overflow-y-auto px-5 py-4">
        {/* Trái: danh sách SKU */}
        <div className="flex min-w-0 flex-[999_1_540px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span id={`${id}-che-do`} className="text-[13px] text-slate-600">Số tem</span>
            <div
              role="radiogroup"
              aria-labelledby={`${id}-che-do`}
              onKeyDown={(event) => {
                const buoc = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
                if (!buoc) return;
                event.preventDefault();
                const viTri = cacCheDo.findIndex(([giaTri]) => giaTri === cheDo);
                const moi = (viTri + buoc + cacCheDo.length) % cacCheDo.length;
                doiCheDo(cacCheDo[moi][0]);
                event.currentTarget.querySelectorAll("[role=radio]")[moi]?.focus();
              }}
              className="inline-flex gap-0.5 rounded-[7px] bg-slate-100 p-[3px]"
            >
              {cacCheDo.map(([giaTri, nhan]) => {
                const chon = cheDo === giaTri;
                return (
                  <button
                    key={giaTri}
                    type="button"
                    role="radio"
                    aria-checked={chon}
                    tabIndex={chon ? 0 : -1}
                    onClick={() => doiCheDo(giaTri)}
                    className={cn(
                      "h-[30px] whitespace-nowrap rounded-[5px] px-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                      chon ? "bg-white text-bo-foreground shadow-[0_1px_2px_rgba(15,23,42,0.12)]" : "text-slate-600 hover:text-bo-foreground",
                    )}
                  >
                    {nhan}
                  </button>
                );
              })}
            </div>
            <label className="relative ml-auto flex w-full items-center sm:w-[230px]">
              <span className="sr-only">Quét mã để thêm 1 tem</span>
              <ScanBarcode className="pointer-events-none absolute left-2.5 size-[15px] text-bo-muted" aria-hidden="true" />
              <input
                ref={quetRef}
                value={quet}
                onChange={(event) => setQuet(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    quetMa();
                  }
                }}
                placeholder="Quét mã để thêm 1 tem"
                autoComplete="off"
                className="h-[34px] w-full rounded-md border border-bo-border bg-white pr-2.5 pl-8 text-[13px] text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
              />
              {dangTra ? <Loader2 className="absolute right-2.5 size-3.5 animate-spin text-bo-muted" aria-hidden="true" /> : null}
            </label>
          </div>
          {/* Vùng thông báo luôn có sẵn (rỗng khi chưa quét) để trình đọc màn hình đọc được mỗi lần quét */}
          <p role="status" className={cn("-mt-1 text-[12.5px]", !quetMsg && "sr-only", quetMsg?.ok ? "text-bo-success" : "text-red-700")}>
            {quetMsg?.chu}
          </p>

          <div className="overflow-x-auto rounded-lg border border-bo-border">
            <div className="min-w-[460px]">
              <div className={cn(COT, "border-b border-[#eef1f5] bg-bo-surface-subtle text-[11px] font-semibold uppercase tracking-wide text-bo-muted *:px-2.5 *:py-2")}>
                <div>SKU</div>
                <div className="text-right">Giá trên tem</div>
                <div className="text-right">{nguon === "phieu" ? "SL nhập" : "Tồn"}</div>
                <div className="text-right">Số tem</div>
              </div>
              <div className="max-h-[340px] overflow-y-auto">
                {dsDong.length ? (
                  dsDong.map((d) => {
                    const lyDo = lyDoCua.get(d.id);
                    const soTem = soTemCuaDong(d, cheDo, soTemDaSua);
                    const nhanSo = d.maSku || d.maVachSku || `#${d.id}`;
                    return (
                      <div key={d.id} className={cn(COT, "border-b border-[#eef1f5] text-[13px] last:border-b-0 *:min-w-0 *:px-2.5 *:py-2", lyDo && "bg-[#fafafa]")}>
                        <div>
                          <p className="truncate font-medium">{d.tenSanPham}</p>
                          <p className="mt-px truncate text-xs text-bo-muted">
                            {[nhanBienThe(d), d.maVachSku].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {lyDo ? (
                            <p className="mt-[3px] flex flex-wrap items-center gap-1.5 text-xs text-red-700">
                              <Ban className="size-[13px] shrink-0" aria-hidden="true" />
                              {lyDo}
                              {lyDo === LY_DO_BO_QUA.chuaGia && onDatGia ? (
                                <button
                                  type="button"
                                  disabled={Boolean(dangIn)}
                                  onClick={() => onDatGia(d)}
                                  className="font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                                >
                                  Đặt giá
                                </button>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right font-semibold tabular-nums">{Number(d.giaBan) > 0 ? formatNumber(d.giaBan) : "—"}</div>
                        <div className="text-right tabular-nums text-bo-muted">{formatNumber(nguon === "phieu" ? d.soLuong : d.tonKho)}</div>
                        <div className="flex justify-end">
                          {lyDo ? (
                            <span className="text-[12.5px] text-slate-400">Bỏ qua</span>
                          ) : (
                            <span className="inline-flex">
                              <button
                                type="button"
                                aria-label={`Bớt 1 tem ${nhanSo}`}
                                disabled={!(soTem > 0)}
                                onClick={() => datSoTem(d, soTem - 1)}
                                className="inline-flex h-[30px] w-7 items-center justify-center rounded-l-md border border-bo-border bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus className="size-3" aria-hidden="true" />
                              </button>
                              <label>
                                <span className="sr-only">Số tem cho {nhanSo}</span>
                                <input
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={String(soTem)}
                                  onChange={(event) => {
                                    const so = event.target.value.replace(/\D/g, "").slice(0, 4);
                                    datSoTem(d, so === "" ? 0 : Number(so));
                                  }}
                                  className="h-[30px] w-12 border-y border-bo-border bg-white text-center text-[13px] tabular-nums text-bo-foreground focus:border-bo-primary focus:outline-none"
                                />
                              </label>
                              <button
                                type="button"
                                aria-label={`Thêm 1 tem ${nhanSo}`}
                                disabled={soTem >= 9999}
                                onClick={() => datSoTem(d, soTem + 1)}
                                className="inline-flex h-[30px] w-7 items-center justify-center rounded-r-md border border-bo-border bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="size-3" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-3 py-8 text-center text-[13px] text-bo-muted">Chưa có SKU nào. Quét mã để thêm tem.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Phải: mẫu tem + xem trước */}
        <div className="flex min-w-0 flex-[1_1_330px] flex-col gap-2.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700">
            Mẫu tem
            <select
              value={maKho}
              onChange={(event) => {
                setMauChon(event.target.value);
                setXacNhan(false);
              }}
              className="h-9 rounded-md border border-bo-border bg-white px-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
            >
              {Object.values(KHO_TEM).map((k) => (
                <option key={k.ma} value={k.ma}>
                  {k.rongTem} × {k.caoTem} mm · {k.soCot} tem/hàng{k.ma === khoCauHinh ? " (đang dùng)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="-mt-0.5 flex justify-between gap-2 text-xs text-bo-muted">
            <span>Cuộn {kho.rongCuon} mm · CODE128 · giá đã gồm thuế</span>
            {xemCauHinh ? (
              <Link to="/settings/print-templates" className="shrink-0 font-medium text-bo-primary hover:text-bo-primary-hover">
                {suaCauHinh ? "Sửa trong Cấu hình" : "Xem trong Cấu hình"}
              </Link>
            ) : null}
          </div>
          {cauHinh.error ? (
            <p className="text-xs text-amber-700">Không tải được cấu hình tem, đang dùng tem 35 × 22 mm và chưa in tên cửa hàng, SKU.</p>
          ) : null}
          <div ref={khungXemTruoc.ref} className="flex flex-col items-center gap-2.5 overflow-x-auto rounded-lg bg-bo-canvas px-3 py-[18px]">
            {temDau ? (
              // Một tem phóng to cho đọc được chữ (cách xếp trên cuộn đã ghi ở ô Mẫu tem)
              <div className="shrink-0 overflow-hidden rounded-[4px] shadow-[0_1px_3px_rgba(15,23,42,0.18)]">
                <TemSanPham
                  dong={temDau}
                  kho={kho}
                  inTenCuaHang={inTenCuaHang}
                  tenCuaHang={tenCuaHang}
                  inSku={inSku}
                  pxMoiMm={pxMoiMmXemTruoc(kho, rongXemTruoc)}
                />
              </div>
            ) : (
              <p className="py-[30px] text-[13px] text-bo-muted">Chưa có tem hợp lệ để xem trước</p>
            )}
            <span className="text-xs text-bo-muted">Xem trước tem đầu tiên (phóng to)</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-bo-border bg-white px-3 py-2.5 text-[12.5px] text-slate-600">
            <Info className="mt-px size-[15px] shrink-0 text-bo-muted" aria-hidden="true" />
            <span>
              Trong hộp thoại in, chọn máy in tem, <b>Lề: Không</b> và <b>Tỷ lệ: 100%</b>.
            </span>
          </div>
        </div>
      </div>

      {xacNhan ? (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-t border-orange-200 bg-orange-50 px-5 py-2.5 text-[13px] text-orange-800">
          <TriangleAlert className="size-[15px] shrink-0" aria-hidden="true" />
          Lần in này có {formatNumber(lan.tong)} tem, vượt ngưỡng {formatNumber(nguong)} tem đặt trong Cấu hình. Bấm lần nữa để xác nhận.
        </div>
      ) : null}

      <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t border-bo-border bg-[#fafbfc] px-5 py-3 sm:justify-end">
        <span className="mr-auto text-sm text-slate-700">
          Tổng <b className="font-semibold">{formatNumber(lan.tong)} tem</b> · {formatNumber(lan.hang.length)} hàng · {formatNumber(lan.soSku)} SKU
          {lan.boQua.length ? <span className="text-red-700"> · {formatNumber(lan.boQua.length)} bỏ qua</span> : null}
          {daIn !== null ? <span className="block text-[12.5px] text-bo-muted">Đã mở hộp thoại in {formatNumber(daIn)} tem · in xong bấm Đóng</span> : null}
        </span>
        <Button type="button" variant="outline" onClick={onDong} disabled={Boolean(dangIn)} className={NUT_PHU}>
          {daIn !== null ? "Đóng" : "Hủy"}
        </Button>
        <Button type="button" variant="outline" onClick={() => batDauIn("pdf")} disabled={!lan.tong || Boolean(dangIn) || !daCoCauHinh} className={NUT_PHU}>
          <Download className="size-4" aria-hidden="true" />
          Tải PDF
        </Button>
        <Button type="button" onClick={() => batDauIn("in")} disabled={!lan.tong || Boolean(dangIn) || !daCoCauHinh} className={NUT_CHINH}>
          {dangIn || !daCoCauHinh ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
          {dangIn
            ? "Đang mở bản in…"
            : !daCoCauHinh
              ? "Đang tải cấu hình tem…"
              : xacNhan
                ? `Xác nhận in ${formatNumber(lan.tong)} tem`
                : `In ${formatNumber(lan.tong)} tem`}
        </Button>
      </DialogFooter>

      {/* Tờ in: chỉ dựng khi đang in; react-to-print chép ra khung in, không hiện trên màn hình */}
      {dangIn ? (
        <div className="hidden" aria-hidden="true">
          <ToTem ref={toRef} hang={lan.hang} kho={kho} inTenCuaHang={inTenCuaHang} tenCuaHang={tenCuaHang} inSku={inSku} />
        </div>
      ) : null}
    </DialogContent>
  );
}
