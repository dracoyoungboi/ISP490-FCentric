// Suy ra tên thân thiện + loại thiết bị từ chuỗi User-Agent (không cần thư viện ngoài) cho màn "Thiết bị đang đăng nhập".

/**
 * @returns {{ ten: string, loai: "dien-thoai"|"may-tinh-bang"|"may-tinh", trinhDuyet: string, he: string }}
 */
export function moTaThietBi(userAgent) {
  const ua = userAgent || "";

  // Trình duyệt — thứ tự quan trọng: Edge/Opera/Samsung/Firefox-iOS/Chrome-iOS phải nhận TRƯỚC Chrome và Safari
  // (các trình duyệt này đều nhúng chuỗi "Chrome"/"Safari" trong User-Agent)
  let trinhDuyet = "Trình duyệt";
  if (/Edg\/|EdgA\/|EdgiOS\//i.test(ua)) trinhDuyet = "Edge"; // Edge trên máy tính / Android / iOS
  else if (/OPR\/|Opera/i.test(ua)) trinhDuyet = "Opera";
  else if (/SamsungBrowser/i.test(ua)) trinhDuyet = "Samsung Internet";
  else if (/FxiOS\//i.test(ua)) trinhDuyet = "Firefox"; // Firefox trên iOS
  else if (/CriOS\//i.test(ua)) trinhDuyet = "Chrome"; // Chrome trên iOS
  else if (/Chrome\//i.test(ua)) trinhDuyet = "Chrome";
  else if (/Firefox\//i.test(ua)) trinhDuyet = "Firefox";
  else if (/Safari\//i.test(ua)) trinhDuyet = "Safari";

  // Hệ điều hành
  let he = "";
  if (/Windows NT/i.test(ua)) he = "Windows";
  else if (/Android/i.test(ua)) he = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) he = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) he = "macOS";
  else if (/Linux/i.test(ua)) he = "Linux";

  // Loại (dùng để chọn biểu tượng); Android không kèm "Mobile" là máy tính bảng
  let loai = "may-tinh";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) loai = "may-tinh-bang";
  else if (/Mobile|Android|iPhone|iPod/i.test(ua)) loai = "dien-thoai";

  const ten = he ? `${trinhDuyet} · ${he}` : trinhDuyet;
  return { ten, loai, trinhDuyet, he };
}

/**
 * Khoảng thời gian tới hiện tại dạng đọc nhanh: "vừa xong" / "x phút trước" / "x giờ trước" /
 * "x ngày trước"; xa hơn 7 ngày thì hiện ngày giờ cụ thể (giờ Việt Nam).
 */
export function thoiGianTuongDoi(giaTri) {
  if (!giaTri) return "";
  const d = giaTri instanceof Date ? giaTri : new Date(giaTri);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return "";
  const giay = Math.round((Date.now() - ms) / 1000);
  if (giay < 45) return "vừa xong";
  if (giay < 90) return "1 phút trước";
  // Dùng floor cho phút/giờ/ngày để không "vượt mốc" (vd. 1 giờ 31 phút vẫn là "1 giờ trước", không nhảy thành 2)
  const phut = Math.floor(giay / 60);
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.floor(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  const ngay = Math.floor(gio / 24);
  if (ngay <= 7) return `${ngay} ngày trước`;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
