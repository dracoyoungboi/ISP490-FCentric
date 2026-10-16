import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { vatNgoaiLuoi } from "@/components/mat-bang/matBang";
import { LUOI_MAT_BANG } from "@/constants/nhapKho";
import { getApiErrorMessage } from "@/utils/apiError";
import { KhungHop, Truong } from "./KhungHop";
import { O_NHAP } from "./kieuNhap";

/**
 * Tạo lưới mặt bằng (kho chưa có) hoặc đổi kích thước lưới. Thu nhỏ không được cắt mất khu hay cửa đã vẽ.
 * onXacNhan({ soCot, soHang }) trả về Promise.
 */
export default function HopKichThuocLuoi({ open, onOpenChange, matBang, tenKhu, onXacNhan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <NoiDung matBang={matBang} tenKhu={tenKhu} onDong={() => onOpenChange(false)} onXacNhan={onXacNhan} /> : null}
    </Dialog>
  );
}

function NoiDung({ matBang, tenKhu, onDong, onXacNhan }) {
  const taoMoi = !matBang?.soCot;
  const [cot, setCot] = useState(String(matBang?.soCot || LUOI_MAT_BANG.cotGoiY));
  const [hang, setHang] = useState(String(matBang?.soHang || LUOI_MAT_BANG.hangGoiY));
  const [dangLuu, setDangLuu] = useState(false);
  const [loiMayChu, setLoiMayChu] = useState("");

  const c = Number(cot);
  const h = Number(hang);
  const loi = {};
  if (!Number.isInteger(c) || c < LUOI_MAT_BANG.toiThieu || c > LUOI_MAT_BANG.cotToiDa) {
    loi.cot = `Từ ${LUOI_MAT_BANG.toiThieu} đến ${LUOI_MAT_BANG.cotToiDa} cột.`;
  }
  if (!Number.isInteger(h) || h < LUOI_MAT_BANG.toiThieu || h > LUOI_MAT_BANG.hangToiDa) {
    loi.hang = `Từ ${LUOI_MAT_BANG.toiThieu} đến ${LUOI_MAT_BANG.hangToiDa} hàng.`;
  }
  const biCat = !loi.cot && !loi.hang && !taoMoi ? vatNgoaiLuoi(matBang, c, h, tenKhu) : "";
  const hopLe = !loi.cot && !loi.hang && !biCat;

  const luu = async () => {
    if (!hopLe) return;
    setDangLuu(true);
    setLoiMayChu("");
    try {
      await onXacNhan({ soCot: c, soHang: h });
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, "Không lưu được mặt bằng. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  return (
    <KhungHop
      tieuDe={taoMoi ? "Tạo mặt bằng kho" : "Kích thước lưới"}
      moTa="Mặt bằng nhìn từ trên xuống, chia thành lưới ô vuông. Nên để một ô ứng với một khoảng cố định ngoài kho (VD 1 m)."
      onHuy={onDong}
      onGui={luu}
      khoaGui={!hopLe}
      nhanGui={taoMoi ? "Tạo mặt bằng" : "Lưu kích thước"}
      dangGui={dangLuu}
    >
      <div className="grid grid-cols-2 gap-4">
        <Truong nhan="Số cột (chiều ngang)" htmlFor="luoi-cot" loi={loi.cot}>
          <input
            id="luoi-cot"
            autoFocus
            inputMode="numeric"
            value={cot}
            onChange={(e) => setCot(e.target.value.replace(/\D/g, "").slice(0, 3))}
            aria-invalid={Boolean(loi.cot)}
            className={`${O_NHAP} tabular-nums`}
          />
        </Truong>
        <Truong nhan="Số hàng (chiều dọc)" htmlFor="luoi-hang" loi={loi.hang}>
          <input
            id="luoi-hang"
            inputMode="numeric"
            value={hang}
            onChange={(e) => setHang(e.target.value.replace(/\D/g, "").slice(0, 3))}
            aria-invalid={Boolean(loi.hang)}
            className={`${O_NHAP} tabular-nums`}
          />
        </Truong>
      </div>
      {biCat ? (
        <DongThongBao tone="warn">Lưới mới cắt mất “{biCat}”. Vẽ lại hoặc gỡ vật đó trước khi thu nhỏ.</DongThongBao>
      ) : loiMayChu ? (
        <DongThongBao tone="bad">{loiMayChu}</DongThongBao>
      ) : taoMoi ? (
        <DongThongBao>Sau khi tạo, bấm Vẽ để đặt khu vực, lối đi, cửa và vật cố định lên lưới.</DongThongBao>
      ) : null}
    </KhungHop>
  );
}
