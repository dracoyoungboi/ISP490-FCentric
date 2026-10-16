import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/shared/StatusBadge";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { DaiO } from "@/components/nhap-kho/ThanhBuoc";
import LuoiMatBang from "@/components/mat-bang/LuoiMatBang";
import { cauChiDuong } from "@/components/mat-bang/matBang";
import { nhomTrangThaiKe } from "@/constants/nhapKho";
import { THONG_BAO_CHUA_HO_TRO_VI_TRI, viTriKhoService } from "@/services/viTriKhoService";

/**
 * "Vị trí này nằm ở đâu?" — mở từ Danh sách vị trí kệ, Sơ đồ kệ và màn Kiểm đếm.
 * Truyền `viTriId` (tìm một kệ) hoặc `khuVucId` (xem một khu); không truyền gì thì xem cả mặt bằng.
 * `duLieu` (tùy chọn): { khuVucs, viTris, matBang } đã có sẵn ở trang gọi, khỏi tải lại.
 */
export default function HopViTriNamODau({ open, onOpenChange, khoId, viTriId, khuVucId, duLieu, onMoSoDoKe }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung
          khoId={khoId}
          viTriId={viTriId}
          khuVucId={khuVucId}
          duLieu={duLieu}
          onDong={() => onOpenChange(false)}
          onMoSoDoKe={onMoSoDoKe}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ khoId, viTriId, khuVucId, duLieu, onDong, onMoSoDoKe }) {
  const [taiVe, setTaiVe] = useState(duLieu ?? null);
  const [loi, setLoi] = useState(false);

  useEffect(() => {
    if (duLieu || !viTriKhoService.hoTro || !khoId) return undefined;
    let huy = false;
    Promise.all([viTriKhoService.dsKhuVuc(khoId), viTriKhoService.dsViTri(khoId), viTriKhoService.matBang(khoId)])
      .then(([khuVucs, viTris, matBang]) => {
        if (!huy) setTaiVe({ khuVucs, viTris, matBang });
      })
      .catch(() => {
        if (!huy) setLoi(true);
      });
    return () => {
      huy = true;
    };
  }, [duLieu, khoId]);

  const viTri = viTriId ? taiVe?.viTris?.find((v) => v.id === viTriId) : null;
  const khuId = viTri?.khuVucId ?? khuVucId ?? null;
  const khu = khuId ? taiVe?.khuVucs?.find((k) => k.id === khuId) : null;
  const hinhKhu = khu ? taiVe?.matBang?.khuVuc?.find((h) => h.khuVucId === khu.id) : null;
  const chiDuong = cauChiDuong(taiVe?.matBang, khu, hinhKhu, viTri);
  const nhom = viTri ? nhomTrangThaiKe(viTri) : null;

  let noiDung;
  if (!viTriKhoService.hoTro) {
    noiDung = <DongThongBao>{THONG_BAO_CHUA_HO_TRO_VI_TRI}</DongThongBao>;
  } else if (loi) {
    noiDung = <DongThongBao tone="bad">Không tải được mặt bằng kho. Vui lòng thử lại.</DongThongBao>;
  } else if (!taiVe) {
    noiDung = (
      <div className="flex h-40 items-center justify-center text-bo-muted">
        <Loader2 className="size-5 animate-spin" aria-label="Đang tải mặt bằng" />
      </div>
    );
  } else if (!taiVe.matBang?.soCot) {
    noiDung = <DongThongBao>Kho này chưa vẽ mặt bằng. Vào Vị trí kệ → Mặt bằng để vẽ.</DongThongBao>;
  } else {
    noiDung = (
      <>
        {viTri && khu ? (
          <DaiO soO={4}>
            {[
              ["Khu vực", khu.tenKhuVuc, `${khu.maKhuVuc}${khu.loaiKhu ? ` · ${khu.loaiKhu}` : ""}`],
              ["Dãy · Hàng · Tầng", `${viTri.day} · ${viTri.hang} · ${viTri.tang}`, "Tầng 01 là tầng sát sàn"],
              ["Đang chứa", `${viTri.dangChua ?? 0} / ${viTri.sucChua ?? 0}`, `Còn trống ${Math.max(0, (viTri.sucChua ?? 0) - (viTri.dangChua ?? 0))}`],
              ["Trạng thái", <StatusBadge key="tt" label={nhom.label} tone={nhom.tone} />, nhom.ma === "CON_CHO" ? "Nhận hàng được" : "Không nhận hàng"],
            ].map(([nhan, giaTri, phu]) => (
              <div key={nhan} className="flex min-w-0 flex-col gap-1 bg-white px-4 py-3">
                <span className="text-xs font-medium text-bo-muted">{nhan}</span>
                <span className="truncate text-sm font-semibold text-bo-heading">{giaTri}</span>
                <span className="text-xs text-bo-muted">{phu}</span>
              </div>
            ))}
          </DaiO>
        ) : null}
        {khu && !hinhKhu ? (
          <DongThongBao tone="warn">{khu.tenKhuVuc} chưa được vẽ trên mặt bằng. Vào Vị trí kệ → Mặt bằng để vẽ.</DongThongBao>
        ) : chiDuong ? (
          <DongThongBao tone="info">
            {chiDuong.map((d, i) => (d.dam ? <b key={i}>{d.chu}</b> : <span key={i}>{d.chu}</span>))}
            {viTri ? (
              <>
                {" "}Mã dán trên kệ: <span className="whitespace-nowrap font-mono">{viTri.maViTri}</span>.
              </>
            ) : null}
          </DongThongBao>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-bo-border">
          <LuoiMatBang
            matBang={taiVe.matBang}
            khuVucs={taiVe.khuVucs}
            viTris={taiVe.viTris}
            cheDo="xem"
            khuNoiBat={hinhKhu ? khu.id : null}
            viTriNoiBat={viTri?.id ?? null}
          />
        </div>
      </>
    );
  }

  return (
    <DialogContent className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[1080px]">
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 text-left">
        <DialogTitle className="text-base text-bo-foreground">
          {viTri ? `Vị trí ${viTri.maViTri} nằm ở đâu?` : khu ? `${khu.tenKhuVuc} trên mặt bằng` : "Mặt bằng kho"}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          {viTri && khu ? `${khu.tenKhuVuc} · dãy ${viTri.day} · hàng ${viTri.hang} · tầng ${viTri.tang}` : "Chỉ để xem, không chỉnh sửa ở đây"}
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">{noiDung}</div>
      <DialogFooter className="shrink-0 border-t border-bo-border bg-bo-surface-subtle px-6 py-3">
        {khu && onMoSoDoKe ? (
          <Button variant="outline" onClick={() => onMoSoDoKe({ khuVucId: khu.id, viTriId: viTri?.id ?? null })} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
            Mở sơ đồ kệ của khu
          </Button>
        ) : null}
        <Button onClick={onDong} className="min-w-28 bg-bo-primary text-white hover:bg-bo-primary-hover">Đóng</Button>
      </DialogFooter>
    </DialogContent>
  );
}
