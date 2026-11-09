import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { LOAI_VAT_MAT_BANG, THONG_BAO_KHU_QUA_NHO, khuQuaNho } from "@/components/mat-bang/matBang";
import { HUONG_CUA, LOAI_KHU } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import { KhungHop, NhomChon, Truong } from "./KhungHop";
import { O_NHAP, kiemTraKhuMoi } from "./kieuNhap";
import { t } from "@/i18n";

const NGUON_KHU = [
  { ma: "co", ten: t("Khu có sẵn") },
  { ma: "moi", ten: t("Khu mới") },
];

const GOI_Y_TEN = { loiDi: t("VD: Lối đi chính"), cua: t("VD: Cửa nhận hàng"), vatCoDinh: t("VD: Bàn kiểm đếm") };

/**
 * Sau khi vẽ một hình trên mặt bằng: chọn hình đó là gì (khu vực có sẵn / khu mới / lối đi / cửa / vật cố định).
 * onXacNhan(luaChon) trả về Promise; lỗi thì hiện ngay trong hộp, không đóng hộp.
 * luaChon: { loai: "khuVuc", khuVucId } | { loai: "khuVuc", khuMoi: { maKhuVuc, tenKhuVuc, loaiKhu } }
 *        | { loai: "loiDi" | "vatCoDinh", ten } | { loai: "cua", ten, huong }
 */
// Hình mỏng (1 ô) thường là lối đi hoặc cửa: mở hộp với loại đó cho đỡ một lần bấm
const loaiGoiY = (hinh) => (khuQuaNho(hinh) ? "loiDi" : "khuVuc");

export default function HopDatLenMatBang({ open, onOpenChange, hinh, khuChuaDat, khuVucs, onXacNhan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && hinh ? (
        <NoiDung hinh={hinh} khuChuaDat={khuChuaDat} khuVucs={khuVucs} onDong={() => onOpenChange(false)} onXacNhan={onXacNhan} />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ hinh, khuChuaDat, khuVucs, onDong, onXacNhan }) {
  const [loai, setLoai] = useState(() => loaiGoiY(hinh));
  const [nguon, setNguon] = useState(khuChuaDat.length ? "co" : "moi");
  const [khuVucId, setKhuVucId] = useState(String(khuChuaDat[0]?.id ?? ""));
  const [ma, setMa] = useState("");
  const [tenKhu, setTenKhu] = useState("");
  const [loaiKhu, setLoaiKhu] = useState(LOAI_KHU[0]);
  const [ten, setTen] = useState("");
  const [huong, setHuong] = useState(HUONG_CUA[0].ma);
  const [daGui, setDaGui] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiMayChu, setLoiMayChu] = useState("");

  const khuMoi = loai === "khuVuc" && nguon === "moi";
  const kiemTra = kiemTraKhuMoi({ ma, ten: tenKhu }, khuVucs);
  const quaNho = loai === "khuVuc" && khuQuaNho(hinh);
  const loi = {};
  if (quaNho) loi.kichThuoc = t("{{thongBao}} Chọn Lối đi, Cửa hoặc Vật cố định, hoặc vẽ lại hình lớn hơn.", { thongBao: THONG_BAO_KHU_QUA_NHO });
  if (loai === "khuVuc" && nguon === "co" && !khuVucId) loi.khu = t("Chọn khu vực.");
  if (khuMoi) Object.assign(loi, kiemTra.loi);
  if (loai !== "khuVuc" && !ten.trim()) loi.tenVat = t("Nhập tên để nhân viên nhận ra trên mặt bằng.");
  const hopLe = Object.keys(loi).length === 0;
  const loiHien = daGui ? loi : {};

  const xacNhan = async () => {
    setDaGui(true);
    if (!hopLe) return;
    let luaChon;
    if (loai === "khuVuc") {
      luaChon = khuMoi
        ? { loai, khuMoi: { maKhuVuc: kiemTra.maChuan, tenKhuVuc: tenKhu.trim(), loaiKhu } }
        : { loai, khuVucId: Number(khuVucId) };
    } else {
      luaChon = loai === "cua" ? { loai, ten: ten.trim(), huong } : { loai, ten: ten.trim() };
    }
    setDangLuu(true);
    setLoiMayChu("");
    try {
      await onXacNhan(luaChon);
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, t("Không lưu được mặt bằng. Vui lòng thử lại.")));
      setDangLuu(false);
    }
  };

  return (
    <KhungHop
      tieuDe={t("Đặt lên mặt bằng")}
      moTa={t("Hình {{rong}} × {{cao}} ô · bắt đầu từ cột {{x}}, hàng {{y}}", { count: hinh.rong * hinh.cao, rong: hinh.rong, cao: hinh.cao, x: hinh.x, y: hinh.y })}
      onHuy={onDong}
      onGui={xacNhan}
      nhanGui={t("Đặt lên mặt bằng")}
      dangGui={dangLuu}
    >
      <Truong nhan={t("Hình này là")}>
        <NhomChon nhan={t("Loại")} value={loai} onChange={setLoai} luaChon={LOAI_VAT_MAT_BANG} day />
      </Truong>

      {quaNho ? <DongThongBao tone="warn">{loi.kichThuoc}</DongThongBao> : null}

      {loai === "khuVuc" ? (
        <>
          {khuChuaDat.length ? <NhomChon nhan={t("Khu vực")} value={nguon} onChange={setNguon} luaChon={NGUON_KHU} day /> : null}
          {nguon === "co" && khuChuaDat.length ? (
            <Truong nhan={t("Khu vực")} htmlFor="mb-khu" loi={loiHien.khu} goiY={t("Chỉ hiện các khu chưa đặt lên mặt bằng")}>
              <select id="mb-khu" value={khuVucId} onChange={(e) => setKhuVucId(e.target.value)} className={O_NHAP}>
                {khuChuaDat.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.tenKhuVuc} · {k.maKhuVuc}
                  </option>
                ))}
              </select>
            </Truong>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Truong nhan={t("Mã khu vực")} htmlFor="mb-ma" loi={loiHien.ma}>
                  <input
                    id="mb-ma"
                    value={ma}
                    onChange={(e) => setMa(e.target.value.toUpperCase())}
                    placeholder={t("VD: {{viDu}}", { viDu: "KHU-C" })}
                    aria-invalid={Boolean(loiHien.ma)}
                    className={cn(O_NHAP, "font-mono")}
                  />
                </Truong>
                <Truong nhan={t("Tên khu vực")} htmlFor="mb-ten-khu" loi={loiHien.ten}>
                  <input
                    id="mb-ten-khu"
                    value={tenKhu}
                    onChange={(e) => setTenKhu(e.target.value)}
                    placeholder={t("VD: Khu C – Phụ kiện")}
                    aria-invalid={Boolean(loiHien.ten)}
                    className={O_NHAP}
                  />
                </Truong>
              </div>
              <Truong nhan={t("Loại khu")} htmlFor="mb-loai-khu">
                <select id="mb-loai-khu" value={loaiKhu} onChange={(e) => setLoaiKhu(e.target.value)} className={O_NHAP}>
                  {LOAI_KHU.map((l) => (
                    <option key={l} value={l}>{t(l)}</option>
                  ))}
                </select>
              </Truong>
            </>
          )}
        </>
      ) : (
        <>
          <Truong nhan={t("Tên")} htmlFor="mb-ten" loi={loiHien.tenVat}>
            <input
              id="mb-ten"
              value={ten}
              onChange={(e) => setTen(e.target.value)}
              placeholder={GOI_Y_TEN[loai]}
              aria-invalid={Boolean(loiHien.tenVat)}
              className={O_NHAP}
            />
          </Truong>
          {loai === "cua" ? (
            <Truong nhan={t("Hướng cửa")} goiY={t("Chỉ đường trong kho bắt đầu từ cửa nhận hàng")}>
              <NhomChon nhan={t("Hướng cửa")} value={huong} onChange={setHuong} luaChon={HUONG_CUA.map((h) => ({ ...h, ten: t(h.ten) }))} day />
            </Truong>
          ) : null}
        </>
      )}

      {loiMayChu ? (
        <DongThongBao tone="bad">{loiMayChu}</DongThongBao>
      ) : (
        <DongThongBao>{t("Có thể vẽ lại bất cứ lúc nào. Mặt bằng chỉ để chỉ đường, không ảnh hưởng tồn kho.")}</DongThongBao>
      )}
    </KhungHop>
  );
}
