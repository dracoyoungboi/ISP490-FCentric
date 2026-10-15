import { useEffect, useRef } from "react";
import { Link, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import BackofficeLayout from "@/components/backoffice/BackofficeLayout";
import BrandLogo from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import MinhHoaKhongTimThay from "./MinhHoaKhongTimThay";

/*
 * Trang 404 (đã chốt 15/10/2026):
 * - Đã đăng nhập: phương án C, hiện trong khung quản trị (giữ sidebar, header) để người dùng đi tiếp bằng menu.
 * - Chưa đăng nhập: phương án E, trang đứng riêng có logo, cùng hình minh họa với C.
 *
 * App.jsx chỉ có một route `path="*"` ở cấp ngoài trỏ vào trang này. Không thêm route `*` bên trong
 * khung quản trị: route đó sẽ thắng mọi đường dẫn lạ và đẩy người chưa đăng nhập về trang đăng nhập.
 */

const TIEU_DE = "Không tìm thấy trang";

/** Tiêu đề cố định cho BackofficeLayout (tên tab trình duyệt); trang tự vẽ h1 nên ownTitle = true. */
const META_KHONG_TIM_THAY = { title: TIEU_DE, ownTitle: true };

const NUT_CHINH = "bg-bo-primary text-white hover:bg-bo-primary-hover";

/** Đưa tiêu điểm vào tiêu đề khi trang hiện, để trình đọc màn hình đọc ngay nội dung lỗi. */
function useTieuDiemTieuDe() {
    const ref = useRef(null);
    useEffect(() => {
        ref.current?.focus({ preventScroll: true });
    }, []);
    return ref;
}

/** C: trong khung quản trị. */
function KhongTimThayTrongKhung() {
    const tieuDeRef = useTieuDiemTieuDe();

    return (
        <div className="flex min-h-full items-center justify-center px-4 py-10 sm:px-6">
            <section
                aria-labelledby="tieu-de-404"
                className="flex max-w-[460px] flex-col items-center text-center"
            >
                <MinhHoaKhongTimThay />
                <p
                    aria-hidden="true"
                    className="mt-6 text-[44px] font-semibold leading-[52px] tracking-[-0.02em] text-bo-foreground tabular-nums"
                >
                    404
                </p>
                <h1
                    id="tieu-de-404"
                    ref={tieuDeRef}
                    tabIndex={-1}
                    className="mt-1 text-lg font-semibold leading-7 text-bo-foreground outline-none"
                >
                    {TIEU_DE}
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    Trang bạn mở không tồn tại hoặc đã được chuyển sang địa chỉ khác.
                </p>
                <Button asChild className={`mt-5 ${NUT_CHINH}`}>
                    <Link to="/dashboard">Về Tổng quan</Link>
                </Button>
            </section>
        </div>
    );
}

/** E: chưa đăng nhập, trang đứng riêng. */
function KhongTimThayNgoaiKhung() {
    const tieuDeRef = useTieuDiemTieuDe();

    useEffect(() => {
        const tieuDeCu = document.title;
        document.title = `${TIEU_DE} · FCentric`;
        return () => {
            document.title = tieuDeCu;
        };
    }, []);

    return (
        <div className="flex min-h-dvh flex-col bg-bo-canvas font-backoffice text-bo-foreground">
            <header className="flex h-14 shrink-0 items-center px-5 sm:h-[72px] sm:px-8">
                <Link
                    to="/login"
                    aria-label="FCentric, về trang đăng nhập"
                    className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                >
                    <BrandLogo variant="light" className="h-[26px] sm:h-8" />
                </Link>
            </header>

            <main className="flex flex-1 items-center justify-center px-5 pb-24 pt-6 sm:pb-[120px]">
                <section
                    aria-labelledby="tieu-de-404"
                    className="flex w-full max-w-[540px] flex-col items-center text-center"
                >
                    <MinhHoaKhongTimThay className="w-[200px] sm:w-[240px]" />
                    <h1
                        id="tieu-de-404"
                        ref={tieuDeRef}
                        tabIndex={-1}
                        className="mt-5 text-xl font-semibold leading-7 tracking-[-0.01em] outline-none sm:mt-6 sm:text-[22px] sm:leading-[30px]"
                    >
                        {TIEU_DE}
                    </h1>
                    {/* Màn rộng: mỗi câu một dòng, không để "Vui lòng" bị ngắt giữa hai dòng */}
                    <p className="mt-2 max-w-[521px] text-sm leading-[22px] text-slate-600">
                        Đường dẫn không tồn tại hoặc trang đã được chuyển sang địa chỉ khác.{" "}
                        <span className="sm:block">
                            Vui lòng kiểm tra lại đường dẫn, hoặc đăng nhập để tiếp tục làm việc.
                        </span>
                    </p>
                    <Button
                        asChild
                        className={`mt-6 h-11 w-full px-5 text-[15px] sm:h-10 sm:w-auto sm:text-sm ${NUT_CHINH}`}
                    >
                        <Link to="/login">Đến trang đăng nhập</Link>
                    </Button>
                </section>
            </main>
        </div>
    );
}

/**
 * Có phiên đăng nhập: dựng lại khung quản trị (qua ProtectedRoute để vẫn kiểm tra phiên, bắt đổi mật khẩu)
 * rồi hiện C bên trong. Không có phiên: hiện E.
 */
export default function NotFound404() {
    const coPhien = Boolean(localStorage.getItem("access_token"));

    if (!coPhien) return <KhongTimThayNgoaiKhung />;

    return (
        <Routes>
            <Route element={<ProtectedRoute />}>
                <Route element={<BackofficeLayout metaCoDinh={META_KHONG_TIM_THAY} />}>
                    <Route path="*" element={<KhongTimThayTrongKhung />} />
                </Route>
            </Route>
        </Routes>
    );
}
