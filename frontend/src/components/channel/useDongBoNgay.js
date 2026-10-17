import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { DB_TRANG_THAI, dangChayDongBo, uocTinhConLaiMs } from "./tienDoDongBo";

const CHU_KY_HOI_MS = 1000;
const CHU_KY_HOI_LAI_KHI_LOI_MS = 3000;
const LY_DO_MAT_THEO_DOI =
  "Không còn theo dõi được đợt này vì máy chủ vừa khởi động lại. SKU đã đẩy vẫn được lưu, bấm Đồng bộ lại để chạy tiếp.";

/**
 * "Đồng bộ ngay" của một kênh: máy chủ chạy nền, trang hỏi tiến độ mỗi giây trong lúc chạy.
 * Mở trang khi đợt đang chạy (bấm ở tab khác, người khác bấm) vẫn thấy tiến độ.
 *
 * - `onXong(phien)`: gọi một lần khi một đợt mà trang này đã thấy đang chạy kết thúc (để tải lại số liệu).
 * - `cuaTrangNay`: đợt đang có là đợt trang này bấm hoặc đã thấy đang chạy; đợt cũ từ trước khi mở trang thì false.
 * - `conLaiMs`: thời gian còn lại ước tính, không nhảy ngược lên vì dao động nhỏ giữa hai lần hỏi.
 */
export default function useDongBoNgay(maKenh, { enabled = true, onXong } = {}) {
  const [phien, setPhien] = useState(null);
  const [conLaiMs, setConLaiMs] = useState(null);
  const [maTheoDoi, setMaTheoDoi] = useState(null);
  const [dangGui, setDangGui] = useState(false);
  const [soLanLoi, setSoLanLoi] = useState(0);
  const dangGuiRef = useRef(false);
  const daThayChay = useRef(new Set());
  const daBaoXong = useRef(new Set());
  const conLaiTruoc = useRef({ maPhien: null, ms: null });
  const onXongRef = useRef(onXong);
  useEffect(() => {
    onXongRef.current = onXong;
  });

  const daNhanRef = useRef(false);

  const nhan = useCallback((p) => {
    daNhanRef.current = true;
    setPhien(p ?? null);
    setSoLanLoi(0);
    if (!p) {
      setConLaiMs(null);
      return;
    }
    let ms = uocTinhConLaiMs(p);
    const truoc = conLaiTruoc.current;
    if (ms != null && truoc.maPhien === p.maPhien && truoc.ms != null && ms > truoc.ms && ms < truoc.ms + 10_000) {
      ms = truoc.ms;
    }
    conLaiTruoc.current = { maPhien: p.maPhien, ms };
    setConLaiMs(ms);
    if (dangChayDongBo(p)) {
      daThayChay.current.add(p.maPhien);
      setMaTheoDoi(p.maPhien);
    } else if (daThayChay.current.has(p.maPhien) && !daBaoXong.current.has(p.maPhien)) {
      daBaoXong.current.add(p.maPhien);
      onXongRef.current?.(p);
    }
  }, []);

  // Mở trang: có đợt đang chạy thì hiện tiến độ luôn
  useEffect(() => {
    if (!enabled) return undefined;
    let boQua = false;
    kenhBanHangService.layDongBoNgay(maKenh).then(
      (p) => {
        // Đã bấm Đồng bộ ngay trước khi lần hỏi đầu trả về: giữ đợt vừa bấm, không lấy đợt cũ đè lên
        if (!boQua && !daNhanRef.current) nhan(p);
      },
      () => {},
    );
    return () => {
      boQua = true;
    };
  }, [enabled, maKenh, nhan]);

  // Đang chạy: hỏi lại sau mỗi giây; lỗi mạng thì giãn ra 3 giây, không bỏ theo dõi
  const chay = dangChayDongBo(phien);
  useEffect(() => {
    if (!enabled || !chay) return undefined;
    let boQua = false;
    const hen = setTimeout(
      () => {
        kenhBanHangService.layDongBoNgay(maKenh).then(
          (p) => {
            if (boQua) return;
            nhan(p ?? { ...phien, trangThai: DB_TRANG_THAI.LOI, loi: LY_DO_MAT_THEO_DOI, skuDangDay: null });
          },
          () => {
            if (!boQua) setSoLanLoi((n) => n + 1);
          },
        );
      },
      soLanLoi > 0 ? CHU_KY_HOI_LAI_KHI_LOI_MS : CHU_KY_HOI_MS,
    );
    return () => {
      boQua = true;
      clearTimeout(hen);
    };
  }, [enabled, chay, phien, soLanLoi, maKenh, nhan]);

  /** Bắt đầu một đợt; trả ảnh chụp đầu tiên, lỗi thì báo và trả null. */
  const batDau = useCallback(async () => {
    if (dangGuiRef.current) return null;
    dangGuiRef.current = true;
    setDangGui(true);
    try {
      const p = await kenhBanHangService.batDauDongBoNgay(maKenh);
      if (p?.maPhien) setMaTheoDoi(p.maPhien);
      nhan(p);
      return p;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không bắt đầu được đồng bộ"));
      return null;
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  }, [maKenh, nhan]);

  const dung = useCallback(async () => {
    try {
      const p = await kenhBanHangService.dungDongBoNgay(maKenh);
      if (p) nhan(p);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không dừng được đồng bộ"));
    }
  }, [maKenh, nhan]);

  return {
    phien,
    dangChay: chay,
    dangGui,
    conLaiMs,
    cuaTrangNay: Boolean(phien) && phien.maPhien === maTheoDoi,
    batDau,
    dung,
  };
}
