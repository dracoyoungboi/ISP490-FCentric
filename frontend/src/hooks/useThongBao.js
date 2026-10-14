import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { thongBaoService } from "@/services/thongBaoService";

const moiNhatTruoc = (a, b) => new Date(b.thoiGian).getTime() - new Date(a.thoiGian).getTime();

function chuanHoa(ds) {
  return (Array.isArray(ds) ? ds : []).slice().sort(moiNhatTruoc);
}

/**
 * Danh sách thông báo của người đang đăng nhập cho chuông trên thanh trên cùng.
 * Tải một lần khi vào trang; `taiLai` gọi lại mỗi lần mở bảng.
 * Đánh dấu đã đọc cập nhật giao diện ngay rồi mới gửi đi (chưa có API nên chưa cần hoàn tác khi lỗi).
 * `dangBat = false` (tính năng chưa sẵn sàng): không gọi máy chủ, danh sách luôn rỗng.
 */
export default function useThongBao({ dangBat = true } = {}) {
  const [items, setItems] = useState([]);
  const [dangTai, setDangTai] = useState(dangBat);
  const [loi, setLoi] = useState(false);
  const lanTai = useRef(0);
  const daCoDuLieu = useRef(false);

  const nhanKetQua = useCallback((lan, ds) => {
    if (lan !== lanTai.current) return;
    daCoDuLieu.current = true;
    setItems(chuanHoa(ds));
    setLoi(false);
    setDangTai(false);
  }, []);

  const nhanLoi = useCallback((lan) => {
    if (lan !== lanTai.current) return;
    // Đã có danh sách thì giữ nguyên, chỉ báo lỗi khi chưa tải được lần nào.
    if (!daCoDuLieu.current) setLoi(true);
    setDangTai(false);
  }, []);

  useEffect(() => {
    if (!dangBat) return;
    const lan = ++lanTai.current;
    thongBaoService.layDanhSach().then(
      (ds) => nhanKetQua(lan, ds),
      () => nhanLoi(lan),
    );
  }, [dangBat, nhanKetQua, nhanLoi]);

  const taiLai = useCallback(() => {
    if (!dangBat) return;
    const lan = ++lanTai.current;
    if (!daCoDuLieu.current) {
      setLoi(false);
      setDangTai(true);
    }
    thongBaoService.layDanhSach().then(
      (ds) => nhanKetQua(lan, ds),
      () => nhanLoi(lan),
    );
  }, [dangBat, nhanKetQua, nhanLoi]);

  const danhDauDaDoc = useCallback((id) => {
    setItems((ds) => ds.map((n) => (n.id === id ? { ...n, daDoc: true } : n)));
    thongBaoService.danhDauDaDoc(id).catch(() => {});
  }, []);

  const danhDauTatCaDaDoc = useCallback(() => {
    setItems((ds) => ds.map((n) => (n.daDoc ? n : { ...n, daDoc: true })));
    thongBaoService.danhDauTatCaDaDoc().catch(() => {});
  }, []);

  const soChuaDoc = useMemo(() => items.filter((n) => !n.daDoc).length, [items]);

  return { items, soChuaDoc, dangTai, loi, taiLai, danhDauDaDoc, danhDauTatCaDaDoc };
}
