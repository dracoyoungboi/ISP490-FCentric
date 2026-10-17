import { useMemo, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SearchInput from "@/components/shared/SearchInput";
import { cn } from "@/lib/utils";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  chuanHoaChu,
  kiemTraChuyen,
  layCon,
  layConChau,
  kiemTraPhanHoi,
  layDuongDan,
  taoBodyCapNhat,
} from "./cayDanhMuc";

const CHUA_CHON = "chua-chon";

/**
 * Popup "Chuyển đến…": chọn danh mục cha mới cho một danh mục (kèm cả nhánh con).
 * Thay cho kéo thả đi xa: có ô tìm, khóa sẵn chỗ không chuyển được và ghi lý do
 * (chính nó, nằm trong nhánh đang chuyển, đang ngừng hoạt động), xem trước đường dẫn mới.
 * `onDaChuyen({ nut, tuChaId, denChaId, body })` gọi sau khi máy chủ lưu xong (trang hiện thông báo kèm Hoàn tác).
 */
export default function HopChuyenDanhMuc({ open, onOpenChange, cay, trangThai, idChuyen, onDaChuyen }) {
  const [phien, setPhien] = useState(0);
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setPhien((so) => so + 1);
  }
  const nut = idChuyen != null ? cay.theoId.get(idChuyen) : null;

  return (
    <Dialog open={open && Boolean(nut)} onOpenChange={onOpenChange}>
      {open && nut ? (
        <NoiDung
          key={phien}
          cay={cay}
          trangThai={trangThai}
          nut={nut}
          onDong={() => onOpenChange(false)}
          onDaChuyen={onDaChuyen}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ cay, trangThai, nut, onDong, onDaChuyen }) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [chon, setChon] = useState(CHUA_CHON);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");

  const soCon = layConChau(cay, nut.id).length;
  const duongDanHienTai = layDuongDan(cay, nut.id).map((n) => n.ten).join(" › ");

  const luaChon = useMemo(() => {
    const tu = chuanHoaChu(tuKhoa.trim());
    const ketQua = [];
    const di = (cha, cap) => {
      layCon(cay, cha).forEach((id) => {
        const muc = cay.theoId.get(id);
        const hopLe = kiemTraChuyen(cay, nut.id, id, trangThai);
        const khop = !tu || chuanHoaChu(muc.ten).includes(tu) || chuanHoaChu(muc.ma).includes(tu);
        if (khop) {
          ketQua.push({
            id,
            ten: muc.ten,
            ma: muc.ma,
            cap: tu ? 0 : cap,
            duongDan: tu ? layDuongDan(cay, id).slice(0, -1).map((n) => n.ten).join(" › ") : "",
            ...hopLe,
          });
        }
        // Không liệt kê bên trong nhánh đang chuyển: mọi chỗ trong đó đều không chọn được
        if (id !== nut.id) di(id, cap + 1);
      });
    };
    di(null, 0);
    return ketQua;
  }, [cay, nut.id, trangThai, tuKhoa]);

  const goc = kiemTraChuyen(cay, nut.id, null, trangThai);
  const xemTruoc = chon === CHUA_CHON
    ? "Chọn danh mục cha mới"
    : `Sau khi chuyển: ${[...(chon == null ? [] : layDuongDan(cay, chon).map((n) => n.ten)), nut.ten].join(" › ")}`;

  const chuyen = async () => {
    if (chon === CHUA_CHON || dangLuu) return;
    // Kiểm lại trên cây mới nhất (cây có thể vừa tải lại trong lúc popup đang mở)
    const kq = kiemTraChuyen(cay, nut.id, chon, trangThai);
    if (!kq.duoc) {
      setLoi(`Không chuyển vào đây được: ${kq.lyDo}`);
      return;
    }
    setDangLuu(true);
    setLoi("");
    try {
      const body = taoBodyCapNhat(nut, { chaId: chon });
      kiemTraPhanHoi(await danhMucQuanAoService.update(body));
      onDaChuyen?.({ nut, tuChaId: nut.chaId ?? null, denChaId: chon, body });
      onDong();
    } catch (err) {
      setLoi(getApiErrorMessage(err, "Không chuyển được danh mục. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  return (
    <DialogContent
      showCloseButton={!dangLuu}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 border-bo-border bg-white p-0 text-bo-foreground sm:max-w-xl"
      onEscapeKeyDown={(event) => { if (dangLuu) event.preventDefault(); }}
      onInteractOutside={(event) => { if (dangLuu) event.preventDefault(); }}
    >
      <DialogHeader className="border-b border-bo-border px-5 py-4 pr-12 text-left">
        <DialogTitle className="text-base font-semibold leading-6 text-bo-foreground">
          Chuyển “{nut.ten}”{soCon ? ` cùng ${soCon} danh mục con` : ""}
        </DialogTitle>
        <DialogDescription className="text-sm leading-6 text-bo-muted">Đang ở: {duongDanHienTai}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
        <SearchInput
          label="Tìm danh mục cha mới"
          placeholder="Tìm danh mục cha mới"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          onClear={() => setTuKhoa("")}
          className="sm:max-w-none"
        />
        <div
          role="radiogroup"
          aria-label="Danh mục cha mới"
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-bo-border sm:max-h-[360px]"
        >
          {!tuKhoa.trim() ? (
            <LuaChon
              ten="Không có danh mục cha"
              phu="Thành danh mục gốc (cấp 1)"
              cap={0}
              dangChon={chon === null}
              {...goc}
              onChon={() => setChon(null)}
              dam
            />
          ) : null}
          {luaChon.map((muc) => (
            <LuaChon
              key={muc.id}
              ten={muc.ten}
              phu={muc.duongDan}
              cap={muc.cap}
              dangChon={chon === muc.id}
              duoc={muc.duoc}
              lyDo={muc.lyDo}
              dangOday={muc.dangOday}
              onChon={() => setChon(muc.id)}
            />
          ))}
          {tuKhoa.trim() && luaChon.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-bo-muted">Không có danh mục khớp từ khóa.</p>
          ) : null}
        </div>
        {loi ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{loi}</span>
          </div>
        ) : null}
      </div>

      <DialogFooter className="flex-col items-stretch gap-3 border-t border-bo-border bg-bo-surface-subtle px-5 py-3 sm:flex-row sm:items-center sm:gap-2">
        <p className="min-w-0 text-sm text-bo-muted sm:mr-auto" aria-live="polite">{xemTruoc}</p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDong}
            disabled={dangLuu}
            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={chuyen}
            disabled={chon === CHUA_CHON || dangLuu}
            className="min-w-[132px] bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            {dangLuu ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Đang chuyển...
              </>
            ) : "Chuyển đến đây"}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function LuaChon({ ten, phu, cap, dangChon, duoc, lyDo, dangOday, onChon, dam = false }) {
  const khoa = !duoc;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dangChon}
      aria-disabled={khoa || undefined}
      disabled={khoa}
      onClick={onChon}
      style={{ paddingLeft: 12 + cap * 20 }}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 border-b border-slate-100 py-2 pr-3 text-left text-sm last:border-b-0",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary",
        khoa ? "cursor-not-allowed text-slate-400" : "text-bo-foreground hover:bg-bo-surface-subtle",
        dangChon && "bg-bo-primary-soft shadow-[inset_3px_0_0_var(--color-bo-primary)]",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", dam && "font-semibold")}>{ten}</span>
        {phu ? <span className={cn("truncate text-xs", khoa ? "text-slate-400" : "text-bo-muted")}>{phu}</span> : null}
      </span>
      {dangOday ? (
        <span className="shrink-0 text-xs font-semibold text-bo-primary-hover">Đang ở đây</span>
      ) : khoa && lyDo ? (
        <span className="shrink-0 text-xs text-bo-muted">{lyDo}</span>
      ) : dangChon ? (
        <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}
