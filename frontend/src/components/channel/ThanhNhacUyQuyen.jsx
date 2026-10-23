import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import AttentionBar from "@/components/shared/AttentionBar";
import { ngayThang } from "@/components/channel/ngay";
import { hanUyQuyen, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { cauLoiUyQuyen, moTrangUyQuyen } from "@/components/channel/uyQuyen";

/**
 * Thanh nhắc ủy quyền của sàn ủy quyền (KH mục B.5): hết hạn → đỏ (kể cả khi máy chủ không trả ngày hết hạn);
 * còn ≤ 7 ngày → vàng. "Ủy quyền lại" mở thẳng trang đồng ý của sàn (giữ nguyên cấu hình); đã hết hạn mà sàn có
 * nhập mã tay (tài khoản thử TikTok Shop) thì mở bước 1 Thiết lập để chọn cách. Shopify và gian hàng chưa kết nối
 * không có thanh này.
 */
export default function ThanhNhacUyQuyen({ san, ketNoi }) {
  const navigate = useNavigate();
  const [dangMo, setDangMo] = useState(false);
  const dangMoRef = useRef(false);
  if (san?.kieuKetNoi !== "uy_quyen") return null;
  const hetHan = trangThaiKetNoi(ketNoi) === "het_han";
  const han = hanUyQuyen(ketNoi);
  if (!hetHan && !han?.sapHet) return null;

  // Mục nhập mã tay chỉ có ở khối "Ủy quyền đã hết hạn" của bước 1: sắp hết hạn thì mở thẳng trang của sàn
  const coMaThuCong = hetHan && Boolean(san.maThuCong) && ketNoi?.choPhepMaThuCong !== false;
  const uyQuyenLai = async () => {
    if (coMaThuCong) {
      // Qua lớp chặn rời trang: trang Cấu hình còn thay đổi chưa lưu thì hỏi trước
      xinRoiTrang(() => navigate(`${san.duongDan}/setup?buoc=1`));
      return;
    }
    if (dangMoRef.current) return;
    dangMoRef.current = true;
    setDangMo(true);
    try {
      await moTrangUyQuyen(san, { uyQuyenLai: true });
      // Trang đang chuyển sang sàn; người dùng ở lại / quay lại bằng Back thì nhả sau một lúc
      window.setTimeout(() => {
        dangMoRef.current = false;
        setDangMo(false);
      }, 4000);
    } catch (error) {
      toast.error(cauLoiUyQuyen(error, `Không mở được trang ủy quyền của ${san.ten}`));
      dangMoRef.current = false;
      setDangMo(false);
    }
  };
  const nhanNut = dangMo ? `Đang mở trang ${san.ten}…` : "Ủy quyền lại";

  if (hetHan) {
    return (
      <AttentionBar count={1} tone="danger" actionLabel={nhanNut} onAction={uyQuyenLai}>
        Ủy quyền {san.ten} đã hết hạn: hệ thống không gọi được {san.ten}, tồn kho và đơn hàng đang dừng đồng bộ.
      </AttentionBar>
    );
  }
  return (
    <AttentionBar count={1} actionLabel={nhanNut} onAction={uyQuyenLai}>
      {han.soNgay > 0
        ? `Ủy quyền ${san.ten} hết hạn sau ${han.soNgay} ngày (${ngayThang(han.han, { coNam: true })}). Ủy quyền lại trước ngày đó để đồng bộ không bị gián đoạn.`
        : `Ủy quyền ${san.ten} hết hạn trong hôm nay (${ngayThang(han.han, { coNam: true })}). Ủy quyền lại ngay để đồng bộ không bị gián đoạn.`}
    </AttentionBar>
  );
}
