import { useId, useRef } from "react";
import { Camera, Check, History, Loader2, Lock, MapPin, Minus, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { docSo, phanTrang, soVN } from "@/components/chung-tu/bangChungTu";
import { AN_DIEN_THOAI, BANG, CHI_DIEN_THOAI, DONG_SANG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_DAU, O_TIEU_DE } from "@/components/chung-tu/kieuBang";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CO_TRANG_DONG, NGUONG_CONG_CU } from "@/config/bangChungTu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/formatters";
import {
  GOI_Y_LY_DO,
  TEN_LOC,
  TT_DONG,
  chuChenhLech,
  docSoDem,
  laLech,
  nhomTheoKe,
  thieuLyDo,
  tienCoDau,
} from "./kiemKe";

// Số đếm tối đa trên một dòng (IKiemKe.SO_LUONG_TOI_DA ở máy chủ)
const SO_DEM_TOI_DA = 1_000_000;
const LY_DO_TOI_DA = 2000;

// Ký tự không phải chữ số trong ô đếm: máy quét gõ mã vào nhầm ô (quên Enter trước khi quét tem kế tiếp)
const MAU_KHONG_PHAI_SO = /[^\d\s]/;
// Các phím cách nhau dưới ngần này (ms) là máy quét gõ (người gõ chậm hơn nhiều)
const KHOANG_PHIM_MAY_QUET_MS = 50;
// Từ ngần này phím gõ liền mạch trở lên là mã quét (kể cả mã toàn chữ số)
const DO_DAI_MA_QUET = 6;

const MAU_CHENH = {
  thua: "text-bo-primary-strong",
  thieu: "text-bo-danger",
  khop: "text-bo-success",
};

const NUT_DEM =
  "grid w-8 place-items-center bg-slate-50 text-slate-600 outline-none hover:bg-slate-100 hover:text-bo-foreground focus-visible:bg-bo-primary-soft focus-visible:text-bo-primary-strong disabled:cursor-not-allowed disabled:opacity-40 @max-2xl/khoi:w-11 cam-ung:w-11";

const tenLo = (d) => d.loHang?.ma || "—";

/** Mã lô trên khối hẹp: chỉ xuống dòng sau dấu "-" (LO-PN202610251-01), không bẻ giữa dãy số. */
function ngatTaiGach(ma) {
  if (!ma) return "—";
  return ma.split("-").map((phan, i, ds) => (
    <span key={i}>
      {phan}
      {i < ds.length - 1 ? (
        <>
          -<wbr />
        </>
      ) : null}
    </span>
  ));
}

/**
 * Ô đếm − / số / +: gõ số nguyên (trống = chưa đếm), nhận tiêu điểm thì chọn sẵn số cũ. Enter lưu ngay rồi về ô quét;
 * rời ô thì lưu ngay phần đang chờ. Lỡ quét mã vào ô này: phần vừa quét chuyển sang ô quét (`onQuetNham`).
 */
function ODem({ d, onDoiSo, onRoiO, onXong, onQuetNham, idO }) {
  const so = d.soLuongThucTe == null ? null : docSo(d.soLuongThucTe);
  const doi = (moi, tuyChon) => onDoiSo(d.id, moi, tuyChon);
  const soKhiVaoRef = useRef(so);
  const gioPhimRef = useRef([]);
  // Lúc gõ phím đầu, ô có đang chọn hết chữ không (null: chưa gõ phím nào từ lúc vào ô)
  const giuTienToRef = useRef(null);
  return (
    <span
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-md border bg-bo-surface focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 @max-2xl/khoi:h-11 cam-ung:h-11",
        so == null ? "border-bo-input-border" : "border-bo-primary/40",
      )}
    >
      <button
        type="button"
        aria-label={`Bớt 1 ở lô ${tenLo(d)}, kệ ${d.viTri?.ma}`}
        disabled={so == null || so <= 0}
        onClick={() => doi(Math.max(0, (so ?? 0) - 1))}
        className={NUT_DEM}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <input
        id={idO}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`Số thực tế lô ${tenLo(d)}, kệ ${d.viTri?.ma}`}
        placeholder="Đếm"
        value={so == null ? "" : String(so)}
        onFocus={(e) => {
          soKhiVaoRef.current = so;
          gioPhimRef.current = [];
          giuTienToRef.current = null;
          e.currentTarget.select();
        }}
        onBlur={() => onRoiO(d.id)}
        onChange={(e) => {
          const chu = e.target.value;
          const gio = gioPhimRef.current;
          // Đuôi gõ liền mạch: máy quét gõ mỗi phím cách nhau dưới 50ms, người gõ chậm hơn nhiều
          let duoi = gio.length ? 1 : 0;
          for (let i = gio.length - 1; i > 0 && gio[i] - gio[i - 1] < KHOANG_PHIM_MAY_QUET_MS; i -= 1) duoi += 1;
          const chiSo = !MAU_KHONG_PHAI_SO.test(chu);
          // Mã vạch toàn chữ số (mã vạch biến thể tự sinh "20…") nhận ra bằng nhịp phím, hoặc khi số vượt mức đếm tối đa
          // (không cắt về 1.000.000 rồi lưu nhầm)
          const laMaQuet = !chiSo || duoi >= DO_DAI_MA_QUET || Number(chu.replace(/\s/g, "") || 0) > SO_DEM_TOI_DA;
          if (laMaQuet && onQuetNham) {
            const cu = soKhiVaoRef.current;
            const tatCaLienMach = duoi >= 2 && duoi >= gio.length;
            // Toàn chữ số: chỉ tách "số người gõ + mã máy quét" khi đuôi liền mạch đủ dài; nhận ra vì vượt mức đếm mà đuôi ngắn
            // thì không đoán chỗ tách, trả số lúc vào ô (không bao giờ lưu nhầm một phần mã thành số đếm)
            const viTri = tatCaLienMach
              ? 0
              : chiSo
                ? duoi >= DO_DAI_MA_QUET ? chu.length - duoi : 0
                : duoi >= 2 ? chu.length - duoi : chu.search(MAU_KHONG_PHAI_SO);
            if (viTri <= 0) {
              // Cả chuỗi là mã quét (hoặc không rõ chỗ tách): trả số lúc vào ô. Số cũ chỉ còn đứng trước mã khi lúc gõ phím
              // đầu ô không chọn hết chữ
              const tienTo = giuTienToRef.current && cu != null ? String(cu) : "";
              if (cu !== so) doi(cu ?? null);
              onQuetNham(tienTo && chu.startsWith(tienTo) ? chu.slice(tienTo.length) : chu);
            } else {
              // Người gõ số đếm rồi máy quét gõ tiếp mã kế tiếp: giữ phần số, mã sang ô quét
              const phanSo = chu.slice(0, viTri);
              doi(phanSo.trim() ? docSoDem(phanSo, SO_DEM_TOI_DA) : cu ?? null);
              onQuetNham(chu.slice(viTri));
            }
            return;
          }
          doi(docSoDem(chu, SO_DEM_TOI_DA));
        }}
        onKeyDown={(e) => {
          if (e.key.length === 1) {
            if (giuTienToRef.current === null) {
              const o = e.currentTarget;
              giuTienToRef.current = !(o.selectionStart === 0 && o.selectionEnd === o.value.length);
            }
            gioPhimRef.current.push(e.timeStamp);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            // Chỉ gửi khi còn phần đang chờ (Enter trên ô không đổi không ghi đè người đếm / giờ đếm)
            if (d.dangGo) doi(so, { ngay: true });
            onXong?.();
          }
        }}
        className="w-16 border-x border-slate-200 bg-bo-surface text-center text-sm tabular-nums text-bo-foreground outline-none placeholder:text-slate-500 max-[380px]:w-11"
      />
      <button
        type="button"
        aria-label={`Thêm 1 ở lô ${tenLo(d)}, kệ ${d.viTri?.ma}`}
        disabled={(so ?? 0) >= SO_DEM_TOI_DA}
        onClick={() => doi((so ?? 0) + 1)}
        className={NUT_DEM}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Chênh lệch của dòng: "Thiếu 2" / "Thừa 1" / "Khớp" + giá trị; đếm mù chỉ "Đã đếm". */
function ChenhLech({ d, mu, canPhai = true }) {
  if (d.soLuongThucTe == null) {
    return <span className="whitespace-nowrap text-[13px] font-medium text-slate-500">Chưa đếm</span>;
  }
  if (mu) return <span className="whitespace-nowrap text-[13px] font-medium text-bo-foreground">Đã đếm</span>;
  const c = chuChenhLech(d);
  return (
    <span className={cn("block leading-5", canPhai && "text-right")}>
      <span className={cn("whitespace-nowrap font-semibold tabular-nums", MAU_CHENH[c.kieu])}>{c.chu}</span>
      {c.kieu !== "khop" && docSo(d.giaTriChenhLech) !== 0 ? (
        <span className="block whitespace-nowrap text-xs tabular-nums text-bo-muted">{tienCoDau(d.giaTriChenhLech)}</span>
      ) : null}
    </span>
  );
}

/** Ô cuối: đang lưu / lỗi lưu (bấm để gửi lại) / vừa lưu / trạng thái dòng. */
function TrangThaiDong({ d, tt, onThuLai }) {
  if (tt?.dang) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-bo-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Đang lưu
      </span>
    );
  }
  if (tt?.loi) {
    return (
      <button
        type="button"
        onClick={onThuLai}
        title={tt.loi}
        className="inline-flex items-center gap-1 rounded text-xs font-semibold text-bo-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-danger/30"
      >
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        Lưu lại
        <span className="sr-only">: {tt.loi}</span>
      </button>
    );
  }
  if (d.dangGo) return <span className="text-xs text-bo-muted">Chờ lưu…</span>;
  if (tt?.vuaLuu) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-bo-success">
        <Check className="size-3.5" aria-hidden="true" />
        Đã lưu
      </span>
    );
  }
  if (d.trangThai === TT_DONG.CAN_KIEM_LAI) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-bo-warning">
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Đếm lại
      </span>
    );
  }
  if (d.trangThai === TT_DONG.DA_XAC_NHAN) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-bo-muted" title="Quản lý đã xác nhận dòng này, không cần đếm lại">
        <Lock className="size-3.5" aria-hidden="true" />
        Đã xác nhận
      </span>
    );
  }
  return null;
}

/**
 * Dòng có dòng phụ (giải trình, ảnh, lịch sử) không. Đếm mù: không dựa vào lệch — dòng phụ hiện đúng lúc số đếm khác sổ
 * thì người đếm dò +/− là biết số trên sổ.
 */
const coDongPhu = (d, mu) =>
  (!mu && laLech(d)) ||
  Boolean(String(d.lyDoChenhLech ?? "").trim()) ||
  Boolean(d.lanTruoc?.length) ||
  Boolean(d.anh?.length) ||
  Boolean(d.phatSinh) ||
  d.trangThai === TT_DONG.CAN_KIEM_LAI;

/**
 * Dòng phụ dưới dòng lệch: giải trình (bắt buộc khi lệch, gợi ý chạm để điền), ảnh bằng chứng, lịch sử các lần đếm và
 * lý do yêu cầu đếm lại. Không lệch mà không có gì để xem thì không vẽ. Đếm mù: chỉ hiện khi đã có giải trình / ảnh /
 * lịch sử (thiếu giải trình báo ở nút Trình duyệt, tắt Đếm mù để xem dòng nào).
 */
function DongGiaiTrinh({ d, mu, suaDong, soCot, onDoiLyDo, onRoiLyDo, onMoAnh }) {
  const idLyDo = useId();
  const lech = !mu && laLech(d);
  const lanTruoc = Array.isArray(d.lanTruoc) ? d.lanTruoc : [];
  const yeuCauGanNhat = [...lanTruoc].reverse().find((l) => l.lyDoKiemLai);
  const soAnh = d.anh?.length ?? 0;
  const lyDo = d.lyDoChenhLech ?? "";
  const thieu = !mu && thieuLyDo(d);
  if (!coDongPhu(d, mu)) return null;
  return (
    <tr className="border-b border-slate-100 bg-slate-50/60">
      <td colSpan={soCot} className="px-4 pb-3 pt-1 sm:px-6">
        <div className="grid gap-2 @2xl/khoi:pl-12">
          {yeuCauGanNhat && d.trangThai === TT_DONG.CAN_KIEM_LAI ? (
            <p className="flex items-start gap-1.5 text-[13px] leading-5 text-bo-foreground">
              <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-bo-warning" aria-hidden="true" />
              <span>
                <b className="font-semibold">Quản lý yêu cầu đếm lại</b>
                {yeuCauGanNhat.nguoiYeuCau?.hoTen ? ` (${yeuCauGanNhat.nguoiYeuCau.hoTen})` : ""}: {yeuCauGanNhat.lyDoKiemLai}
              </span>
            </p>
          ) : null}
          {lech || lyDo ? (
            suaDong ? (
              <div className="grid gap-1.5">
                <label htmlFor={idLyDo} className="text-xs font-medium leading-4 text-bo-foreground">
                  Giải trình chênh lệch{" "}
                  {lech ? <span className="text-bo-danger">*</span> : null}
                </label>
                <input
                  id={idLyDo}
                  type="text"
                  autoComplete="off"
                  maxLength={LY_DO_TOI_DA}
                  value={lyDo}
                  onChange={(e) => onDoiLyDo(d.id, e.target.value)}
                  onBlur={() => onRoiLyDo(d.id)}
                  placeholder="Ví dụ: 2 áo rách tem, đã để riêng chờ xử lý"
                  aria-invalid={thieu || undefined}
                  className={cn(
                    "h-9 w-full max-w-xl rounded-md border bg-white px-2.5 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15",
                    thieu ? "border-bo-danger/60" : "border-bo-input-border",
                  )}
                />
                {!lyDo.trim() ? (
                  <span className="flex flex-wrap gap-1.5">
                    {GOI_Y_LY_DO.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => onDoiLyDo(d.id, g)}
                        className="h-7 rounded-full border border-bo-border bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-bo-primary/40 hover:bg-bo-primary-soft hover:text-bo-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                      >
                        {g}
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] leading-5 text-bo-foreground">
                <span className="text-bo-muted">Giải trình: </span>
                {lyDo.trim() ? lyDo : <span className="font-medium text-bo-danger">chưa có</span>}
              </p>
            )
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs leading-4 text-bo-muted">
            {suaDong || soAnh ? (
              <button
                type="button"
                onClick={() => onMoAnh(d)}
                className="inline-flex items-center gap-1 rounded font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
              >
                <Camera className="size-3.5" aria-hidden="true" />
                {soAnh ? `Ảnh bằng chứng (${soAnh})` : "Thêm ảnh bằng chứng"}
              </button>
            ) : null}
            {lanTruoc.length ? (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <History className="size-3.5" aria-hidden="true" />
                {lanTruoc.map((l) => (
                  <span key={l.lanKiemDem} className="tabular-nums">
                    Lần {l.lanKiemDem}: {l.soLuongThucTe == null ? "—" : soVN(l.soLuongThucTe)}
                    {l.nguoiKiemDem?.hoTen ? ` · ${l.nguoiKiemDem.hoTen}` : ""}
                  </span>
                ))}
              </span>
            ) : null}
            {d.nguoiKiemDem?.hoTen && d.soLuongThucTe != null && !d.dangGo ? (
              <span>
                Đếm bởi {d.nguoiKiemDem.hoTen}
                {d.ngayKiemDem ? ` · ${formatDateTime(d.ngayKiemDem)}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * Bảng đếm của Chi tiết đợt kiểm kê: các dòng (kệ – lô) gom theo kệ theo thứ tự đi đếm. Màn giữ bộ lọc và phần đang gõ
 * (thanh quét, thanh tổng hợp và hộp thoại cũng đổi được); bảng chỉ vẽ.
 *
 * - `dong`: đã gộp phần đang gõ (kiemKe.gopNhap), đã lọc và sắp. `tong`: số dòng của cả đợt (trước khi lọc).
 * - `suaDuoc`: đợt đang kiểm kê và người xem được đếm; dòng Đã xác nhận (quản lý xác nhận) vẫn chỉ xem.
 * - `mu`: đếm mù — ẩn cột Sổ và Chênh lệch. `nutMu`: `{ bat, onDoi }` công tắc Đếm mù.
 * - `chonDuoc` + `chon` + `onDoiChon(ids, bat)`: ô chọn dòng để yêu cầu đếm lại (đợt chờ duyệt, quản lý kho).
 * - `trangThaiLuu[id]`: useLuuSoDem.trangThai. `dongSang`: dòng vừa quét (tô xanh).
 * - `oQuetRef`: ô quét — Enter ở ô đếm đưa tiêu điểm về đây.
 */
export default function BangDemKiemKe({
  dong,
  tong,
  suaDuoc = false,
  mu = false,
  nutMu,
  chonDuoc = false,
  chon,
  onDoiChon,
  luaChon,
  boLoc,
  onDoiBoLoc,
  dsKe,
  trang,
  coTrang,
  onDoiTrang,
  onDoiCoTrang,
  dongSang,
  trangThaiLuu,
  onDoiSo,
  onDoiLyDo,
  onRoiO,
  onMoAnh,
  onQuetNham,
  oQuetRef,
}) {
  const idBang = useId();
  const coPhanTrang = tong > NGUONG_CONG_CU && dong.length > 0;
  const cat = phanTrang(dong, trang, coPhanTrang ? coTrang : Infinity);
  const nhom = nhomTheoKe(cat.muc);
  const hienSo = !mu;
  const soCot = 3 + (chonDuoc ? 1 : 0) + (hienSo ? 2 : 0) + 1;
  const idO = (id) => `${idBang}-dem-${id}`;
  const veOQuet = () => {
    const o = oQuetRef?.current;
    if (!o) return;
    o.focus();
    o.select?.();
  };
  const keDangLoc = boLoc.viTriId == null ? null : dsKe.find((k) => k.id === boLoc.viTriId);
  const dsChonDuoc = chonDuoc ? cat.muc.filter((d) => d.trangThai !== TT_DONG.CHUA_KIEM) : [];
  const chonHet = dsChonDuoc.length > 0 && dsChonDuoc.every((d) => chon?.has(d.id));

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">
          Dòng kiểm kê
          <span className="ml-2 text-sm font-normal text-bo-muted tabular-nums">{soVN(tong)} cặp kệ – lô</span>
        </h2>
      </div>

      <ThanhCongCuBang
        tuKhoa={boLoc.tuKhoa}
        onDoiTuKhoa={(chu) => onDoiBoLoc({ tuKhoa: chu })}
        onXoaTuKhoa={() => onDoiBoLoc({ tuKhoa: "" })}
        goiYTim="Tìm tên, SKU, mã lô hoặc mã kệ"
        nhanTim="Tìm dòng kiểm kê"
        ketQua={boLoc.tuKhoa.trim() ? `${soVN(dong.length)} dòng khớp` : ""}
        khongKetQua={Boolean(boLoc.tuKhoa.trim()) && !dong.length}
        boLoc={<NutPhanDoan nhan="Lọc dòng" value={boLoc.loc} onChange={(v) => onDoiBoLoc({ loc: v })} luaChon={luaChon} />}
        nutXem={
          <>
            {dsKe.length > 1 ? (
              <label className="relative flex h-8 items-center">
                <span className="sr-only">Lọc theo kệ</span>
                <MapPin className="pointer-events-none absolute left-2.5 size-3.5 text-bo-muted" aria-hidden="true" />
                <select
                  value={boLoc.viTriId ?? ""}
                  onChange={(e) => onDoiBoLoc({ viTriId: e.target.value ? Number(e.target.value) : null })}
                  className="h-8 max-w-[180px] appearance-none rounded-md border border-bo-border bg-bo-surface pl-7 pr-7 text-[13px] font-medium text-bo-foreground outline-none focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                >
                  <option value="">Mọi kệ ({soVN(dsKe.length)})</option>
                  {dsKe.map((k) => (
                    <option key={k.id} value={k.id}>
                      Kệ {k.ma}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute right-2.5 text-[10px] text-bo-muted">▼</span>
              </label>
            ) : null}
            {nutMu ? (
              <span className="flex h-8 items-center gap-2 rounded-md border border-bo-border bg-bo-surface px-2.5">
                <Switch
                  id={`${idBang}-mu`}
                  checked={nutMu.bat}
                  onCheckedChange={nutMu.onDoi}
                  aria-describedby={`${idBang}-mu-mo-ta`}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                />
                <Label htmlFor={`${idBang}-mu`} className="cursor-pointer text-[13px] font-medium text-bo-foreground">
                  Đếm mù
                </Label>
                <span id={`${idBang}-mu-mo-ta`} className="sr-only">Ẩn số trên sổ và chênh lệch khi đếm</span>
              </span>
            ) : null}
          </>
        }
      />

      {keDangLoc ? (
        <div className="-mt-1 flex flex-wrap items-center gap-2 px-4 pb-3 text-[13px] sm:px-6">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-bo-primary-soft pl-2.5 pr-1 font-medium text-bo-primary-strong">
            <MapPin className="size-3.5" aria-hidden="true" />
            Đang xem kệ {keDangLoc.ma}
            <button
              type="button"
              aria-label="Bỏ lọc kệ"
              onClick={() => onDoiBoLoc({ viTriId: null })}
              className="grid size-5 place-items-center rounded-full hover:bg-bo-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : null}

      {nhom.length ? (
        <div className={KHUNG_CUON}>
          <table className={cn(BANG, "@2xl/khoi:min-w-[720px]")}>
            <thead>
              <tr className={DONG_TIEU_DE}>
                {chonDuoc ? (
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU, "w-10 pr-0")}>
                    <Checkbox
                      aria-label="Chọn mọi dòng đã đếm trên trang"
                      checked={chonHet}
                      disabled={!dsChonDuoc.length}
                      onCheckedChange={(bat) => onDoiChon(dsChonDuoc.map((d) => d.id), Boolean(bat))}
                    />
                  </th>
                ) : null}
                <th scope="col" className={cn(O_TIEU_DE, !chonDuoc && O_DAU)}>Sản phẩm</th>
                <th scope="col" className={cn(O_TIEU_DE, "w-[150px]", AN_DIEN_THOAI)}>Lô</th>
                {hienSo ? <th scope="col" className={cn(O_TIEU_DE, "w-[84px] text-right", AN_DIEN_THOAI)}>Sổ</th> : null}
                <th scope="col" className={cn(O_TIEU_DE, suaDuoc ? "w-[150px]" : "w-[90px] text-right")}>Thực tế</th>
                {hienSo ? <th scope="col" className={cn(O_TIEU_DE, "w-[120px] text-right", AN_DIEN_THOAI)}>Chênh lệch</th> : null}
                <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[92px] text-right", AN_DIEN_THOAI)}>
                  <span className="sr-only">Trạng thái lưu</span>
                </th>
              </tr>
            </thead>
            {nhom.map((n) => {
              const daDem = n.ds.filter((d) => d.soLuongThucTe != null).length;
              return (
                <tbody key={`${n.viTri?.id}-${n.ds[0].id}`}>
                  <tr className="border-b border-slate-100 bg-bo-surface-subtle/70">
                    <th scope="rowgroup" colSpan={soCot} className="px-4 py-2 text-left font-normal sm:px-6">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-bo-heading">
                          <MapPin className="size-3.5 text-bo-muted" aria-hidden="true" />
                          <span className="font-mono tracking-wide">Kệ {n.viTri?.ma || "—"}</span>
                        </span>
                        {n.viTri?.khuVuc ? <span className="text-xs text-bo-muted">{n.viTri.khuVuc}</span> : null}
                        <span className={cn("text-xs tabular-nums", daDem === n.ds.length ? "font-medium text-bo-success" : "text-bo-muted")}>
                          {daDem === n.ds.length ? "Đã đếm hết" : `${soVN(daDem)}/${soVN(n.ds.length)} đã đếm`}
                        </span>
                        {boLoc.viTriId == null && dsKe.length > 1 && n.viTri?.id != null ? (
                          <button
                            type="button"
                            onClick={() => onDoiBoLoc({ viTriId: n.viTri.id })}
                            className="ml-auto rounded text-xs font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                          >
                            Chỉ xem kệ này
                          </button>
                        ) : null}
                      </span>
                    </th>
                  </tr>
                  {n.ds.map((d) => {
                    const suaDong = suaDuoc && d.trangThai !== TT_DONG.DA_XAC_NHAN;
                    const tt = trangThaiLuu?.[d.id];
                    const so = d.soLuongThucTe == null ? null : docSo(d.soLuongThucTe);
                    return [
                      <tr
                        key={d.id}
                        data-dong-kiem-ke={d.id}
                        className={cn(
                          "border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle",
                          coDongPhu(d, mu) && "border-b-0",
                          dongSang === d.id && DONG_SANG,
                          chon?.has(d.id) && "bg-bo-primary-soft/60",
                        )}
                      >
                        {chonDuoc ? (
                          <td className={cn(O, O_DAU, "w-10 pr-0")}>
                            <Checkbox
                              aria-label={`Chọn dòng lô ${tenLo(d)} kệ ${d.viTri?.ma}`}
                              checked={chon?.has(d.id) ?? false}
                              disabled={d.trangThai === TT_DONG.CHUA_KIEM}
                              onCheckedChange={(bat) => onDoiChon([d.id], Boolean(bat))}
                            />
                          </td>
                        ) : null}
                        <td className={cn(O, !chonDuoc && O_DAU)}>
                          <span className="flex min-w-0 items-center gap-3">
                            <AnhBienThe src={d.sanPham?.anh} />
                            <span className="block min-w-0">
                              <span className="line-clamp-2 font-medium leading-5 text-bo-foreground" title={d.sanPham?.tenSanPham}>
                                {d.sanPham?.tenSanPham || "—"}
                                {d.phatSinh ? (
                                  <span className="ml-1.5 inline-flex h-5 items-center rounded bg-bo-warning-soft px-1.5 align-[1px] text-[11px] font-semibold text-bo-warning">
                                    Phát sinh
                                  </span>
                                ) : null}
                                {(d.lanKiemDem ?? 1) > 1 ? (
                                  <span className="ml-1.5 inline-flex h-5 items-center rounded bg-slate-100 px-1.5 align-[1px] text-[11px] font-semibold text-slate-600">
                                    Lần {d.lanKiemDem}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
                                <MauKichCo dong={d.sanPham} className="max-w-full align-bottom text-slate-700" />
                                <span className="max-md:hidden">
                                  {" · "}
                                  <span className="break-all font-mono">{d.sanPham?.maSku || "—"}</span>
                                </span>
                                <span className={cn("block", CHI_DIEN_THOAI)}>
                                  Lô <span className="font-mono text-slate-700">{ngatTaiGach(d.loHang?.ma)}</span>
                                  {hienSo ? (
                                    <>
                                      {" · sổ "}
                                      <b className="font-semibold text-slate-700">{soVN(d.soLuongHeThong)}</b>
                                    </>
                                  ) : null}
                                </span>
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={cn(O, AN_DIEN_THOAI)}>
                          <span className="break-all font-mono text-[13px] text-slate-700">{tenLo(d)}</span>
                        </td>
                        {hienSo ? (
                          <td className={cn(O, "text-right font-medium text-bo-foreground", AN_DIEN_THOAI)}>{soVN(d.soLuongHeThong)}</td>
                        ) : null}
                        <td className={cn(O, !suaDong && "text-right", "@max-2xl/khoi:pr-4 max-[380px]:pl-1.5")}>
                          {suaDong ? (
                            <ODem
                              d={d}
                              idO={idO(d.id)}
                              onDoiSo={onDoiSo}
                              onRoiO={onRoiO}
                              onXong={veOQuet}
                              onQuetNham={onQuetNham}
                            />
                          ) : (
                            <span className="font-medium text-bo-foreground">
                              {so == null ? <span className="text-bo-muted">—</span> : soVN(so)}
                            </span>
                          )}
                          <span className={cn("mt-1 block text-xs", !suaDong && "text-right", CHI_DIEN_THOAI)}>
                            <ChenhLech d={d} mu={mu} canPhai={!suaDong} />
                            <span className="mt-0.5 block">
                              <TrangThaiDong d={d} tt={tt} onThuLai={() => onDoiSo(d.id, so, { ngay: true })} />
                            </span>
                          </span>
                        </td>
                        {hienSo ? (
                          <td className={cn(O, "text-right", AN_DIEN_THOAI)}>
                            <ChenhLech d={d} mu={mu} />
                          </td>
                        ) : null}
                        <td className={cn(O, O_CUOI, "text-right", AN_DIEN_THOAI)}>
                          <TrangThaiDong d={d} tt={tt} onThuLai={() => onDoiSo(d.id, so, { ngay: true })} />
                        </td>
                      </tr>,
                      <DongGiaiTrinh
                        key={`${d.id}-gt`}
                        d={d}
                        mu={mu}
                        suaDong={suaDong}
                        soCot={soCot}
                        onDoiLyDo={onDoiLyDo}
                        onRoiLyDo={onRoiO}
                        onMoAnh={onMoAnh}
                      />,
                    ];
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      ) : null}

      {!tong ? (
        <KhongKetQua chu="Đợt chưa có dòng kiểm kê nào. Dòng được chốt từ sổ kệ lúc bấm Bắt đầu." />
      ) : boLoc.tuKhoa.trim() && !dong.length ? (
        <KhongKetQua tuKhoa={boLoc.tuKhoa} donVi="dòng" onXoaTuKhoa={() => onDoiBoLoc({ tuKhoa: "" })} />
      ) : !dong.length ? (
        <KhongKetQua
          chu={`Không có dòng ${TEN_LOC[boLoc.loc] ?? ""}${keDangLoc ? ` ở kệ ${keDangLoc.ma}` : ""}.`}
          nhanNut="Xem tất cả"
          onNut={() => onDoiBoLoc({ loc: "tatCa", viTriId: null })}
        />
      ) : null}
      {coPhanTrang ? (
        <PhanTrangBang
          page={cat.trang}
          size={coTrang}
          total={dong.length}
          onPageChange={onDoiTrang}
          onSizeChange={onDoiCoTrang}
          sizeOptions={CO_TRANG_DONG}
          sizeLabel="dòng"
          totalLabel="dòng"
        />
      ) : null}
    </section>
  );
}
