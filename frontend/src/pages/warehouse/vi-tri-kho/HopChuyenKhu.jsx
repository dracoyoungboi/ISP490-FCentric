import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { KhungHop, Truong } from "./KhungHop";
import { O_NHAP, dinhDangSo } from "./kieuNhap";
import { t } from "@/i18n";

/**
 * Chuyển nhiều vị trí kệ sang khu khác (vd trước khi xóa một khu). Mã vị trí và hàng trên kệ giữ nguyên.
 * onXacNhan(khuVucId) trả về Promise.
 */
export default function HopChuyenKhu({ open, onOpenChange, khuVucs, dsViTri, onXacNhan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <NoiDung khuVucs={khuVucs} dsViTri={dsViTri} onDong={() => onOpenChange(false)} onXacNhan={onXacNhan} /> : null}
    </Dialog>
  );
}

function NoiDung({ khuVucs, dsViTri, onDong, onXacNhan }) {
  // Gợi ý khu đầu tiên khác khu hiện tại của các vị trí đã chọn
  const khuHienTai = new Set(dsViTri.map((v) => v.khuVucId));
  const [khuVucId, setKhuVucId] = useState(String((khuVucs.find((k) => !khuHienTai.has(k.id)) ?? khuVucs[0])?.id ?? ""));
  const [dangLuu, setDangLuu] = useState(false);
  const daOKhu = dsViTri.filter((v) => String(v.khuVucId) === khuVucId).length;
  const canChuyen = dsViTri.length - daOKhu;

  const luu = async () => {
    if (!canChuyen) return;
    setDangLuu(true);
    try {
      await onXacNhan(Number(khuVucId));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <KhungHop
      tieuDe={t("Chuyển vị trí sang khu khác")}
      moTa={t("{{soViTri}} vị trí đã chọn · mã vị trí và hàng trên kệ giữ nguyên", { count: dsViTri.length, soViTri: dinhDangSo(dsViTri.length) })}
      onHuy={onDong}
      onGui={luu}
      khoaGui={!canChuyen}
      nhanGui={canChuyen ? t("Chuyển {{canChuyen}} vị trí", { count: canChuyen, canChuyen: dinhDangSo(canChuyen) }) : t("Chuyển")}
      dangGui={dangLuu}
    >
      <Truong nhan={t("Chuyển sang khu")} htmlFor="ck-khu">
        <select id="ck-khu" value={khuVucId} onChange={(e) => setKhuVucId(e.target.value)} className={O_NHAP}>
          {khuVucs.map((k) => (
            <option key={k.id} value={k.id}>
              {k.tenKhuVuc} · {k.maKhuVuc}
            </option>
          ))}
        </select>
      </Truong>
      {daOKhu ? (
        <DongThongBao tone={canChuyen ? "neutral" : "warn"}>
          {canChuyen
            ? t("{{daOKhu}} vị trí đã ở khu này, sẽ bỏ qua.", { count: daOKhu, daOKhu: dinhDangSo(daOKhu) })
            : t("Các vị trí đã chọn đều đang ở khu này.")}
        </DongThongBao>
      ) : null}
    </KhungHop>
  );
}
