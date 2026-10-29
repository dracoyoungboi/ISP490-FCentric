import { useCallback, useEffect, useRef, useState } from "react";
import { thongBaoService } from "@/services/thongBaoService";
import { daDocMot, daDocTatCa } from "@/utils/thongBaoChuong";

/** Tự tải lại sau mỗi khoảng này khi tab đang hiển thị. */
export const CHU_KY_TAI_LAI_MS = 60_000;
/** Lệch giờ của setInterval: lần tải gần nhất cách chưa tới chu kỳ trừ khoảng này thì không tải lại. */
const DUNG_SAI_MS = 1_000;
/** Lần tải định kỳ bỏ lượt khi lần trước còn chờ, trừ khi lần đó đã chờ quá khoảng này (coi như treo, gửi lại). */
const CHO_TOI_DA_MS = 2 * CHU_KY_TAI_LAI_MS;

const RONG = { items: [], soChuaDoc: 0 };

/**
 * Danh sách thông báo của người đang đăng nhập cho chuông trên thanh trên cùng.
 * Tải khi vào trang, tự tải lại NGẦM mỗi 60 giây khi tab đang hiển thị (tab ẩn thì thôi; hiện lại mà đã quá 60 giây
 * thì tải ngay; lần trước chưa xong thì bỏ lượt), và mỗi lần mở bảng (`taiLai`).
 * `soChuaDoc` là số máy chủ đếm trên mọi thông báo chưa đọc (bảng chỉ tải 30 thông báo mới nhất).
 * Đánh dấu đã đọc cập nhật giao diện ngay rồi mới gửi đi; gửi lỗi (vd. thông báo đã bị dọn) thì tải lại cho khớp máy chủ.
 * `dangBat = false` (tính năng chưa sẵn sàng): không gọi máy chủ, danh sách luôn rỗng.
 */
export default function useThongBao({ dangBat = true } = {}) {
  const [duLieu, setDuLieu] = useState(RONG);
  const [dangTai, setDangTai] = useState(dangBat);
  const [loi, setLoi] = useState(false);
  /** Số thứ tự lần tải: kết quả về muộn của lần cũ (hoặc lần gửi trước khi đánh dấu đã đọc) bị bỏ. */
  const lanTai = useRef(0);
  const daCoDuLieu = useRef(false);
  /** Lúc gửi lần tải gần nhất. */
  const taiLuc = useRef(0);
  /** Số lần tải đã gửi mà máy chủ chưa trả lời (mạng chậm): tải định kỳ không chồng thêm lần mới. */
  const dangCho = useRef(0);

  const nhanKetQua = useCallback((lan, kq) => {
    if (lan !== lanTai.current) return;
    daCoDuLieu.current = true;
    setDuLieu(kq);
    setLoi(false);
    setDangTai(false);
  }, []);

  const nhanLoi = useCallback((lan) => {
    if (lan !== lanTai.current) return;
    // Đã có danh sách thì giữ nguyên, chỉ báo lỗi khi chưa tải được lần nào.
    if (!daCoDuLieu.current) setLoi(true);
    setDangTai(false);
  }, []);

  /** Gửi một lần tải; không đổi trạng thái đang tải (tải ngầm). */
  const goiTai = useCallback(() => {
    const lan = ++lanTai.current;
    taiLuc.current = Date.now();
    dangCho.current += 1;
    thongBaoService
      .layDanhSach()
      .then(
        (kq) => nhanKetQua(lan, kq),
        () => nhanLoi(lan),
      )
      .finally(() => {
        dangCho.current = Math.max(0, dangCho.current - 1);
      });
  }, [nhanKetQua, nhanLoi]);

  useEffect(() => {
    if (!dangBat) return undefined;
    goiTai();
    const taiNeuDenHan = () => {
      if (document.visibilityState !== "visible") return;
      const daQua = Date.now() - taiLuc.current;
      // Lần trước chưa xong (mạng chậm): bỏ lượt này thay vì chồng thêm lời gọi
      if (dangCho.current > 0 && daQua < CHO_TOI_DA_MS) return;
      if (daQua >= CHU_KY_TAI_LAI_MS - DUNG_SAI_MS) goiTai();
    };
    const hen = window.setInterval(taiNeuDenHan, CHU_KY_TAI_LAI_MS);
    document.addEventListener("visibilitychange", taiNeuDenHan);
    return () => {
      window.clearInterval(hen);
      document.removeEventListener("visibilitychange", taiNeuDenHan);
    };
  }, [dangBat, goiTai]);

  /** Tải lại ngay (mở bảng, bấm Thử lại); chưa có dữ liệu thì hiện khung đang tải. */
  const taiLai = useCallback(() => {
    if (!dangBat) return;
    if (!daCoDuLieu.current) {
      setLoi(false);
      setDangTai(true);
    }
    goiTai();
  }, [dangBat, goiTai]);

  const danhDauDaDoc = useCallback(
    (id) => {
      lanTai.current++;
      setDuLieu((tt) => daDocMot(tt, id));
      thongBaoService.danhDauDaDoc(id).catch(() => goiTai());
    },
    [goiTai],
  );

  const danhDauTatCaDaDoc = useCallback(() => {
    lanTai.current++;
    setDuLieu(daDocTatCa);
    thongBaoService.danhDauTatCaDaDoc().catch(() => goiTai());
  }, [goiTai]);

  return {
    items: duLieu.items,
    soChuaDoc: duLieu.soChuaDoc,
    dangTai,
    loi,
    taiLai,
    danhDauDaDoc,
    danhDauTatCaDaDoc,
  };
}
