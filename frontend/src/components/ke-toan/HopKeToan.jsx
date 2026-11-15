import { useId, useState } from "react";
import { Ban, LockOpen } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { toast } from "@/lib/thongBaoNhanh";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";

const LY_DO_TOI_DA = 500;

/** Ô lý do bắt buộc (ghi nhật ký) trong hộp mở khóa / hủy lô: nhãn có *, đếm ký tự. */
function OLyDoNhatKy({ giaTri, onDoi, goiY, disabled }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-ly-do`} className={NHAN_O}>
        {t("Lý do")} <span className="text-bo-danger">*</span>
      </label>
      <textarea id={`${id}-ly-do`} rows={3} maxLength={LY_DO_TOI_DA} value={giaTri} placeholder={goiY} disabled={disabled}
        aria-required="true" aria-describedby={`${id}-goi-y`}
        onChange={(e) => onDoi(e.target.value.slice(0, LY_DO_TOI_DA))}
        className={O_NHAP_NHIEU_DONG} />
      <p id={`${id}-goi-y`} className={GOI_Y_O}>
        <span>{t("Bắt buộc · ghi vào nhật ký")}</span>
        <span>{giaTri.length}/{LY_DO_TOI_DA}</span>
      </p>
    </div>
  );
}

/** Hộp mở khóa một chứng từ đã giao (hộp xác nhận chung của màn chứng từ): bắt nhập lý do (ghi nhật ký). */
export function HopMoKhoa({ chungTu, onDong, onXong, onLoiXungDot }) {
  const [lyDo, setLyDo] = useState("");
  const [dangMo, setDangMo] = useState(false);
  const [loi, setLoi] = useState(null);

  const xacNhan = async () => {
    if (dangMo || !lyDo.trim()) return;
    setDangMo(true);
    setLoi(null);
    try {
      const kq = await keToanService.moKhoa(chungTu.id, lyDo.trim());
      toast.success(t("Đã mở khóa {{soChungTu}}. Chứng từ sẽ vào lô sau.", { soChungTu: chungTu.soChungTu }));
      onXong(kq);
    } catch (e) {
      // Người khác vừa mở khóa: tải lại danh sách để thấy đúng trạng thái
      if (e?.response?.status === 409) onLoiXungDot();
      setLoi(getApiErrorMessage(e, t("Không mở khóa được")));
    } finally {
      setDangMo(false);
    }
  };

  return (
    <HopXacNhanChungTu
      mo
      onDoiMo={(m) => !m && !dangMo && onDong()}
      tieuDe={t("Mở khóa {{soChungTu}}?", { soChungTu: chungTu.soChungTu })}
      moTa={t("Chứng từ quay về \"chưa xuất\" và vào lô sau. Kế toán phải xóa chứng từ này trên AMIS trước khi nhập lô mới, vì AMIS chỉ thêm mới và báo trùng số chứng từ. Lần mở khóa được ghi nhật ký.")}
      nhanXacNhan={t("Mở khóa")}
      iconXacNhan={LockOpen}
      kieu="nguyHiem"
      rong
      dangChay={dangMo}
      khoaXacNhan={!lyDo.trim()}
      lyDoKhoa={t("Nhập lý do mở khóa")}
      loi={loi}
      onXacNhan={xacNhan}
    >
      <OLyDoNhatKy giaTri={lyDo} disabled={dangMo} goiY={t("VD: Kế toán đã xóa chứng từ trên AMIS để sửa ngày hạch toán")}
        onDoi={(v) => { setLyDo(v); setLoi(null); }} />
    </HopXacNhanChungTu>
  );
}

/**
 * Hộp hủy lô (chỉ lô còn hiệu lực mới nhất; hộp xác nhận chung của màn chứng từ): bắt nhập lý do (ghi nhật ký) và xác nhận
 * kế toán chưa nhập lô vào AMIS hoặc đã xóa các chứng từ của lô trên AMIS — không thì lô mới nhập vào bị trùng chứng từ.
 * Nút Hủy lô khóa (kèm lý do ở chân hộp) tới khi đủ hai điều đó.
 */
export function HopHuyLo({ lo, onDong, onXong, onLoiXungDot }) {
  const id = useId();
  const [lyDo, setLyDo] = useState("");
  const [daKiem, setDaKiem] = useState(false);
  const [dangHuy, setDangHuy] = useState(false);
  const [loi, setLoi] = useState(null);

  const lyDoKhoa = !daKiem ? t("Đánh dấu ô xác nhận trước khi hủy lô") : !lyDo.trim() ? t("Nhập lý do hủy lô") : null;

  const xacNhan = async () => {
    if (dangHuy || lyDoKhoa) return;
    setDangHuy(true);
    setLoi(null);
    try {
      const kq = await keToanService.huyLo(lo.id, lyDo.trim());
      toast.success(t("Đã hủy lô {{soLo}}. Chứng từ của lô sẽ vào lô sau.", { soLo: lo.soLo }));
      onXong(kq);
    } catch (e) {
      // Người khác vừa hủy lô này hoặc vừa tạo lô mới hơn: tải lại danh sách để thấy đúng lô hủy được
      if (e?.response?.status === 409) onLoiXungDot();
      setLoi(getApiErrorMessage(e, t("Không hủy được lô")));
    } finally {
      setDangHuy(false);
    }
  };

  return (
    <HopXacNhanChungTu
      mo
      onDoiMo={(m) => !m && !dangHuy && onDong()}
      tieuDe={t("Hủy lô {{soLo}}?", { soLo: lo.soLo })}
      moTa={t("Mọi chứng từ của lô quay về \"chưa xuất\" và vào lô sau. Tệp nén vẫn giữ để đối chiếu. Lần hủy được ghi nhật ký.")}
      nhanXacNhan={t("Hủy lô")}
      iconXacNhan={Ban}
      kieu="nguyHiem"
      rong
      dangChay={dangHuy}
      khoaXacNhan={Boolean(lyDoKhoa)}
      lyDoKhoa={lyDoKhoa ?? undefined}
      loi={loi}
      onXacNhan={xacNhan}
    >
      <label htmlFor={`${id}-xac-nhan`} className="flex items-start gap-2.5 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-[13px] leading-5 text-bo-foreground">
        <input id={`${id}-xac-nhan`} type="checkbox" checked={daKiem} disabled={dangHuy}
          onChange={(e) => { setDaKiem(e.target.checked); setLoi(null); }}
          className="mt-0.5 size-4 shrink-0 accent-bo-primary" />
        <span>{t("Kế toán chưa nhập lô này vào AMIS, hoặc đã xóa trên AMIS mọi chứng từ của lô.")}</span>
      </label>
      <OLyDoNhatKy giaTri={lyDo} disabled={dangHuy} goiY={t("VD: Nhập vào AMIS bị lỗi, cần sửa đơn rồi xuất lại")}
        onDoi={(v) => { setLyDo(v); setLoi(null); }} />
    </HopXacNhanChungTu>
  );
}
