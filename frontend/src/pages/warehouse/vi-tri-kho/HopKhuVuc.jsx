import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { LOAI_KHU } from "@/constants/nhapKho";
import { viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { KhungHop, Truong } from "./KhungHop";
import { O_GHI_CHU, O_NHAP, kiemTraKhuMoi } from "./kieuNhap";
import { t } from "@/i18n";

/**
 * Thêm hoặc sửa khu vực trong kho (FO-094). Mã khu không trùng trong cùng kho và không đổi sau khi tạo.
 * - khuSua: khu đang sửa (null = thêm mới).
 * - onDaLuu(khu, { laSua }).
 * - onXoa(khu): bấm "Xóa khu vực" ở chân hộp (trang cha hỏi xác nhận và kiểm tra còn vị trí hay không).
 */
export default function HopKhuVuc({ open, onOpenChange, khoId, khuVucs, khuSua, onDaLuu, onXoa }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung
          khoId={khoId}
          khuVucs={khuVucs}
          khuSua={khuSua}
          onDong={() => onOpenChange(false)}
          onDaLuu={onDaLuu}
          onXoa={onXoa}
        />
      ) : null}
    </Dialog>
  );
}

function NoiDung({ khoId, khuVucs, khuSua, onDong, onDaLuu, onXoa }) {
  const sua = Boolean(khuSua);
  const [ma, setMa] = useState(khuSua?.maKhuVuc ?? "");
  const [ten, setTen] = useState(khuSua?.tenKhuVuc ?? "");
  const [loai, setLoai] = useState(khuSua?.loaiKhu || LOAI_KHU[0]);
  const [ghiChu, setGhiChu] = useState(khuSua?.ghiChu ?? "");
  const [daGui, setDaGui] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiMayChu, setLoiMayChu] = useState("");

  // Khi sửa: mã khóa, chỉ kiểm tra tên (không so trùng mã với chính khu đang sửa)
  const kiemTra = kiemTraKhuMoi({ ma, ten }, sua ? khuVucs.filter((k) => k.id !== khuSua.id) : khuVucs);
  const loi = sua ? { ten: kiemTra.loi.ten } : kiemTra.loi;
  const hopLe = sua ? !loi.ten : kiemTra.hopLe;
  // Loại khu cũ không còn trong danh sách vẫn giữ để không mất dữ liệu
  const dsLoai = LOAI_KHU.includes(loai) ? LOAI_KHU : [loai, ...LOAI_KHU];

  const luu = async () => {
    setDaGui(true);
    if (!hopLe) return;
    setDangLuu(true);
    setLoiMayChu("");
    const thongTin = { tenKhuVuc: ten.trim(), loaiKhu: loai, ghiChu: ghiChu.trim() || null };
    try {
      const khu = sua
        ? await viTriKhoService.suaKhuVuc(khoId, khuSua.id, thongTin)
        : await viTriKhoService.taoKhuVuc(khoId, { maKhuVuc: kiemTra.maChuan, ...thongTin });
      onDaLuu(sua ? { ...khuSua, ...thongTin, ...(khu ?? {}) } : khu, { laSua: sua });
    } catch (err) {
      setLoiMayChu(getApiErrorMessage(err, t("Không lưu được khu vực. Vui lòng thử lại.")));
      setDangLuu(false);
    }
  };

  return (
    <KhungHop
      tieuDe={sua ? t("Sửa khu vực {{maKhuVuc}}", { maKhuVuc: khuSua.maKhuVuc }) : t("Thêm khu vực")}
      moTa={sua ? t("Mã khu không đổi được; tên, loại và ghi chú sửa thoải mái.") : t("Khu vực gom các dãy kệ cùng loại hàng, VD Khu A – Áo.")}
      onHuy={onDong}
      onGui={luu}
      nhanGui={sua ? t("Lưu thay đổi") : t("Lưu khu vực")}
      dangGui={dangLuu}
      chanTrai={
        sua && onXoa ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onXoa(khuSua)}
            disabled={dangLuu}
            className="h-9 gap-1.5 px-2 text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
          >
            <Trash2 className="size-4" />
            {t("Xóa khu vực")}
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Truong
          nhan={t("Mã khu vực")}
          htmlFor="kv-ma"
          loi={daGui && !sua ? loi.ma : ""}
          goiY={sua ? t("Không đổi sau khi tạo") : t("Không trùng trong cùng kho")}
        >
          <input
            id="kv-ma"
            autoFocus={!sua}
            disabled={sua}
            value={ma}
            onChange={(e) => setMa(e.target.value.toUpperCase())}
            placeholder={t("VD: {{viDu}}", { viDu: "KHU-A" })}
            aria-invalid={daGui && !sua && Boolean(loi.ma)}
            className={`${O_NHAP} font-mono`}
          />
        </Truong>
        <Truong nhan={t("Tên khu vực")} htmlFor="kv-ten" loi={daGui ? loi.ten : ""}>
          <input
            id="kv-ten"
            autoFocus={sua}
            value={ten}
            onChange={(e) => setTen(e.target.value)}
            placeholder={t("VD: Khu A – Áo")}
            aria-invalid={daGui && Boolean(loi.ten)}
            className={O_NHAP}
          />
        </Truong>
      </div>
      <Truong nhan={t("Loại khu")} htmlFor="kv-loai">
        <select id="kv-loai" value={loai} onChange={(e) => setLoai(e.target.value)} className={O_NHAP}>
          {dsLoai.map((l) => (
            <option key={l} value={l}>{t(l)}</option>
          ))}
        </select>
      </Truong>
      <Truong nhan={t("Ghi chú")} htmlFor="kv-ghi-chu">
        <textarea id="kv-ghi-chu" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("Không bắt buộc")} className={O_GHI_CHU} />
      </Truong>
      {loiMayChu ? <DongThongBao tone="bad">{loiMayChu}</DongThongBao> : null}
    </KhungHop>
  );
}
