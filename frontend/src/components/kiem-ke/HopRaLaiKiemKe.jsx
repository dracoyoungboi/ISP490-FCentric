import { useId } from "react";
import { Check, Loader2, Lock, Send, TriangleAlert } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { GOI_Y_LY_DO, TT_DONG, chuChenhLech, laLech, tienCoDau } from "./kiemKe";

const LY_DO_TOI_DA = 2000;

/** Trạng thái lưu của dòng trong hộp (cùng nguồn useLuuSoDem như bảng): đang lưu / chưa lưu được / đã lưu. */
function TrangThaiLuu({ tt }) {
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
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-bo-danger" title={tt.loi}>
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        Chưa lưu được
      </span>
    );
  }
  if (tt?.vuaLuu) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-bo-success">
        <Check className="size-3.5" aria-hidden="true" />
        Đã lưu
      </span>
    );
  }
  return null;
}

/**
 * Một dòng lệch cần giải trình: sản phẩm, kệ; dòng dưới "sổ · đếm · tiền" + chênh lệch (xuống dòng được trên khối hẹp);
 * ô lý do + chip gợi ý (luôn hiện, bấm để điền, không làm hàng co lại dưới ngón tay). Dòng quản lý đã xác nhận: chỉ xem.
 */
function DongRaLai({ d, tt, onDoiLyDo, onRoiLyDo }) {
  const id = useId();
  const c = chuChenhLech(d);
  const lyDo = d.lyDoChenhLech ?? "";
  const daXacNhan = d.trangThai === TT_DONG.DA_XAC_NHAN;
  return (
    <li className="grid gap-2 border-b border-slate-100 py-3 first:pt-0 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <AnhBienThe src={d.sanPham?.anh} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium leading-5 text-bo-foreground">{d.sanPham?.tenSanPham || "—"}</span>
          <span className="text-xs leading-4 text-bo-muted">
            <MauKichCo dong={d.sanPham} className="align-bottom" />
            {" · kệ "}
            <span className="font-mono">{d.viTri?.ma || "—"}</span>
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2 text-xs leading-4 tabular-nums">
            <span className={cn("text-[13px] font-semibold", c?.kieu === "thieu" ? "text-bo-danger" : "text-bo-primary-strong")}>{c?.chu}</span>
            <span className="text-bo-muted">
              sổ {soVN(d.soLuongHeThong)} · đếm {soVN(d.soLuongThucTe)} · {tienCoDau(d.giaTriChenhLech)}
            </span>
            <TrangThaiLuu tt={tt} />
          </span>
        </span>
      </div>
      {daXacNhan ? (
        <p className="flex items-start gap-1.5 text-[13px] leading-5 text-bo-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-bo-muted" aria-hidden="true" />
          <span>
            <span className="text-bo-muted">Quản lý đã xác nhận · </span>
            {lyDo.trim() || "—"}
          </span>
        </p>
      ) : (
        <>
          <label htmlFor={id} className="sr-only">
            Giải trình chênh lệch
          </label>
          <input
            id={id}
            type="text"
            autoComplete="off"
            maxLength={LY_DO_TOI_DA}
            value={lyDo}
            onChange={(e) => onDoiLyDo(d.id, e.target.value)}
            onBlur={() => onRoiLyDo(d.id)}
            placeholder="Giải trình chênh lệch (bắt buộc)"
            className="h-9 w-full rounded-md border border-bo-input-border bg-white px-2.5 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
          />
          <span className="flex flex-wrap gap-1.5">
            {GOI_Y_LY_DO.map((g) => {
              const chon = lyDo.trim() === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={chon}
                  onClick={() => onDoiLyDo(d.id, g)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 cam-ung:h-9",
                    chon
                      ? "border-bo-primary/40 bg-bo-primary-soft text-bo-primary-strong"
                      : "border-bo-border bg-white text-slate-700 hover:border-bo-primary/40 hover:bg-bo-primary-soft hover:text-bo-primary-strong",
                  )}
                >
                  {g}
                </button>
              );
            })}
          </span>
        </>
      )}
    </li>
  );
}

/**
 * Rà lại trước khi trình duyệt: đã đếm hết mà còn dòng lệch chưa giải trình (bấm Trình duyệt thì mở hộp này thay hộp
 * trình). Mở ra các dòng lệch — kể cả khi đang đếm mù, vì đã đếm xong — mỗi dòng ô lý do + chip gợi ý; số tự lưu như bảng,
 * trạng thái lưu hiện ở từng dòng. Đủ lý do thì Trình duyệt ngay trong hộp. Thân hộp tự cuộn (không lồng thêm vùng cuộn).
 *
 * - `dong`: dòng của đợt (đã gộp phần đang gõ). `trangThaiLuu`: useLuuSoDem.trangThai.
 * - `onDoiLyDo(id, chu)`, `onRoiLyDo(id)`: như bảng đếm. `onTrinh`: lệnh trình duyệt (chờ lưu hết rồi gửi).
 */
export default function HopRaLaiKiemKe({ mo, onDoiMo, dong, trangThaiLuu, onDoiLyDo, onRoiLyDo, onTrinh, dangChay, loi, traTieuDiemVe }) {
  const lech = dong.filter(laLech);
  const thieu = lech.filter((d) => !String(d.lyDoChenhLech ?? "").trim()).length;
  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={onDoiMo}
      tieuDe="Rà lại trước khi trình"
      moTa={`Đã đếm hết. ${soVN(lech.length)} dòng lệch so với sổ cần lý do để quản lý thẩm định. Ảnh bằng chứng thêm ở bảng đếm.`}
      nhanXacNhan="Trình duyệt"
      iconXacNhan={Send}
      rong
      tieuDiemONhap={false}
      traTieuDiemVe={traTieuDiemVe}
      dangChay={dangChay}
      khoaXacNhan={thieu > 0}
      lyDoKhoa={thieu > 0 ? `Còn ${soVN(thieu)} dòng chưa có lý do` : undefined}
      loi={loi}
      onXacNhan={onTrinh}
    >
      {lech.length ? (
        <ul className="m-0 grid list-none p-0">
          {lech.map((d) => (
            <DongRaLai key={d.id} d={d} tt={trangThaiLuu?.[d.id]} onDoiLyDo={onDoiLyDo} onRoiLyDo={onRoiLyDo} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-bo-muted">Mọi dòng đều khớp sổ.</p>
      )}
    </HopXacNhanChungTu>
  );
}
