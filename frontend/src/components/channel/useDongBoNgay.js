import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { getCurrentUserId } from "@/utils/roles";
import { DB_TRANG_THAI, dangChayDongBo, uocTinhConLaiMs } from "./tienDoDongBo";
import { docBoNho, ghiBoNho, ngheBoNho, trangThaiDau } from "./boNhoDongBo";

const CHU_KY_HOI_MS = 1000;
const CHU_KY_HOI_LAI_KHI_LOI_MS = 3000;
const LY_DO_MAT_THEO_DOI =
  "Không còn theo dõi được đợt này vì máy chủ vừa khởi động lại. SKU đã đẩy vẫn được lưu, bấm Đồng bộ lại để chạy tiếp.";
/** Mã lỗi (KH mục C.4) cho biết gian hàng không còn gọi được: trang cần đọc lại kết nối. */
const MA_LOI_MAT_KET_NOI = new Set(["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI"]);

/**
 * "Đồng bộ ngay" của một kênh: máy chủ chạy nền, trang hỏi tiến độ mỗi giây trong lúc chạy.
 * Mở trang khi đợt đang chạy (bấm ở trang khác, tab khác, người khác bấm) vẫn thấy tiến độ.
 * Các trang của cùng gian hàng dùng chung bộ nhớ (boNhoDongBo, theo kênh và người đăng nhập): chuyển trang thì hiện
 * ngay đợt đang có; bấm ở trang trước mà máy chủ trả lời sau khi đã sang trang này thì trang này vẫn nhận đợt đó.
 *
 * - `onXong(phien)`: gọi một lần khi một đợt mà trang này đã thấy đang chạy kết thúc (để tải lại số liệu).
 * - `cuaTrangNay`: đợt đang có là đợt trang này (hoặc trang trước trong cùng tab) bấm hay đã thấy đang chạy;
 *   đợt cũ từ trước khi mở trang thì false.
 * - `conLaiMs`: thời gian còn lại ước tính, không nhảy ngược lên vì dao động nhỏ giữa hai lần hỏi.
 * - `daXem` / `danhDauDaXem(maPhien)`: đợt đã mở xem kết quả rồi đóng, nhớ chung cho các trang.
 * - `sanSang`: = `enabled`; chưa sẵn sàng (chưa tải xong thông tin gian hàng) thì không bắt đầu đợt mới.
 * - `onMatKetNoi(error)`: bấm bắt đầu mà máy chủ trả `UY_QUYEN_HET_HAN` / `KENH_CHUA_KET_NOI` (sau toast lỗi như mọi lỗi
 *   khác): trang đọc lại kết nối để khóa nút và hiện thanh nhắc, menu bên trái tải lại danh sách sàn.
 */
export default function useDongBoNgay(maKenh, { enabled = true, onXong, onMatKetNoi } = {}) {
  // Bộ nhớ theo kênh và người đăng nhập: đăng xuất rồi người khác vào cùng tab không thấy đợt của người trước
  const maBoNho = useMemo(() => `${maKenh}@${getCurrentUserId() ?? ""}`, [maKenh]);
  // Đọc bộ nhớ một lần lúc mở trang (useState chỉ dùng giá trị đầu)
  const [dau] = useState(() => trangThaiDau(docBoNho(maBoNho)));
  const [phien, setPhien] = useState(dau.phien);
  const phienRef = useRef(dau.phien);
  const [conLaiMs, setConLaiMs] = useState(null);
  const [maTheoDoi, setMaTheoDoi] = useState(dau.maTheoDoi);
  const [daXem, setDaXem] = useState(dau.daXem);
  const [dangGui, setDangGui] = useState(false);
  const [soLanLoi, setSoLanLoi] = useState(0);
  const dangGuiRef = useRef(false);
  const daThayChay = useRef(new Set(dau.daThayChay));
  const daBaoXong = useRef(new Set(dau.daBaoXong));
  const conLaiTruoc = useRef({ maPhien: null, ms: null });
  const onXongRef = useRef(onXong);
  const onMatKetNoiRef = useRef(onMatKetNoi);
  useEffect(() => {
    onXongRef.current = onXong;
    onMatKetNoiRef.current = onMatKetNoi;
  });

  const daNhanRef = useRef(false);

  const theoDoi = useCallback(
    (ma) => {
      setMaTheoDoi(ma);
      ghiBoNho(maBoNho, { theoDoi: ma });
    },
    [maBoNho],
  );

  const nhan = useCallback(
    (p) => {
      daNhanRef.current = true;
      phienRef.current = p ?? null;
      setPhien(p ?? null);
      ghiBoNho(maBoNho, { phien: p ?? null });
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
        theoDoi(p.maPhien);
      } else if (daThayChay.current.has(p.maPhien) && !daBaoXong.current.has(p.maPhien)) {
        daBaoXong.current.add(p.maPhien);
        onXongRef.current?.(p);
      }
    },
    [maBoNho, theoDoi],
  );

  // Đợt vừa bắt đầu ở trang khác (trang đó đã đóng trước khi máy chủ trả lời) → nhận luôn để hiện và theo dõi.
  // Chỉ nhận đợt đang chạy và khác đợt đang có; lần ghi của chính trang này có phienRef trùng nên bị bỏ qua.
  useEffect(
    () =>
      ngheBoNho(maBoNho, (muc) => {
        const p = muc.phien;
        if (!dangChayDongBo(p) || p === phienRef.current || p.maPhien === phienRef.current?.maPhien) return;
        nhan(p);
      }),
    [maBoNho, nhan],
  );

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

  // Đang chạy: hỏi lại sau mỗi giây; lỗi mạng thì giãn ra 3 giây, không bỏ theo dõi.
  // Không chờ `enabled`: đợt đang chạy (lấy từ bộ nhớ) vẫn được theo dõi tới xong dù thông tin gian hàng chưa tải được.
  const chay = dangChayDongBo(phien);
  useEffect(() => {
    if (!chay) return undefined;
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
  }, [chay, phien, soLanLoi, maKenh, nhan]);

  /** Bắt đầu một đợt; trả ảnh chụp đầu tiên, lỗi thì báo và trả null. */
  const batDau = useCallback(async () => {
    if (!enabled || dangGuiRef.current) return null;
    dangGuiRef.current = true;
    setDangGui(true);
    try {
      const p = await kenhBanHangService.batDauDongBoNgay(maKenh);
      if (p?.maPhien) theoDoi(p.maPhien);
      nhan(p);
      return p;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không bắt đầu được đồng bộ"));
      if (MA_LOI_MAT_KET_NOI.has(getApiErrorCode(error))) onMatKetNoiRef.current?.(error);
      return null;
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  }, [enabled, maKenh, nhan, theoDoi]);

  const dung = useCallback(async () => {
    try {
      const p = await kenhBanHangService.dungDongBoNgay(maKenh);
      if (p) nhan(p);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không dừng được đồng bộ"));
    }
  }, [maKenh, nhan]);

  const danhDauDaXem = useCallback(
    (ma) => {
      setDaXem(ma);
      ghiBoNho(maBoNho, { daXem: ma });
    },
    [maBoNho],
  );

  return {
    phien,
    dangChay: chay,
    dangGui,
    conLaiMs,
    cuaTrangNay: Boolean(phien) && phien.maPhien === maTheoDoi,
    daXem,
    danhDauDaXem,
    sanSang: enabled,
    batDau,
    dung,
  };
}
