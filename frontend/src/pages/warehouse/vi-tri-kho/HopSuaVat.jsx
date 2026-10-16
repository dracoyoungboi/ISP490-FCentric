import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { tenLoaiVat } from "@/components/mat-bang/matBang";
import { HUONG_CUA } from "@/constants/nhapKho";
import { getApiErrorMessage } from "@/utils/apiError";
import { KhungHop, NhomChon, Truong } from "./KhungHop";
import { O_NHAP } from "./kieuNhap";

/**
 * Sửa tên lối đi / cửa / vật cố định trên mặt bằng; với cửa đổi được hướng (nhận / xuất hàng).
 * vat: { loai, ten, huong }. onXacNhan({ ten, huong }) trả về Promise.
 */
export default function HopSuaVat({ open, onOpenChange, vat, onXacNhan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && vat ? <NoiDung vat={vat} onDong={() => onOpenChange(false)} onXacNhan={onXacNhan} /> : null}
    </Dialog>
  );
}

function NoiDung({ vat, onDong, onXacNhan }) {
  const laCua = vat.loai === "cua";
  const [ten, setTen] = useState(vat.ten ?? "");
  const [huong, setHuong] = useState(vat.huong ?? HUONG_CUA[0].ma);
  const [daGui, setDaGui] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiMayChu, setLoiMayChu] = useState("");
  const loiTen = ten.trim() ? "" : "Nhập tên để nhân viên nhận ra trên mặt bằng.";

  const luu = async () => {
    setDaGui(true);
    if (loiTen) return;
    setDangLuu(true);
    setLoiMayChu("");
    try {
      await onXacNhan(laCua ? { ten: ten.trim(), huong } : { ten: ten.trim() });
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, "Không lưu được mặt bằng. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  return (
    <KhungHop
      tieuDe={`Sửa ${tenLoaiVat(vat.loai).toLowerCase()}`}
      moTa="Đổi chỗ thì kéo trên mặt bằng hoặc dùng nút mũi tên; đổi kích thước thì bấm Vẽ lại."
      onHuy={onDong}
      onGui={luu}
      nhanGui="Lưu thay đổi"
      dangGui={dangLuu}
    >
      <Truong nhan="Tên" htmlFor="sv-ten" loi={daGui ? loiTen : ""}>
        <input id="sv-ten" autoFocus value={ten} onChange={(e) => setTen(e.target.value)} aria-invalid={daGui && Boolean(loiTen)} className={O_NHAP} />
      </Truong>
      {laCua ? (
        <Truong nhan="Hướng cửa" goiY="Chỉ đường trong kho bắt đầu từ cửa nhận hàng">
          <NhomChon nhan="Hướng cửa" value={huong} onChange={setHuong} luaChon={HUONG_CUA} day />
        </Truong>
      ) : null}
      {loiMayChu ? <DongThongBao tone="bad">{loiMayChu}</DongThongBao> : null}
    </KhungHop>
  );
}
