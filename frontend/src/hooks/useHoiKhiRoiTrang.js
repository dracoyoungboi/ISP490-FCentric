import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chanQuayLaiTrinhDuyet, datChanRoiTrang } from "@/lib/chanRoiTrang";

// Lớp nổi (cùng bộ chọn với PrintTemplateEditorPage)
const LOP_NOI = "[role='menu'], [role='listbox'], [role='dialog'], [data-radix-popper-content-wrapper]";

/**
 * Hỏi trước khi rời trang khi `dangChan` (vd. đang quay / đang tải video bằng chứng). Cùng cách chặn với
 * PrintTemplateEditorPage (ứng dụng dùng BrowserRouter nên không có useBlocker):
 * - đóng thẻ / tải lại trang: hộp mặc định của trình duyệt (beforeunload);
 * - link nội bộ (menu trái, đường dẫn trong trang): bắt click ở pha bắt trên document, chặn chuyển trang rồi hỏi;
 * - ô tìm kiếm chung, Đăng xuất…: qua lib/chanRoiTrang (datChanRoiTrang);
 * - Back / Forward của trình duyệt: chanQuayLaiTrinhDuyet (đăng ký theo location.key, đọc `dangChan` qua ref).
 *
 * `hoi(tiepTuc, lyDo)`: mở hộp hỏi (ở lượt sau, để menu vừa bấm kịp đóng); người dùng đồng ý rời thì gọi `tiepTuc()`.
 * `lyDo`: lý do truyền kèm xinRoiTrang (LY_DO_ROI_TRANG: Thoát, đổi ngôn ngữ…), không có với link / Back.
 * Đã đồng ý rời thì thôi hộp beforeunload của trình duyệt: đổi ngôn ngữ tải lại trang, không hỏi lần hai.
 */
export default function useHoiKhiRoiTrang(dangChan, hoi) {
  const navigate = useNavigate();
  const { key, pathname, search } = useLocation();
  const hoiRef = useRef(hoi);
  const dangChanRef = useRef(dangChan);
  const daDongYRef = useRef(false);
  useEffect(() => {
    hoiRef.current = hoi;
    dangChanRef.current = dangChan;
  });
  const hoiSau = (tiepTuc, lyDo) =>
    setTimeout(
      () =>
        hoiRef.current?.(() => {
          daDongYRef.current = true;
          tiepTuc();
        }, lyDo),
      0,
    );

  useEffect(() => {
    if (!dangChan) return undefined;
    daDongYRef.current = false;
    const chan = (suKien) => {
      if (daDongYRef.current) return;
      suKien.preventDefault();
      suKien.returnValue = "";
    };
    window.addEventListener("beforeunload", chan);
    return () => window.removeEventListener("beforeunload", chan);
  }, [dangChan]);

  useEffect(() => {
    if (!dangChan) return undefined;
    const hienTai = pathname + search;
    const khiBam = (suKien) => {
      if (suKien.defaultPrevented || suKien.button !== 0) return;
      if (suKien.metaKey || suKien.ctrlKey || suKien.shiftKey || suKien.altKey) return;
      const a = suKien.target instanceof Element ? suKien.target.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href === hienTai) return;
      // Chỉ chặn việc chuyển trang; việc riêng của link (đóng menu trái trên điện thoại…) vẫn chạy
      suKien.preventDefault();
      // Link nằm trong menu / ô nổi (menu tài khoản…): mục menu bị chặn thì menu không tự đóng — đóng bằng Esc
      if (a.closest(LOP_NOI)) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      }
      hoiSau(() => navigate(href));
    };
    document.addEventListener("click", khiBam, true);
    return () => document.removeEventListener("click", khiBam, true);
  }, [dangChan, pathname, search, navigate]);

  useEffect(() => (dangChan ? datChanRoiTrang(hoiSau) : undefined), [dangChan]);

  useEffect(
    () => chanQuayLaiTrinhDuyet(hoiSau, window, { dangChan: () => dangChanRef.current, khoaTrang: key }),
    [key],
  );
}
