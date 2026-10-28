import { useEffect, useRef, useState } from 'react';

/**
 * Màn hình phụ quay về phía khách: cửa sổ /pos/customer-display mở trên màn thứ hai cắm vào CÙNG máy quầy, cùng
 * trình duyệt. Màn bán hàng gửi nội dung màn cho khách (pos-man-khach.js) qua BroadcastChannel — không qua máy chủ,
 * nên chỉ chạy giữa các tab / cửa sổ của cùng một trình duyệt trên một máy, theo từng tài khoản.
 *
 * Tin nhắn (mỗi tin của màn bán hàng mang `nguon` = mã ngẫu nhiên của lần mở kênh đó):
 * - bán hàng -> phụ: { loai: "noiDung", noiDung } khi nội dung đổi và mỗi lần phụ hỏi; { loai: "tat" } khi đóng.
 * - phụ -> bán hàng: { loai: "xin" } lúc vừa mở, { loai: "conSong" } theo nhịp, { loai: "dong" } khi đóng.
 * Nhịp do màn hình phụ giữ (cửa sổ đang hiện, đồng hồ không bị trình duyệt hãm), màn bán hàng chỉ trả lời: tab bán
 * hàng bị ẩn lâu thì trình duyệt hãm đồng hồ của nó tới một phút một lần, còn tin nhắn đến thì vẫn được xử lý ngay.
 */
export const tenKenhManKhach = (userKey) => `fcentric-pos-man-khach:${userKey}`;

/** Nhịp màn hình phụ hỏi lại / báo còn mở. */
const NHIP_MS = 2000;
/** Quá lâu không nghe thấy bên kia: coi như đã đóng (màn hình phụ ẩn mã QR, về lời chào). */
export const MAT_TIN_HIEU_MS = 6000;

/** Đường dẫn và tên cửa sổ màn hình phụ (cùng tên -> dùng lại cửa sổ đã mở, không mở thêm). */
export const DUONG_DAN_MAN_HINH_PHU = '/pos/customer-display';
export const TEN_CUA_SO_MAN_HINH_PHU = 'fcentric-man-hinh-khach';

const coKenh = () => typeof BroadcastChannel === 'function';
const maNguon = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Màn bán hàng: gửi nội dung màn cho khách cho màn hình phụ (nếu có mở). Trả về true khi đang có màn hình phụ
 * nghe (để thanh trên cùng báo "Màn hình khách"). `noiDung` nên được useMemo để không gửi lại ở mỗi lần vẽ.
 */
export function useGuiManKhach(userKey, noiDung) {
  const noiDungRef = useRef(noiDung);
  const guiRef = useRef(null);
  const [coManHinhPhu, setCoManHinhPhu] = useState(false);

  useEffect(() => {
    noiDungRef.current = noiDung;
    guiRef.current?.();
  }, [noiDung]);

  useEffect(() => {
    if (!coKenh()) return undefined;
    const kenh = new BroadcastChannel(tenKenhManKhach(userKey));
    const nguon = maNguon();
    let ngheLuc = 0;
    const gui = () => kenh.postMessage({ loai: 'noiDung', nguon, noiDung: noiDungRef.current });
    guiRef.current = gui;
    kenh.onmessage = (event) => {
      const loai = event.data?.loai;
      if (loai === 'dong') {
        // Một màn hình phụ vừa đóng; màn khác (nếu còn) sẽ tự báo lại ở nhịp sau
        ngheLuc = 0;
        setCoManHinhPhu(false);
        return;
      }
      if (loai !== 'xin' && loai !== 'conSong') return;
      ngheLuc = Date.now();
      setCoManHinhPhu(true);
      gui();
    };
    gui();
    const kiemTra = window.setInterval(() => {
      if (ngheLuc && Date.now() - ngheLuc > MAT_TIN_HIEU_MS) {
        ngheLuc = 0;
        setCoManHinhPhu(false);
      }
    }, NHIP_MS);
    // Đóng / tải lại màn bán hàng: màn hình phụ thôi hiện ngay (không đợi mất tín hiệu), kể cả mã QR đang chờ
    const tat = () => kenh.postMessage({ loai: 'tat', nguon });
    window.addEventListener('pagehide', tat);
    return () => {
      window.removeEventListener('pagehide', tat);
      tat();
      window.clearInterval(kiemTra);
      kenh.close();
      if (guiRef.current === gui) guiRef.current = null;
    };
  }, [userKey]);

  return coManHinhPhu;
}

/**
 * Màn hình phụ: nhận nội dung từ màn bán hàng. Mất tín hiệu (màn bán hàng đóng, treo, đăng xuất) quá MAT_TIN_HIEU_MS
 * thì bỏ nội dung — không giữ mã QR cũ trên màn khách. Trả { noiDung, ketNoi }.
 */
export function useNhanManKhach(userKey) {
  const [nhan, setNhan] = useState({ noiDung: null, ketNoi: false });

  useEffect(() => {
    if (!coKenh()) return undefined;
    const kenh = new BroadcastChannel(tenKenhManKhach(userKey));
    let ngheLuc = 0;
    let nguonCuoi = null; // màn bán hàng gửi nội dung gần nhất
    let cuoi = null; // nội dung gần nhất (chuỗi JSON): trả lời cùng nội dung thì không vẽ lại
    const boNoiDung = () => {
      ngheLuc = 0;
      nguonCuoi = null;
      cuoi = null;
      setNhan({ noiDung: null, ketNoi: false });
    };
    kenh.onmessage = (event) => {
      const data = event.data;
      if (data?.loai === 'tat') {
        // Chỉ nghe "tắt" của đúng màn đang gửi nội dung: tab cũ vừa nhường quyền POS (hay lần chạy hiệu ứng trước)
        // tắt muộn sau tin đầu của tab mới thì bỏ qua, không làm trống màn khách
        if (data.nguon === nguonCuoi) boNoiDung();
        return;
      }
      if (data?.loai !== 'noiDung') return;
      const lanDau = !ngheLuc;
      ngheLuc = Date.now();
      nguonCuoi = data.nguon ?? null;
      const chuoi = JSON.stringify(data.noiDung ?? null);
      if (!lanDau && chuoi === cuoi) return;
      cuoi = chuoi;
      setNhan({ noiDung: data.noiDung ?? null, ketNoi: true });
    };
    kenh.postMessage({ loai: 'xin' });
    const nhip = window.setInterval(() => {
      kenh.postMessage({ loai: 'conSong' });
      if (ngheLuc && Date.now() - ngheLuc > MAT_TIN_HIEU_MS) boNoiDung();
    }, NHIP_MS);
    const dong = () => kenh.postMessage({ loai: 'dong' });
    window.addEventListener('pagehide', dong);
    return () => {
      window.removeEventListener('pagehide', dong);
      dong();
      window.clearInterval(nhip);
      kenh.close();
    };
  }, [userKey]);

  return nhan;
}
