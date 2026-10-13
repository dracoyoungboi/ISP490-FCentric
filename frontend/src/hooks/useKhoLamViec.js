import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  chonKhoLamViecHopLe, getKhoLamViecId, layDanhSachKhoLamViec, setKhoLamViecId,
} from "@/utils/khoLamViec";

/**
 * Kho làm việc cho các màn nhặt hàng (Đơn chờ xuất, Phiếu nhặt hàng).
 * - Nạp danh sách kho được phép; kho đang lưu thiếu hoặc không hợp lệ (vd. từng bị xóa) thì tự
 *   chuyển sang kho đầu tiên thay vì để backend báo "Vui lòng chọn ngữ cảnh kho làm việc".
 * - Đổi kho ghi lại kho làm việc chung, nên các thao tác phía sau (tạo phiếu nhặt, phân công)
 *   gửi đúng header kho_id.
 *
 * @param {{ mock?: boolean }} [options] mock = chạy dữ liệu mẫu, không gọi API kho
 */
export default function useKhoLamViec({ mock = false } = {}) {
  const [dsKho, setDsKho] = useState([]);
  const [khoId, setKhoId] = useState(null);
  const [trangThai, setTrangThai] = useState("loading"); // loading | ready | empty | error

  const taiDsKho = useCallback(async () => {
    setTrangThai("loading");
    if (mock) {
      setKhoId(getKhoLamViecId() ?? 1);
      setTrangThai("ready");
      return;
    }
    try {
      const ds = await layDanhSachKhoLamViec();
      const id = chonKhoLamViecHopLe(ds);
      setDsKho(ds);
      setKhoId(id);
      setTrangThai(id ? "ready" : "empty");
    } catch (error) {
      setTrangThai("error");
      toast.error(getApiErrorMessage(error, "Không tải được danh sách kho"));
    }
  }, [mock]);

  useEffect(() => {
    queueMicrotask(() => taiDsKho());
  }, [taiDsKho]);

  const khoOptions = useMemo(
    () => dsKho.map((kho) => ({ value: String(kho.id), label: kho.tenKho })),
    [dsKho],
  );
  const tenKho = dsKho.find((kho) => kho.id === khoId)?.tenKho;

  /** Đổi kho làm việc; trả về true nếu thật sự đổi sang kho khác. */
  const doiKho = useCallback((value) => {
    const id = Number(value);
    if (!id || id === khoId) return false;
    setKhoLamViecId(id);
    setKhoId(id);
    return true;
  }, [khoId]);

  return { khoId, khoOptions, tenKho, trangThai, taiDsKho, doiKho };
}
