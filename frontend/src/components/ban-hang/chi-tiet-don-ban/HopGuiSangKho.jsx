import { useCallback, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import DanhSachChonKho from "@/components/ban-hang/DanhSachChonKho";
import { cauKhoThieu, coTimKho, idKho, khoChonDuoc, khoChonSan, locKho, xepKho } from "@/components/ban-hang/chonKho";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { donBanHangService } from "@/services/donBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";

const giongId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Hộp "Gửi sang kho" của đơn Nháp: chọn kho xuất theo tồn khả dụng (GET /don-ban-hang/{id}/kho-kha-dung), xếp kho đủ
 * hàng trước; kho hiện tại của đơn chỉ được chọn sẵn khi đủ hàng. Kho thiếu vẫn chọn được (máy chủ cho gửi) kèm cảnh báo
 * và các mặt hàng thiếu "cần · còn". Mỗi lần mở tải lại tồn khả dụng.
 *
 * - `mo`, `onDoiMo`: như HopXacNhanChungTu. `don`: donBanHang (mã, kho hiện tại).
 * - `onXacNhan(kho)`: màn gọi API gửi sang kho; `dangChay`, `loi` (câu lỗi hiện trong hộp) do màn quản lý.
 */
export default function HopGuiSangKho({ mo, onDoiMo, don, dangChay = false, loi, onXacNhan }) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [chonTay, setChonTay] = useState(null);
  // Mở lại hộp: bỏ lựa chọn và từ khóa của lần trước (đặt lại ngay trong lúc vẽ, không cần effect)
  const [moTruoc, setMoTruoc] = useState(mo);
  if (moTruoc !== mo) {
    setMoTruoc(mo);
    if (mo) {
      setTuKhoa("");
      setChonTay(null);
    }
  }

  const donId = don?.id;
  const tai = useCallback(async () => khoChonDuoc(await donBanHangService.getKhoKhaDung(donId)), [donId]);
  const q = useTaiDuLieu(tai, `kho-kha-dung-${donId}`, { enabled: Boolean(mo && donId) });

  const dsKho = useMemo(() => xepKho(Array.isArray(q.data) ? q.data : []), [q.data]);
  const khoHienTaiId = don?.khoXuat?.id ?? null;
  const macDinh = khoChonSan(dsKho, khoHienTaiId);
  const chonId = chonTay ?? macDinh;
  const khoChon = dsKho.find((k) => giongId(idKho(k), chonId)) ?? null;
  const khoHienTai = dsKho.find((k) => giongId(idKho(k), khoHienTaiId)) ?? null;
  const dangTai = q.loading && !q.data;
  const loiTai = !q.loading && q.error ? getApiErrorMessage(q.error, "Không tải được tồn khả dụng của các kho") : null;

  return (
    <HopXacNhanChungTu
      mo={mo}
      onDoiMo={onDoiMo}
      rong
      tieuDe="Gửi sang kho"
      moTa={`Chọn kho xuất cho đơn ${don?.soDonHang ?? ""}. Đơn chuyển sang Chờ nhặt hàng và hiện ở Đơn chờ xuất của kho đó.`}
      nhanXacNhan="Gửi sang kho"
      iconXacNhan={Send}
      dangChay={dangChay}
      // Đang tải lại hoặc vừa tải lỗi: không gửi theo danh sách cũ (đang bị che bởi dòng lỗi)
      khoaXacNhan={!khoChon || q.loading || Boolean(loiTai)}
      loi={loi}
      onXacNhan={() => khoChon && onXacNhan?.(khoChon)}
    >
      {dangTai ? (
        <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-bo-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải tồn khả dụng của các kho
        </p>
      ) : loiTai ? (
        <DongThongBao tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
          {loiTai}
        </DongThongBao>
      ) : dsKho.length === 0 ? (
        <p className="py-6 text-center text-sm text-bo-muted">Không có kho nào đang hoạt động để gửi đơn.</p>
      ) : (
        <>
          <DanhSachChonKho
            ds={locKho(dsKho, tuKhoa)}
            coTim={coTimKho(dsKho.length)}
            tuKhoa={tuKhoa}
            onDoiTuKhoa={setTuKhoa}
            chonId={chonId}
            onChon={setChonTay}
            khoHienTaiId={khoHienTaiId}
            khoa={dangChay}
          />
          {!khoChon && !(tuKhoa.trim() && locKho(dsKho, tuKhoa).length === 0) ? (
            <p className="text-[13px] leading-5 text-bo-muted">
              {khoHienTai && !khoHienTai.duHang
                ? "Kho hiện tại không đủ hàng nên chưa chọn sẵn. Chọn một kho để gửi."
                : "Chọn một kho để gửi."}
            </p>
          ) : khoChon && !khoChon.duHang ? (
            <DongThongBao tone="warn">{cauKhoThieu(khoChon)}</DongThongBao>
          ) : null}
        </>
      )}
    </HopXacNhanChungTu>
  );
}
