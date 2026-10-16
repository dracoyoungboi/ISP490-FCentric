import { useEffect, useState } from "react";
import { tinhKhoangTranhDay } from "@/lib/tinhThongBaoNhanh";

/**
 * Chiều cao (px) của thanh đang dính ở đáy màn hình (thanh nút Lưu, thanh Thanh toán POS…),
 * để thông báo nhanh nâng lên trên thanh thay vì che nút. Thanh không nằm ở đáy thì trả 0.
 *
 * Đo lại khi DOM đổi, khi cuộn (thanh `sticky` chỉ dính đáy khi nội dung dài) và khi đổi cỡ cửa sổ;
 * mỗi khung hình đo tối đa một lần, và chỉ render lại khi con số thật sự đổi.
 */
export default function useKhoangTranhDay(boChon) {
  const [khoang, setKhoang] = useState(0);

  useEffect(() => {
    if (!boChon || typeof window === "undefined") return undefined;

    let khungHinh = 0;
    const doLai = () => {
      if (khungHinh) return;
      khungHinh = requestAnimationFrame(() => {
        khungHinh = 0;
        const cacKhung = Array.from(document.querySelectorAll(boChon), (phanTu) =>
          phanTu.getBoundingClientRect(),
        );
        const moi = tinhKhoangTranhDay(cacKhung, window.innerHeight);
        setKhoang((cu) => (cu === moi ? cu : moi));
      });
    };

    const quanSat = new MutationObserver(doLai);
    quanSat.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", doLai);
    document.addEventListener("scroll", doLai, { capture: true, passive: true });
    doLai();

    return () => {
      quanSat.disconnect();
      window.removeEventListener("resize", doLai);
      document.removeEventListener("scroll", doLai, { capture: true });
      if (khungHinh) cancelAnimationFrame(khungHinh);
    };
  }, [boChon]);

  return khoang;
}
