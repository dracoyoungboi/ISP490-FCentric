import { cn } from "@/lib/utils";

/*
 * Bảng màu riêng của hình minh họa: các sắc nhạt dần của màu chính bo-primary (#1677ff)
 * và màu chữ bo-foreground (#182537). Chỉ dùng cho hình vẽ này, không phải giá trị nghiệp vụ.
 */
const MAU = {
  vien: "#1677ff",
  trongThung: "#b9d6ff",
  matTrai: "#eaf3ff",
  matPhai: "#d4e6ff",
  nap: "#ffffff",
  bong: "#e3e9f1",
  kinhLup: "#182537",
  phanQuang: "#94a3b8",
};

const NET = { stroke: MAU.vien, strokeWidth: 2, strokeLinejoin: "round" };

/**
 * Hình minh họa trang không tìm thấy: thùng hàng mở và kính lúp.
 * Dùng chung cho trang 404 trong khung quản trị và trang 404 khi chưa đăng nhập.
 * Kích thước do `className` quyết định (tỉ lệ 4:3).
 */
export default function MinhHoaKhongTimThay({ className }) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("block h-auto w-[240px] max-w-full", className)}
    >
      <ellipse cx="120" cy="162" rx="92" ry="9" fill={MAU.bong} />
      {/* Hai nắp sau */}
      <path d="M60 78 L120 58 L110 30 L50 50 Z" fill={MAU.nap} {...NET} />
      <path d="M120 58 L180 78 L190 50 L130 30 Z" fill={MAU.nap} {...NET} />
      {/* Lòng thùng và hai mặt thùng */}
      <path d="M60 78 L120 58 L180 78 L120 98 Z" fill={MAU.trongThung} {...NET} />
      <path d="M60 78 L120 98 L120 158 L60 138 Z" fill={MAU.matTrai} {...NET} />
      <path d="M120 98 L180 78 L180 138 L120 158 Z" fill={MAU.matPhai} {...NET} />
      {/* Hai nắp trước */}
      <path d="M60 78 L120 98 L98 116 L38 96 Z" fill={MAU.nap} {...NET} />
      <path d="M120 98 L180 78 L202 96 L142 116 Z" fill={MAU.nap} {...NET} />
      <path d="M150 126 L166 120.7" stroke={MAU.vien} strokeWidth="2" strokeLinecap="round" />
      {/* Kính lúp */}
      <circle cx="180" cy="36" r="18" fill={MAU.nap} stroke={MAU.kinhLup} strokeWidth="4" />
      <path d="M170 31 A11 11 0 0 1 178 25" stroke={MAU.phanQuang} strokeWidth="2" strokeLinecap="round" />
      <path d="M193 49 L207 63" stroke={MAU.kinhLup} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
