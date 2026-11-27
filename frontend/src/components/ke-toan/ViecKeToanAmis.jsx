import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, PencilLine, ReceiptText } from "lucide-react";
import { AN_DIEN_THOAI, BANG, CHI_DIEN_THOAI, DONG, DONG_TIEU_DE, O, O_CUOI, O_DAU, O_TIEU_DE } from "@/components/chung-tu/kieuBang";
import { duongDanChungTu, tenLoai } from "@/components/ke-toan/tinhKeToan";
import { congHoaDon, tangMacDinh, xepViecKeToan } from "@/components/ke-toan/viecKeToan";
import { PHUONG_AN_CHENH_LECH, tenTheoMa } from "@/constants/phieuChuyenKho";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { t, tDuLieu } from "@/i18n";

const GACH = <span className="text-bo-muted">—</span>;
const SO = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
/** Số lượng có dấu: "+1" nhập vào, "−2" xuất ra (dấu trừ thật, cùng bề rộng với dấu cộng). */
const soCoDau = (v) => {
  const n = Number(v ?? 0);
  return n > 0 ? `+${SO.format(n)}` : n < 0 ? `−${SO.format(-n)}` : "0";
};
const tien = (v) => (v == null ? GACH : <span className="whitespace-nowrap">{formatCurrency(v)}</span>);

// Số dòng hiện trước nút "Xem thêm": việc cần làm hiện nhiều hơn, việc để biết hiện ít
const GIOI_HAN = { lam: 10, cho: 5, xong: 5 };

const KIEU_TANG = {
  lam: { icon: PencilLine, mau: "bg-bo-tt-chu-y text-bo-tt-chu-y-chu" },
  cho: { icon: ReceiptText, mau: "bg-bo-tt-dang text-bo-tt-dang-chu" },
  xong: { icon: CircleCheck, mau: "bg-bo-tt-xong text-bo-tt-xong-chu" },
};

/** Mã chứng từ: liên kết tới màn chi tiết khi loại đó có màn, không thì chữ thường. */
export function MaChungTu({ loai, idNguon, so, nguon }) {
  const den = duongDanChungTu(loai, idNguon, nguon);
  if (!so) return <span className="text-bo-muted">{tenLoai(loai)}</span>;
  return den ? (
    <Link to={den} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{so}</Link>
  ) : (
    <span className="whitespace-nowrap font-medium text-bo-foreground">{so}</span>
  );
}

/** Câu dài của máy chủ: thu còn 2 dòng, chỉ hiện "Xem đủ" khi chữ thật sự bị cắt (đo theo bề rộng ô). */
export function GhiChu({ noiDung }) {
  const [mo, setMo] = useState(false);
  const [dai, setDai] = useState(false);
  const ref = useRef(null);
  const chu = tDuLieu(noiDung);
  useLayoutEffect(() => {
    const p = ref.current;
    if (!p || mo) return undefined;
    const do0 = () => setDai(p.scrollHeight > p.clientHeight + 1);
    do0();
    if (typeof ResizeObserver === "undefined") return undefined;
    const theoDoi = new ResizeObserver(do0);
    theoDoi.observe(p);
    return () => theoDoi.disconnect();
  }, [chu, mo]);
  return (
    <>
      <p ref={ref} className={cn("text-[13px] leading-5 text-slate-600", !mo && "line-clamp-2")}>{chu}</p>
      {dai ? (
        <button type="button" onClick={() => setMo((m) => !m)} aria-expanded={mo}
          className="mt-0.5 rounded text-xs font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
          {mo ? t("Thu gọn") : t("Xem đủ")}
        </button>
      ) : null}
    </>
  );
}

/** Cách xử lý chênh lệch chuyển kho: giao bù (kho gửi chuyển bù) hay ghi giảm hao hụt (hàng mất hẳn). */
const PhuongAn = ({ ma }) => {
  if (!ma) return GACH;
  const giaoBu = ma === "GIAO_BU_HANG";
  return (
    <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium",
      giaoBu ? "bg-bo-tt-dang text-bo-tt-dang-chu" : "bg-bo-tt-chu-y text-bo-tt-chu-y-chu")}>
      {t(tenTheoMa(PHUONG_AN_CHENH_LECH, ma))}
    </span>
  );
};

const ChungTu = ({ v }) => (
  <>
    <MaChungTu loai={v.loai} idNguon={v.idNguon} so={v.soChungTu} nguon={v.chiTiet?.nguon} />
    {v.loTruoc ? <span className="block text-xs leading-4 text-bo-muted">{t("Đã giao ở lô trước")}</span> : null}
  </>
);

/** Số đơn bán: liên kết tới màn đơn khi máy chủ gửi kèm id đơn (lấy từ phiếu xuất bán), không thì chữ thường. */
const SoDon = ({ so, id }) => {
  if (!so) return GACH;
  return id ? (
    <Link to={`/sales-orders/${id}`} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{so}</Link>
  ) : <span className="font-medium text-bo-foreground">{so}</span>;
};

/** Dòng phụ dưới ô đầu khi khối hẹp (cột phụ đã ẩn): các giá trị nối bằng " · ". */
const DongPhu = ({ ds }) => {
  const phan = ds.filter((x) => x != null && x !== "");
  return phan.length ? <span className={cn("block text-xs leading-4 text-bo-muted", CHI_DIEN_THOAI)}>{phan.join(" · ")}</span> : null;
};

/**
 * Cột của từng kiểu bảng: `[nhan, lopTh, oDau(v) | o(v), { an, phai }]`. Cột đầu luôn hiện, `an` = ẩn khi khối hẹp,
 * `phai` = canh phải (cột số, tiền). `phu(v)`: các giá trị đưa xuống dòng phụ của ô đầu khi khối hẹp.
 */
function cotCua(nhom) {
  const ct = (v) => v.chiTiet ?? {};
  switch (nhom.bang) {
    case "haoHut":
      return {
        cot: [
          [t("Chứng từ"), "w-56", (v) => (
            <>
              {v.idNguon ? (
                <Link to={`/transfer-tickets/adjustments/${v.idNguon}`} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{v.soChungTu}</Link>
              ) : <ChungTu v={v} />}
              {/* Biên bản giao nhận và phiếu chuyển: mỗi mã một dòng, không bẻ giữa mã */}
              {[ct(v).soBienBan, ct(v).soPhieuChuyen].filter(Boolean).map((so) => (
                <span key={so} className={cn("block whitespace-nowrap text-xs leading-4 text-bo-muted", AN_DIEN_THOAI)}>{so}</span>
              ))}
            </>
          )],
          [t("Kho"), "w-32", (v) => ct(v).maKho ?? GACH, { an: true }],
          [t("Số lượng"), "w-24", (v) => soCoDau(ct(v).soLuong), { phai: true }],
          [t("Cách xử lý"), "w-40", (v) => <PhuongAn ma={ct(v).phuongAn} />, { an: true }],
          [t("Lý do"), "", (v) => (ct(v).ghiChu ? <span className="text-[13px] leading-5 text-slate-600">{tDuLieu(ct(v).ghiChu)}</span> : GACH), { an: true }],
        ],
        phu: (v) => [ct(v).soBienBan, ct(v).soPhieuChuyen, ct(v).phuongAn ? t(tenTheoMa(PHUONG_AN_CHENH_LECH, ct(v).phuongAn)) : null, ct(v).ghiChu],
      };
    case "kho":
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Kho"), "w-36", (v) => ct(v).maKho ?? GACH, { an: true }],
          [t("Số lượng"), "w-24", (v) => soCoDau(ct(v).soLuong), { phai: true }],
          [nhom.nhanGhiChu ?? t("Ghi chú"), "", (v) => (ct(v).ghiChu ? <span className="text-[13px] leading-5 text-slate-600">{tDuLieu(ct(v).ghiChu)}</span> : GACH), { an: true }],
        ],
        phu: (v) => [ct(v).maKho, ct(v).ghiChu],
      };
    case "don":
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Đơn"), "", (v) => <SoDon so={ct(v).soDon} id={ct(v).idDon} />, { an: true }],
          ...(nhom.coPhieuXuat ? [[t("Từ phiếu xuất"), "w-48", (v) => ct(v).phieuXuat ?? GACH, { an: true }]] : []),
          [t("Kho"), "w-36", (v) => ct(v).maKho ?? GACH, { an: true }],
          [t("Số lượng"), "w-24", (v) => soCoDau(ct(v).soLuong), { phai: true }],
        ],
        phu: (v) => [ct(v).soDon, ct(v).maKho],
      };
    case "cap": {
      const lech = nhom.ma === "lech_don_huy";
      return {
        cot: [
          [t("Đơn"), "w-56", (c) => <SoDon so={c.soDon} id={c.xuat?.chiTiet?.idDon} />],
          [t("Phiếu xuất"), "w-48", (c) => (c.xuat ? <MaChungTu loai={c.xuat.loai} idNguon={c.xuat.idNguon} so={c.xuat.soChungTu} nguon={c.xuat.chiTiet?.nguon} /> : GACH), { an: true }],
          [t("Phiếu nhập lại"), "", (c) => (c.nhap.length ? (
            <span className="grid gap-0.5">
              {c.nhap.map((v) => (
                <span key={v.khoa}><MaChungTu loai={v.loai} idNguon={v.idNguon} so={v.soChungTu} nguon={v.chiTiet?.nguon} />{lech ? <span className="text-bo-muted"> {soCoDau(v.chiTiet?.soLuong)}</span> : null}</span>
              ))}
            </span>
          ) : GACH), { an: true }],
          [t("Kho"), "w-36", (c) => c.maKho ?? GACH, { an: true }],
          [t("Xuất / nhập lại"), "w-32", (c) => `${soCoDau(c.soXuat)} / ${soCoDau(c.soNhap)}`, { phai: true }],
          ...(lech ? [[t("Chênh"), "w-28", (c) => (
            <span className="whitespace-nowrap font-medium text-bo-tt-chu-y-chu">
              {c.chenh > 0 ? t("Nhập dư {{so}}", { so: SO.format(c.chenh) }) : t("Nhập thiếu {{so}}", { so: SO.format(-c.chenh) })}
            </span>
          ), { phai: true }]] : []),
        ],
        phu: (c) => [c.xuat?.soChungTu, ...c.nhap.map((v) => v.soChungTu), c.maKho],
      };
    }
    case "hoaDon":
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Nhà cung cấp"), "", (v) => ct(v).nhaCungCap ?? GACH, { an: true }],
          [t("Giá trị hàng"), "w-40", (v) => tien(ct(v).giaTri), { phai: true, an: true }],
          [t("Thuế chờ hóa đơn"), "w-44", (v) => (
            <>
              {tien(ct(v).thue)}
              {ct(v).thueSuat != null ? <span className="block text-xs leading-4 text-bo-muted">{t("thuế {{ts}}%", { ts: SO.format(ct(v).thueSuat) })}</span> : null}
            </>
          ), { phai: true }],
        ],
        phu: (v) => [ct(v).nhaCungCap],
        cong: (dong) => {
          const c = congHoaDon(dong);
          return [t("Cộng {{count}} phiếu", { count: dong.length }), null, tien(c.giaTri), tien(c.thue)];
        },
      };
    case "phieuThu":
      return {
        cot: [
          [t("Chứng từ"), "", (v) => <ChungTu v={v} />],
          [t("Tiền mặt"), "w-40", (v) => <>{tien(ct(v).tienMat)}{ct(v).tkTienMat ? <span className="block text-xs leading-4 text-bo-muted">{t("vào TK {{tk}}", { tk: ct(v).tkTienMat })}</span> : null}</>, { phai: true }],
          [t("Chuyển khoản"), "w-40", (v) => <>{tien(ct(v).chuyenKhoan)}{ct(v).tkNganHang ? <span className="block text-xs leading-4 text-bo-muted">{t("vào TK {{tk}}", { tk: ct(v).tkNganHang })}</span> : null}</>, { phai: true }],
          [t("Cộng"), "w-36", (v) => <span className="font-medium">{tien(Number(ct(v).tienMat ?? 0) + Number(ct(v).chuyenKhoan ?? 0))}</span>, { phai: true, an: true }],
        ],
        phu: () => [],
      };
    case "tien":
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Đơn"), "", (v) => <SoDon so={ct(v).soDon} id={ct(v).idDon} />, { an: true }],
          [nhom.nhanTien ?? t("Số tiền"), "w-40", (v) => (
            <>{tien(ct(v).soTien)}{ct(v).tkNganHang ? <span className="block text-xs leading-4 text-bo-muted">{t("từ TK {{tk}}", { tk: ct(v).tkNganHang })}</span> : null}</>
          ), { phai: true }],
        ],
        phu: (v) => [ct(v).soDon],
      };
    case "tonDauKy":
      return {
        cot: [
          [t("Chứng từ"), "", (v) => <ChungTu v={v} />],
          [t("Mặt hàng"), "w-28", (v) => (ct(v).soMatHang != null ? SO.format(ct(v).soMatHang) : GACH), { phai: true, an: true }],
          [t("Tách thuế"), "w-28", (v) => (ct(v).thueSuat != null ? `${SO.format(ct(v).thueSuat)}%` : GACH), { phai: true, an: true }],
          [t("Giá trị tồn"), "w-44", (v) => tien(ct(v).giaTri), { phai: true }],
        ],
        phu: () => [],
      };
    case "hangLoi":
      return {
        cot: [
          [t("Phiếu trả"), "w-52", (v) => <ChungTu v={v} />],
          [t("Chứng từ trên AMIS"), "", (v) => ct(v).chungTuAmis ?? GACH, { an: true }],
          [t("Hàng lỗi"), "w-28", (v) => (ct(v).soDong != null ? t("{{count}} dòng", { count: Number(ct(v).soDong) }) : GACH), { phai: true }],
        ],
        phu: (v) => [ct(v).chungTuAmis],
      };
    case "lo":
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Đã giao ở lô"), "", (v) => ct(v).soLo ?? GACH],
        ],
        phu: () => [],
      };
    default:
      return {
        cot: [
          [t("Chứng từ"), "w-52", (v) => <ChungTu v={v} />],
          [t("Nội dung"), "", (v) => <GhiChu noiDung={v.noiDung} />, { an: true }],
        ],
        phu: () => [],
        dongPhuDayDu: (v) => <div className={cn("mt-1", CHI_DIEN_THOAI)}><GhiChu noiDung={v.noiDung} /></div>,
      };
  }
}

/** Một việc: tiêu đề (động từ) + số, đường dẫn trên AMIS, câu cách làm, bảng; dài thì "Xem thêm". */
function NhomViec({ nhom, gioiHan, dau }) {
  const [moHet, setMoHet] = useState(false);
  const { cot, phu, cong, dongPhuDayDu } = cotCua(nhom);
  const hien = moHet ? nhom.dong : nhom.dong.slice(0, gioiHan);
  const conLai = nhom.dong.length - gioiHan;
  const cuoi = cot.length - 1;
  const khung = useRef(null);
  // Thu gọn sau khi đã cuộn xuống cuối danh sách dài: kéo đầu nhóm về lại tầm nhìn, không để người dùng lạc giữa trang
  const thuGon = () => {
    setMoHet(false);
    requestAnimationFrame(() => {
      const el = khung.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return (
    <div ref={khung} className={cn("scroll-mt-4", !dau && "border-t border-slate-100 pt-4")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-6">
        <h3 className="text-sm font-semibold leading-5 text-bo-foreground">
          {nhom.tieuDe} <span className="font-normal tabular-nums text-bo-muted">· {nhom.dong.length}</span>
        </h3>
        {nhom.amis ? (
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded-md border border-bo-border bg-white px-2 text-xs font-medium text-slate-600">
            {t("AMIS: {{duong}}", { duong: nhom.amis })}
          </span>
        ) : null}
      </div>
      <p className="mb-3 mt-1 max-w-3xl px-4 text-[13px] leading-5 text-slate-600 sm:px-6">{nhom.huongDan}</p>
      <div className="relative overflow-x-auto">
        <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
          <thead>
            <tr className={cn(DONG_TIEU_DE, "border-t")}>
              {cot.map(([nhan, rong, , tuy = {}], i) => (
                <th key={i} scope="col"
                  className={cn(O_TIEU_DE, "py-2", rong, i === 0 && O_DAU, i === cuoi && O_CUOI, tuy.an && AN_DIEN_THOAI, tuy.phai && "text-right")}>
                  {nhan}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hien.map((v) => (
              <tr key={v.khoa} className={DONG}>
                {cot.map(([, , ve, tuy = {}], i) => (
                  <td key={i} className={cn(O, "py-2.5 align-top", i === 0 && O_DAU, i === cuoi && O_CUOI, tuy.an && AN_DIEN_THOAI, tuy.phai && "text-right")}>
                    {ve(v)}
                    {i === 0 ? <><DongPhu ds={phu(v)} />{dongPhuDayDu ? dongPhuDayDu(v) : null}</> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {cong ? (
            <tfoot>
              <tr className="tabular-nums">
                {cong(nhom.dong).map((o, i) => (
                  <td key={i} className={cn(O, "py-2.5", i === 0 ? cn(O_DAU, "font-medium text-bo-foreground") : "text-right font-semibold",
                    i === cuoi && O_CUOI, cot[i]?.[3]?.an && AN_DIEN_THOAI)}>
                    {o}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {conLai > 0 ? (
        <button type="button" onClick={moHet ? thuGon : () => setMoHet(true)} aria-expanded={moHet}
          className="block w-full border-b border-slate-100 py-2.5 pl-4 text-left text-[13px] font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30 sm:pl-6">
          {moHet ? t("Thu gọn") : t("Xem thêm {{count}} chứng từ", { count: conLai })}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Việc kế toán làm thêm trên AMIS ở màn Tạo lô xuất: ba thẻ chọn (Cần làm · Làm khi có hóa đơn · Không cần lập) kèm số,
 * bên dưới là các việc của thẻ đang chọn. Mặc định chọn thẻ đầu có việc. Không có việc nào thì không vẽ gì (kể cả `tieuDe`,
 * tiêu đề mục do màn truyền vào).
 */
export default function ViecKeToanAmis({ xemTruoc, idTieuDe, tieuDe }) {
  const tang = useMemo(() => xepViecKeToan(xemTruoc), [xemTruoc]);
  const macDinh = tangMacDinh(tang);
  const [chon, setChon] = useState(null);
  const refThe = useRef({});
  // Kiểm tra lại (đổi ngày) mà thẻ đang chọn hết việc thì về thẻ mặc định
  const dangChon = chon && tang.find((g) => g.ma === chon)?.soViec ? chon : macDinh;
  if (!macDinh) return null;
  const dsCo = tang.filter((g) => g.soViec > 0);
  const thue = congHoaDon(tang.find((g) => g.ma === "cho")?.nhom.flatMap((n) => n.dong) ?? []).thue;

  const diChuyen = (e) => {
    const i = dsCo.findIndex((g) => g.ma === dangChon);
    const buoc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!buoc) return;
    e.preventDefault();
    const moi = dsCo[(i + buoc + dsCo.length) % dsCo.length].ma;
    setChon(moi);
    refThe.current[moi]?.focus();
  };

  const g = tang.find((x) => x.ma === dangChon);
  return (
    <>
      {tieuDe}
      <div role="tablist" aria-labelledby={idTieuDe} onKeyDown={diChuyen}
        className="grid gap-2 px-4 pb-4 sm:px-6 @2xl/khoi:grid-cols-3">
        {tang.map((x) => {
          const kieu = KIEU_TANG[x.ma];
          const Icon = kieu.icon;
          const dang = x.ma === dangChon;
          const phu = x.ma === "lam" ? t("việc") : x.ma === "cho" ? (thue ? t("phiếu · thuế {{tien}}", { tien: formatCurrency(thue) }) : t("phiếu")) : t("để biết");
          return (
            <button key={x.ma} type="button" role="tab" id={`${idTieuDe}-the-${x.ma}`} aria-selected={dang}
              aria-controls={`${idTieuDe}-tang`} tabIndex={dang ? 0 : -1} disabled={!x.soViec}
              ref={(el) => { refThe.current[x.ma] = el; }} onClick={() => setChon(x.ma)}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-default disabled:opacity-60",
                dang ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border bg-white hover:bg-bo-surface-subtle",
              )}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", kieu.mau)}><Icon className="size-4" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className={cn("block text-[13px] leading-5", dang ? "font-medium text-bo-primary" : "text-bo-muted")}>{x.nhan}</span>
                <span className="block truncate text-lg font-semibold leading-6 tabular-nums text-bo-foreground">
                  {x.soViec} <span className="text-[13px] font-normal text-bo-muted">{phu}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${idTieuDe}-tang`} aria-labelledby={`${idTieuDe}-the-${dangChon}`} className="border-t border-bo-border pb-2 pt-4">
        <p className="mb-3 px-4 text-[13px] leading-5 text-bo-muted sm:px-6">{g.moTa}</p>
        {g.nhom.map((n, i) => <NhomViec key={`${g.ma}-${n.ma}`} nhom={n} gioiHan={GIOI_HAN[g.ma]} dau={i === 0} />)}
      </div>
    </>
  );
}
