import { lazy, useSyncExternalStore } from "react";
import { matchRoutes } from "react-router-dom";

/**
 * Tải trang theo nhu cầu: mỗi trang thành một tệp mã riêng, chỉ tải khi mở tới (App.jsx).
 * Kèm bộ đếm "đang tải tệp trang" cho thanh tiến độ mảnh trên đầu (ThanhTaiTrang), và tải trước theo đường dẫn
 * (lúc mở app, ở màn đăng nhập) để vào tới là trang đã sẵn.
 */

const KHOA_TAI_LAI = "fcentric:tai-lai-vi-loi-tep";

/**
 * Đã tự tải lại trong khoảng này thì thôi, để màn lỗi (có nút Thử lại) hiện thay vì tải lại mãi khi tệp thiếu thật
 * hoặc mạng quá chậm. Tính rộng tay để máy chậm (tải app + tệp trang lâu) cũng không lọt vòng lặp.
 */
const GIA_CACH_TAI_LAI_MS = 60_000;

/** Tải lại bị hủy (người dùng bấm Ở lại trên hộp "Rời trang?") thì sau chừng này trang vẫn còn: báo lỗi như thường. */
const CHO_TAI_LAI_MS = 3_000;

/** Lỗi tải tệp mã của trang (mất mạng, hoặc tệp cũ đã bị xóa sau khi triển khai bản mới), khác lỗi khi trang chạy. */
export function laLoiTaiTep(loi) {
  const thongDiep = String(loi?.message ?? "");
  return (
    loi?.name === "ChunkLoadError" ||
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
      thongDiep,
    )
  );
}

/**
 * Tải lại trang một lần để lấy bản mới. Lỗi tải tệp trang thường do vừa triển khai: tên tệp đổi theo mã băm,
 * tệp cũ bị xóa, tab đang mở từ trước vẫn xin tệp cũ. Trả true nếu đã gọi tải lại.
 * Mất mạng thì không tải lại (sẽ ra trang lỗi của trình duyệt): để màn lỗi của app hiện, người dùng bấm Thử lại.
 */
function taiLaiMotLan(loi) {
  if (!laLoiTaiTep(loi) || !navigator.onLine) return false;
  try {
    const lanTruoc = Number(sessionStorage.getItem(KHOA_TAI_LAI));
    if (lanTruoc && Date.now() - lanTruoc < GIA_CACH_TAI_LAI_MS) return false;
    sessionStorage.setItem(KHOA_TAI_LAI, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

let soDangTai = 0;
let soChoHien = 0;
const nguoiNghe = new Set();

function baoThayDoi() {
  nguoiNghe.forEach((nghe) => nghe());
}

function dangKy(nghe) {
  nguoiNghe.add(nghe);
  return () => nguoiNghe.delete(nghe);
}

/**
 * Bọc `lazy()`: đếm lúc đang tải tệp trang, tệp lỗi thì tự tải lại trang một lần; vẫn lỗi thì ném lỗi cho
 * ErrorBoundary hiện "Không tải được trang này".
 * Trang trả về có thêm `taiTruoc()`: tải tệp trước khi dựng, dùng chung một lượt tải với lúc dựng.
 */
export function taiTrang(nap) {
  let luotTai = null;
  let daTaiXong = false;
  const napMotLan = () => {
    // Lỗi thì quên lượt này, lần sau (bấm vào trang, rê chuột lại) tải lại từ đầu
    luotTai ??= nap().then(
      (moDun) => {
        daTaiXong = true;
        return moDun;
      },
      (loi) => {
        luotTai = null;
        throw loi;
      },
    );
    return luotTai;
  };

  const Trang = lazy(() => {
    // Đã tải trước xong: không cần đếm cho thanh tiến độ (không có gì để chờ)
    if (daTaiXong) return napMotLan();
    soDangTai += 1;
    // React gọi hàm này giữa lúc dựng trang: báo sau, tránh cập nhật component khác ngay trong lúc dựng
    queueMicrotask(baoThayDoi);
    return napMotLan()
      .catch((loi) => {
        if (!taiLaiMotLan(loi)) throw loi;
        // Đang tải lại: giữ trạng thái chờ tới khi trang mới thay, không chớp màn lỗi. Quá hạn mà trang vẫn còn
        // (tải lại bị hủy) thì báo lỗi, để thanh tiến độ tắt và màn lỗi hiện.
        return new Promise((_, tuChoi) => setTimeout(() => tuChoi(loi), CHO_TAI_LAI_MS));
      })
      .finally(() => {
        soDangTai -= 1;
        baoThayDoi();
      });
  });
  // Tải trước lỗi thì bỏ qua (trả false): lúc bấm vào trang mới báo lỗi / tự tải lại như thường
  Trang.taiTruoc = () => napMotLan().then(() => true, () => false);
  return Trang;
}

let cayDuongDan = [];

/** App.jsx ghi cây đường dẫn (createRoutesFromChildren) một lần, để tìm trang cần tải trước theo đường dẫn. */
export function ghiNhanCayDuongDan(cay) {
  cayDuongDan = cay;
}

/**
 * Tải trước tệp của trang ứng với đường dẫn (vd. "/goods-receipts", có thể kèm "?…"). Đường dẫn chuyển hướng hoặc
 * trang đã nằm trong gói đầu thì không làm gì. Mất mạng thì thôi: một số trình duyệt nhớ lượt nhập tệp hỏng, lúc
 * có mạng bấm vào lại hỏng. Trả Promise (không bao giờ báo lỗi) gồm `false` cho tệp tải hỏng.
 */
export function taiTruocDuongDan(duongDan) {
  if (!navigator.onLine) return Promise.resolve([false]);
  const khop = matchRoutes(cayDuongDan, duongDan) ?? [];
  return Promise.all(khop.map(({ route }) => route.element?.type?.taiTruoc?.()));
}

/** Chờ trình duyệt rảnh (không đang dựng trang, không đang xử lý thao tác); trình duyệt không hỗ trợ thì chờ ngắn. */
const choRanh = () =>
  new Promise((xong) =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(() => xong(), { timeout: 3_000 })
      : setTimeout(xong, 300),
  );

/** Lúc trình duyệt rảnh thì tải trước trang của một đường dẫn (vd. trang đích ở màn đăng nhập). Trả hàm hủy. */
export function taiTruocLucRanh(duongDan) {
  let huy = false;
  choRanh().then(() => {
    if (!huy) taiTruocDuongDan(duongDan);
  });
  return () => {
    huy = true;
  };
}

/** Phần chờ của Suspense đang hiện (vào thẳng đường dẫn / F5): đã có vòng chờ ở vùng nội dung, thanh trên đầu không cần hiện. */
export function ghiNhanChoHien() {
  soChoHien += 1;
  baoThayDoi();
  return () => {
    soChoHien -= 1;
    baoThayDoi();
  };
}

/** True khi đang tải tệp trang mà không có vòng chờ nào hiện, tức lúc bấm chuyển trang (trang cũ được giữ nguyên). */
export function useDangChuyenTrang() {
  return useSyncExternalStore(dangKy, () => soDangTai > 0 && soChoHien === 0, () => false);
}
