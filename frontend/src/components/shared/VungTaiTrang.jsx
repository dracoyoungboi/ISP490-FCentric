import { Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import LoadingState from "@/components/shared/LoadingState";
import { ghiNhanChoHien, useDangChuyenTrang } from "@/lib/taiTrang";

function ChoTaiTrang({ className }) {
  useEffect(() => ghiNhanChoHien(), []);
  return <LoadingState label="Đang tải trang" className={className} />;
}

/**
 * Bọc chỗ dựng trang con (<Outlet /> của khung, hoặc <Routes>): trang chưa tải xong thì hiện vòng chờ tại đúng chỗ đó,
 * trang lỗi thì chỉ chỗ đó báo lỗi. Bấm chuyển trang thì react-router đổi trong startTransition nên trang cũ được giữ
 * tới khi trang mới tải xong; vòng chờ chỉ hiện khi vào thẳng đường dẫn hoặc F5.
 */
export default function VungTaiTrang({ children, className }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} className={className}>
      <Suspense fallback={<ChoTaiTrang className={className} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/** Thanh mảnh trên đầu lúc bấm sang trang chưa tải (trang cũ đang được giữ), để người dùng biết app đã nhận thao tác. */
export function ThanhTaiTrang() {
  const dangChuyenTrang = useDangChuyenTrang();
  if (!dangChuyenTrang) return null;
  return <div className="bo-thanh-tai-trang" role="progressbar" aria-label="Đang mở trang" />;
}
