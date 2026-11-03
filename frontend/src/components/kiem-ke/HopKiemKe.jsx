import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, PackagePlus, Search, Trash2 } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP, GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { themAnh, themPhatSinh, timLo, xoaAnh } from "@/services/stockTakeService";
import { lamViecTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";
import { docSoDem } from "./kiemKe";

const LY_DO_TOI_DA = 2000;
const SO_LUONG_TOI_DA = 1_000_000;
const ANH_TOI_DA = 6;
const DUNG_LUONG_ANH_TOI_DA = 5 * 1024 * 1024;
// Gõ mã xong chờ ngần này rồi mới tìm lô
const CHO_TIM_MS = 300;

/**
 * Hộp có một ô lý do bắt buộc (Hủy đợt, Yêu cầu đếm lại). `onXacNhan(lyDo)` trả Promise; lỗi máy chủ hiện trong hộp.
 * `children`: phần nhắc thêm trên ô lý do (vd. các dòng sẽ đếm lại).
 */
export function HopLyDo({ mo, onDoiMo, tieuDe, moTa, nhanO, goiY, nhanXacNhan, iconXacNhan, kieu, traTieuDiemVe, onXacNhan, children }) {
  const id = useId();
  const [lyDo, setLyDo] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState(null);
  const doiMo = (m) => {
    if (dangChay) return;
    if (!m) {
      setLyDo("");
      setLoi(null);
    }
    onDoiMo(m);
  };
  const xacNhan = async () => {
    setLoi(null);
    setDangChay(true);
    try {
      await onXacNhan(lyDo.trim());
      setLyDo("");
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Máy chủ chưa nhận thao tác. Thử lại sau ít phút."));
    } finally {
      setDangChay(false);
    }
  };
  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={doiMo}
      tieuDe={tieuDe}
      moTa={moTa}
      nhanXacNhan={nhanXacNhan}
      iconXacNhan={iconXacNhan}
      kieu={kieu}
      rong
      dangChay={dangChay}
      khoaXacNhan={!lyDo.trim()}
      lyDoKhoa={!lyDo.trim() ? "Nhập lý do trước" : undefined}
      traTieuDiemVe={traTieuDiemVe}
      loi={loi}
      onXacNhan={xacNhan}
    >
      {children}
      <label htmlFor={id} className="grid gap-1.5">
        <span className={NHAN_O}>
          {nhanO} <span className="text-bo-danger">*</span>
        </span>
        <textarea
          id={id}
          value={lyDo}
          maxLength={LY_DO_TOI_DA}
          onChange={(e) => {
            setLyDo(e.target.value.slice(0, LY_DO_TOI_DA));
            setLoi(null);
          }}
          placeholder={goiY}
          className={O_NHAP_NHIEU_DONG}
        />
        <span className={GOI_Y_O}>
          <span>Bắt buộc</span>
          <span>
            {lyDo.length}/{LY_DO_TOI_DA}
          </span>
        </span>
      </label>
    </HopXacNhanChungTu>
  );
}

/**
 * Thêm lô phát sinh (UC-STK-03, BR-STK-11): lô đã có trong danh mục hàng hóa, tìm thấy ở một kệ trong phạm vi mà sổ kệ
 * không ghi. Chọn kệ → tìm lô theo mã lô / SKU → số lượng đếm được + giải trình. `dsKe`: kệ chọn được `[{ id, ma }]`.
 * `tuKhoaDau`: mã vừa quét không thấy trong đợt (điền sẵn ô tìm). `keDau`: kệ đang đếm.
 */
export function HopPhatSinh({ mo, onDoiMo, dot, dsKe, keDau, tuKhoaDau, traTieuDiemVe, onXong }) {
  const id = useId();
  const [keId, setKeId] = useState(keDau ?? "");
  const [tuKhoa, setTuKhoa] = useState(tuKhoaDau ?? "");
  const [kq, setKq] = useState({ tu: "", ds: [], dang: false, loi: null });
  const [lo, setLo] = useState(null);
  const [soLuong, setSoLuong] = useState(null);
  const [lyDo, setLyDo] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState(null);
  const lanTimRef = useRef(0);

  // Mở lại hộp: điền kệ / mã mới nhất từ màn
  const [moTruoc, setMoTruoc] = useState(mo);
  if (mo !== moTruoc) {
    setMoTruoc(mo);
    if (mo) {
      setKeId(keDau ?? "");
      setTuKhoa(tuKhoaDau ?? "");
      setLo(null);
      setSoLuong(null);
      setLyDo("");
      setLoi(null);
    }
  }

  const tu = tuKhoa.trim();
  useEffect(() => {
    if (!mo || !tu) return undefined;
    const lan = ++lanTimRef.current;
    const hen = setTimeout(async () => {
      setKq((cu) => ({ ...cu, dang: true, loi: null }));
      try {
        const ds = await timLo(dot.id, tu);
        if (lan === lanTimRef.current) setKq({ tu, ds, dang: false, loi: null });
      } catch (error) {
        if (lan === lanTimRef.current) setKq({ tu, ds: [], dang: false, loi: getApiErrorMessage(error, "Chưa tìm được lô") });
      }
    }, CHO_TIM_MS);
    return () => clearTimeout(hen);
  }, [mo, tu, dot.id]);

  const dsLo = tu && kq.tu === tu ? kq.ds : [];
  const thieu = !keId ? "Chọn kệ" : !lo ? "Chọn lô" : !soLuong ? "Nhập số lượng đếm được" : !lyDo.trim() ? "Nhập giải trình" : null;

  const doiMo = (m) => {
    if (dangChay) return;
    onDoiMo(m);
  };
  const xacNhan = async () => {
    setLoi(null);
    setDangChay(true);
    try {
      lamViecTaiKho(dot.kho);
      const dong = await themPhatSinh(dot.id, {
        viTriKhoId: Number(keId),
        loHangId: lo.loHangId,
        soLuongThucTe: soLuong,
        lyDoChenhLech: lyDo.trim(),
      });
      toast.success("Đã thêm lô phát sinh", { description: `Lô ${lo.maLo} · ${soVN(soLuong)} sản phẩm` });
      onXong?.(dong);
      onDoiMo(false);
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa thêm được lô phát sinh"));
    } finally {
      setDangChay(false);
    }
  };

  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={doiMo}
      tieuDe="Thêm lô phát sinh"
      moTa="Lô có thật trên kệ nhưng sổ kệ không ghi. Sổ của dòng là 0, số đếm được tính là thừa và cần giải trình."
      nhanXacNhan="Thêm lô"
      iconXacNhan={PackagePlus}
      rong
      dangChay={dangChay}
      khoaXacNhan={Boolean(thieu)}
      lyDoKhoa={thieu ?? undefined}
      traTieuDiemVe={traTieuDiemVe}
      loi={loi}
      onXacNhan={xacNhan}
    >
      <label className="grid gap-1.5">
        <span className={NHAN_O}>
          Kệ tìm thấy hàng <span className="text-bo-danger">*</span>
        </span>
        <select value={keId} onChange={(e) => setKeId(e.target.value)} className={O_NHAP}>
          <option value="">Chọn kệ…</option>
          {dsKe.map((k) => (
            <option key={k.id} value={k.id}>
              Kệ {k.ma}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-tim`} className={NHAN_O}>
          Lô hàng <span className="text-bo-danger">*</span>
        </label>
        <span className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
          <input
            id={`${id}-tim`}
            type="text"
            autoComplete="off"
            value={tuKhoa}
            onChange={(e) => {
              setTuKhoa(e.target.value);
              setLo(null);
            }}
            placeholder="Quét tem hoặc gõ đầu mã lô, SKU"
            className={cn(O_NHAP, "pl-8")}
          />
        </span>
        {tu ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-bo-border">
            {kq.dang && kq.tu !== tu ? (
              <p role="status" className="flex items-center gap-2 px-3 py-3 text-[13px] text-bo-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang tìm lô…
              </p>
            ) : kq.loi ? (
              <p className="px-3 py-3 text-[13px] text-bo-danger">{kq.loi}</p>
            ) : !dsLo.length ? (
              <p className="px-3 py-3 text-[13px] text-bo-muted">
                Không có lô nào khớp “{tu}”{dot.loaiKiemKe === "theo_danh_muc" ? " trong danh mục của đợt" : ""}. Lô chưa có trong
                hệ thống thì nhập kho trước, không thêm qua kiểm kê.
              </p>
            ) : (
              <ul role="radiogroup" aria-label="Chọn lô" className="m-0 list-none divide-y divide-slate-100 p-0">
                {dsLo.map((x) => {
                  const chon = lo?.loHangId === x.loHangId;
                  return (
                    <li key={x.loHangId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={chon}
                        onClick={() => setLo(x)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bo-surface-subtle focus-visible:bg-bo-primary-soft focus-visible:outline-none",
                          chon && "bg-bo-primary-soft hover:bg-bo-primary-soft",
                        )}
                      >
                        <AnhBienThe src={x.sanPham?.anh} co="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-bo-foreground">{x.sanPham?.tenSanPham || "—"}</span>
                          <span className="block truncate text-xs text-bo-muted">
                            <span className="font-mono text-slate-700">{x.maLo}</span>
                            {" · "}
                            <MauKichCo dong={x.sanPham} className="align-bottom" />
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn("size-4 shrink-0 rounded-full border-2", chon ? "border-bo-primary bg-bo-primary shadow-[inset_0_0_0_2px_white]" : "border-slate-300")}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <label className="grid gap-1.5">
        <span className={NHAN_O}>
          Số lượng đếm được <span className="text-bo-danger">*</span>
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={soLuong == null ? "" : String(soLuong)}
          onChange={(e) => setSoLuong(docSoDem(e.target.value, SO_LUONG_TOI_DA) || null)}
          placeholder="Ví dụ: 3"
          className={cn(O_NHAP, "max-w-[160px] tabular-nums")}
        />
      </label>

      <label className="grid gap-1.5">
        <span className={NHAN_O}>
          Giải trình <span className="text-bo-danger">*</span>
        </span>
        <textarea
          value={lyDo}
          maxLength={LY_DO_TOI_DA}
          onChange={(e) => setLyDo(e.target.value.slice(0, LY_DO_TOI_DA))}
          placeholder="Ví dụ: Hàng trả từ quầy để nhầm sang kệ A-01-02, chưa ghi chuyển kệ"
          className={O_NHAP_NHIEU_DONG}
        />
      </label>
    </HopXacNhanChungTu>
  );
}

/**
 * Ảnh bằng chứng của một dòng (BR-STK-07, khuyến nghị): PNG / JPEG / WebP ≤ 5 MB, tối đa 6 ảnh mỗi lần đếm. Ảnh của lần
 * đếm trước chỉ xem. `onDaDoi()`: màn tải lại dòng để thấy ảnh mới.
 */
export function HopAnhKiemKe({ mo, onDoiMo, dot, dong, suaDuoc, traTieuDiemVe, onDaDoi }) {
  const id = useId();
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState(null);
  const anh = Array.isArray(dong?.anh) ? dong.anh : [];
  const anhLanNay = anh.filter((a) => (a.lanKiemDem ?? dong?.lanKiemDem) === dong?.lanKiemDem);
  // Máy chủ chỉ cho người chụp, quản lý kho, quản trị viên xóa ảnh
  const [nguoiDungId] = useState(getCurrentUserId);
  const [laQuanLy] = useState(() => hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]));
  const xoaDuoc = (a) => laQuanLy || (a.nguoiChup?.id != null && Number(a.nguoiChup.id) === Number(nguoiDungId));
  const conCho = ANH_TOI_DA - anhLanNay.length;

  const chonTep = async (tep) => {
    if (!tep || !dong) return;
    setLoi(null);
    if (!/^image\/(png|jpeg|webp)$/.test(tep.type)) {
      setLoi("Chỉ nhận ảnh PNG, JPEG hoặc WebP.");
      return;
    }
    if (tep.size > DUNG_LUONG_ANH_TOI_DA) {
      setLoi("Ảnh lớn hơn 5 MB. Chụp lại ở chất lượng thấp hơn hoặc chọn ảnh khác.");
      return;
    }
    setDang(true);
    try {
      lamViecTaiKho(dot.kho);
      await themAnh(dot.id, dong.id, tep);
      await onDaDoi?.();
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa tải được ảnh lên"));
    } finally {
      setDang(false);
    }
  };
  const xoa = async (a) => {
    setLoi(null);
    setDang(true);
    try {
      lamViecTaiKho(dot.kho);
      await xoaAnh(dot.id, dong.id, a.id);
      await onDaDoi?.();
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa xóa được ảnh"));
    } finally {
      setDang(false);
    }
  };

  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={(m) => !dang && onDoiMo(m)}
      tieuDe="Ảnh bằng chứng"
      moTa={dong ? `Lô ${dong.loHang?.ma || "—"} · kệ ${dong.viTri?.ma || "—"}. Chụp rõ tem lô và tình trạng hàng.` : undefined}
      nhanXacNhan="Xong"
      rong
      dangChay={false}
      khoaXacNhan={dang}
      lyDoKhoa={dang ? "Đang tải ảnh…" : undefined}
      traTieuDiemVe={traTieuDiemVe}
      loi={loi}
      onXacNhan={() => onDoiMo(false)}
    >
      {anh.length ? (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {anh.map((a) => {
            const lanTruoc = (a.lanKiemDem ?? dong.lanKiemDem) !== dong.lanKiemDem;
            return (
              <li key={a.id} className="relative overflow-hidden rounded-md border border-bo-border bg-bo-surface-subtle">
                <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square">
                  <img src={a.url} alt={a.moTa || `Ảnh kiểm kê lô ${dong.loHang?.ma || ""}`} className="size-full object-cover" loading="lazy" />
                </a>
                {lanTruoc ? (
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-medium leading-5 text-white">
                    Lần {a.lanKiemDem}
                  </span>
                ) : suaDuoc && xoaDuoc(a) ? (
                  <button
                    type="button"
                    aria-label="Xóa ảnh"
                    disabled={dang}
                    onClick={() => xoa(a)}
                    className="absolute right-1 top-1 grid size-8 place-items-center rounded-md bg-white/90 text-bo-danger shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-danger/30 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={cn(GHI_CHU_HOP, "flex items-center gap-2")}>
          <Camera className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
          Chưa có ảnh nào. Ảnh không bắt buộc nhưng giúp người duyệt hiểu chênh lệch.
        </div>
      )}
      {suaDuoc && dong?.trangThai !== 3 ? (
        conCho > 0 ? (
          <label
            htmlFor={`${id}-tep`}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-bo-primary/40 bg-bo-primary-soft/50 text-sm font-semibold text-bo-primary-strong hover:bg-bo-primary-soft focus-within:ring-2 focus-within:ring-bo-primary/30",
              dang && "pointer-events-none opacity-60",
            )}
          >
            {dang ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
            {dang ? "Đang tải ảnh…" : `Chụp hoặc chọn ảnh (còn ${conCho})`}
            <input
              id={`${id}-tep`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              className="sr-only"
              disabled={dang}
              onChange={(e) => {
                const tep = e.target.files?.[0];
                e.target.value = "";
                chonTep(tep);
              }}
            />
          </label>
        ) : (
          <p className="text-[13px] text-bo-muted">Đã đủ {ANH_TOI_DA} ảnh cho lần đếm này.</p>
        )
      ) : null}
    </HopXacNhanChungTu>
  );
}
