import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Lock, UserX, X } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import { SIDEBAR_MENU } from "@/components/backoffice/sidebar.config";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DauTrangNguoiDung from "@/components/nguoi-dung/chi-tiet/DauTrangNguoiDung";
import CanXemLai from "@/components/nguoi-dung/chi-tiet/CanXemLai";
import QuyenTruyCap from "@/components/nguoi-dung/chi-tiet/QuyenTruyCap";
import LichSuPhanQuyen from "@/components/nguoi-dung/chi-tiet/LichSuPhanQuyen";
import ThuocTinhNguoiDung from "@/components/nguoi-dung/chi-tiet/ThuocTinhNguoiDung";
import NganKeoPhanQuyen from "@/components/nguoi-dung/chi-tiet/NganKeoPhanQuyen";
import { danhGiaQuyen, phanQuyenHienCo, vanDeCanXemLai } from "@/components/nguoi-dung/phanQuyen";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/adminService.js";
import { quyenHanService } from "@/services/quyenHan";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { getCurrentUserId } from "@/utils/roles";

const LOAD_ERROR_MESSAGE = "Không thể tải thông tin người dùng. Vui lòng thử lại.";
// Mã HTTP coi là "không có người dùng này": 404, và 400 vì backend báo
// "Không tìm thấy người dùng" bằng CommonException (400). Thử lại cũng không ra kết quả khác.
const NOT_FOUND_STATUSES = [400, 404];
const TABS = ["quyen", "lich-su"];
const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";

function DaiBao({ icon, children, nutNhan, onNut }) {
    return (
        <div
            role="status"
            className="flex flex-col gap-3 border-t border-bo-border bg-slate-100 px-4 py-3 text-[13px] leading-5 text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
            <span className="flex items-start gap-2.5">
                {createElement(icon, { className: "mt-0.5 size-4 shrink-0", "aria-hidden": true })}
                <span>{children}</span>
            </span>
            {nutNhan ? (
                <Button type="button" variant="outline" size="sm" onClick={onNut} className={`shrink-0 max-sm:h-11 ${NUT_VIEN}`}>
                    {nutNhan}
                </Button>
            ) : null}
        </div>
    );
}

/** Ngăn kéo tạm khi danh sách quyền chưa tải xong hoặc tải lỗi (bấm Phân quyền vẫn có phản hồi ngay). */
function NganKeoCho({ mo, loi, onThuLai, onDong }) {
    return (
        <Sheet open={mo} onOpenChange={(m) => (m ? null : onDong())}>
            <SheetContent side="right" className="w-full gap-0 bg-white p-0 sm:max-w-[640px] [&>button:last-child]:hidden">
                <div className="flex shrink-0 items-center gap-3 border-b border-bo-border px-5 py-4">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="text-lg font-bold leading-[26px] text-bo-heading">Phân quyền</SheetTitle>
                        <SheetDescription className="text-[13px] text-bo-muted">
                            {loi ? "Chưa tải được danh sách quyền" : "Đang tải danh sách quyền"}
                        </SheetDescription>
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label="Đóng" onClick={onDong} className="text-slate-600">
                        <X className="size-4" aria-hidden="true" />
                    </Button>
                </div>
                {loi ? (
                    <ErrorState
                        className="min-h-64"
                        title="Không tải được danh sách quyền"
                        description={getApiErrorMessage(loi, "Kiểm tra kết nối rồi thử lại.")}
                        onRetry={onThuLai}
                    />
                ) : (
                    <LoadingState className="min-h-64" label="Đang tải danh sách quyền" />
                )}
            </SheetContent>
        </Sheet>
    );
}

/**
 * Chi tiết người dùng (một khối; tinh gọn theo Kiểu D · Ma trận chứng từ, chốt 19/10/2026): đầu khối, khung
 * Cần xem lại (chỗ duy nhất dùng màu cảnh báo), tab Quyền truy cập / Lịch sử phân quyền, cột Tài khoản bên phải.
 * Mỗi thông tin chỉ hiện một chỗ: vai trò và nơi làm việc ở dòng phụ đầu trang, hiệu lực / người cấp ở tab Quyền.
 * Phân quyền mở ngăn kéo ngay trên trang (PB2); đường dẫn `?phan-quyen=1` mở sẵn ngăn kéo.
 * Đổi `:id` (vd. bấm thông báo dẫn sang người khác) thì dựng lại cả trang, không giữ dữ liệu, hộp thoại
 * hay bản nháp của người trước.
 */
export default function ViewUserDetailByAdmin() {
    const { id } = useParams();
    return <ChiTietNguoiDung key={id} id={id} />;
}

function ChiTietNguoiDung({ id }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    // Danh sách gửi kèm URL của nó (bộ lọc + trang); mở thẳng link thì về /users.
    const backTo =
        typeof location.state?.from === "string" && location.state.from.startsWith("/users")
            ? location.state.from
            : "/users";
    const currentUserId = getCurrentUserId();
    const laChinhMinh = currentUserId != null && String(currentUserId) === String(id);

    const nguoiDungQ = useTaiDuLieu(async () => {
        const res = await adminService.getByIdByAdmin(id);
        if (!res?.data) throw new Error(res?.message || LOAD_ERROR_MESSAGE);
        return res.data;
    }, id);
    const thamChieuQ = useTaiDuLieu(async () => {
        const [dsQuyen, cauHinh] = await Promise.all([
            quyenHanService.layDanhSach(),
            // Thiếu cấu hình thì vẫn xem được quyền, chỉ mất phần so với mẫu / nhạy cảm / chưa áp dụng
            quyenHanService.layCauHinhPhanQuyen().catch(() => null),
        ]);
        return { dsQuyen, cauHinh };
    }, "");
    const lichSuQ = useTaiDuLieu(() => adminService.layLichSuPhanQuyen(id), id);

    const [tab, setTab] = useTabTrenUrl(TABS, "quyen", { ten: "tab" });
    const [lanMo, setLanMo] = useState(0);
    const [mocLuu, setMocLuu] = useState(null);
    const [hop, setHop] = useState(null); // "khoa" | "mat-khau"
    const [dangXuLy, setDangXuLy] = useState(false);
    // Điểm đang đánh dấu ở khung Cần xem lại (vd. "taoDuyet"): tab Quyền tô các ô liên quan
    const [danhDau, setDanhDau] = useState(null);
    // Mở ngăn kéo bằng "Sửa theo mẫu": bản nháp bắt đầu với đúng mẫu của vai trò (chưa lưu)
    const [dienMau, setDienMau] = useState(false);

    const nguoiDung = nguoiDungQ.data;
    const thamChieu = thamChieuQ.data;
    const { pq, quyenIds } = useMemo(() => phanQuyenHienCo(nguoiDung), [nguoiDung]);
    const danhGia = useMemo(
        () =>
            danhGiaQuyen({
                vaiTro: nguoiDung?.vaiTro,
                quyenIds: pq ? quyenIds : [],
                dsQuyen: thamChieu?.dsQuyen ?? [],
                // Không đọc được cấu hình: null để không ghi nhầm "vai trò chưa có mẫu"
                mau: thamChieu && !thamChieu.cauHinh ? null : (thamChieu?.cauHinh?.mauQuyen?.[nguoiDung?.vaiTro] ?? []),
                nhayCam: thamChieu?.cauHinh?.quyenNhayCam ?? [],
                daApDung: thamChieu?.cauHinh?.quyenDaApDung ?? null,
                menu: SIDEBAR_MENU,
            }),
        [nguoiDung, pq, quyenIds, thamChieu],
    );

    const moNganKeo = searchParams.get("phan-quyen") === "1" && !laChinhMinh;
    // Mở ngăn kéo = thêm một mục lịch sử (đánh dấu `nganKeo` trong state), để nút Back đóng ngăn kéo
    // thay vì rời trang. Đóng: nếu mục đó do trang thêm thì lùi lại, không thì chỉ bỏ tham số.
    const urlVoiNganKeo = useCallback(
        (mo) => {
            const sau = new URLSearchParams(searchParams);
            if (mo) sau.set("phan-quyen", "1");
            else sau.delete("phan-quyen");
            const chuoi = sau.toString();
            return `${location.pathname}${chuoi ? `?${chuoi}` : ""}`;
        },
        [searchParams, location.pathname],
    );
    const datNganKeo = useCallback(
        (mo) => {
            if (mo) {
                navigate(urlVoiNganKeo(true), { state: { ...(location.state ?? {}), nganKeo: true } });
            } else if (location.state?.nganKeo) {
                navigate(-1);
            } else {
                navigate(urlVoiNganKeo(false), { replace: true, state: location.state });
            }
        },
        [navigate, urlVoiNganKeo, location.state],
    );
    // Mở thẳng bằng đường dẫn có ?phan-quyen=1 (thông báo ở danh sách, link cũ /edit-role): tách thành
    // trang + ngăn kéo để Back cũng chỉ đóng ngăn kéo
    const moTuDuongDan = moNganKeo && !location.state?.nganKeo;
    const daTachDuongDan = useRef(false); // StrictMode chạy effect hai lần: chỉ tách một lần
    useEffect(() => {
        if (!moTuDuongDan || daTachDuongDan.current) return;
        daTachDuongDan.current = true;
        const stateGoc = location.state ?? {};
        navigate(urlVoiNganKeo(false), { replace: true, state: stateGoc });
        navigate(urlVoiNganKeo(true), { state: { ...stateGoc, nganKeo: true } });
    }, [moTuDuongDan, location.state, navigate, urlVoiNganKeo]);
    const moPhanQuyen = (theoMau = false) => {
        setDienMau(theoMau === true);
        setLanMo((n) => n + 1);
        datNganKeo(true);
    };
    // Back khi còn thay đổi chưa lưu: ngăn kéo gọi lại để mở lại (giữ bản nháp) rồi hỏi bỏ thay đổi
    const moLaiNganKeo = useCallback(() => datNganKeo(true), [datNganKeo]);

    const lichSu = lichSuQ.data;
    const idVuaLuu = mocLuu && lichSu?.length && lichSu[0].id !== mocLuu.idCu ? lichSu[0].id : null;

    const daLuuPhanQuyen = (moi, { catQuyen } = {}) => {
        setMocLuu({ idCu: lichSu?.[0]?.id ?? null });
        setDanhDau(null);
        if (moi) nguoiDungQ.setData(moi);
        else nguoiDungQ.reload();
        lichSuQ.reload();
        datNganKeo(false);
        toast.success(`Đã lưu phân quyền cho ${nguoiDung?.tenDangNhap ? `@${nguoiDung.tenDangNhap}` : "người dùng"}.`, {
            description: catQuyen
                ? "Nếu đang đăng nhập, người dùng phải đăng nhập lại ở thao tác kế tiếp."
                : "Quyền mới dùng được sau khi người dùng đăng nhập lại.",
        });
    };

    const doiTrangThai = async () => {
        if (dangXuLy || !nguoiDung) return;
        const dangHoatDong = Number(nguoiDung.trangThai) === 1;
        setDangXuLy(true);
        try {
            await adminService.toggleUserStatusByAdmin(id);
            setHop(null);
            toast.success(
                dangHoatDong
                    ? `Đã khóa tài khoản ${nguoiDung.tenDangNhap}.`
                    : `Đã mở khóa tài khoản ${nguoiDung.tenDangNhap}.`,
            );
            nguoiDungQ.reload();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể cập nhật trạng thái tài khoản"));
        } finally {
            setDangXuLy(false);
        }
    };

    const capLaiMatKhau = async () => {
        if (dangXuLy || !nguoiDung) return;
        setDangXuLy(true);
        try {
            await adminService.resetUserPasswordRandomByAdmin(id);
            setHop(null);
            toast.success(`Đã gửi mật khẩu tạm thời mới tới ${nguoiDung.email}.`);
            nguoiDungQ.reload();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể cấp lại mật khẩu cho người dùng"));
        } finally {
            setDangXuLy(false);
        }
    };

    if (nguoiDungQ.error && !nguoiDung) {
        const notFound = NOT_FOUND_STATUSES.includes(getApiErrorStatus(nguoiDungQ.error));
        return (
            <PageContainer className="space-y-4">
                <Link
                    to={backTo}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-bo-primary hover:text-bo-primary-hover"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {notFound ? (
                        <EmptyState
                            icon={UserX}
                            title="Không tìm thấy người dùng"
                            description="Tài khoản có thể đã bị xóa hoặc đường dẫn không còn hợp lệ."
                            action={
                                <Button variant="outline" onClick={() => navigate(backTo)} className={NUT_VIEN}>
                                    <ArrowLeft className="size-4" />
                                    Quay lại danh sách
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không thể tải thông tin người dùng"
                            description={getApiErrorMessage(nguoiDungQ.error, LOAD_ERROR_MESSAGE)}
                            onRetry={nguoiDungQ.reload}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    if (!nguoiDung) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải dữ liệu người dùng" />
            </PageContainer>
        );
    }

    const dangHoatDong = Number(nguoiDung.trangThai) === 1;
    const tenHienThi = nguoiDung.hoTen || nguoiDung.tenDangNhap;
    const vanDe = thamChieu ? vanDeCanXemLai({ vaiTro: nguoiDung.vaiTro, coKho: Boolean(pq?.kho), danhGia }) : [];
    // Điểm đã đánh dấu mà không còn (vd. vừa lưu xong) thì thôi đánh dấu
    const diemDanhDau = vanDe.find((v) => v.ma === danhDau) ?? null;
    // "Sửa theo mẫu" chỉ khi còn lệch mẫu (thừa/thiếu); chỉ có cặp tạo–duyệt nằm sẵn trong mẫu thì điền mẫu chẳng đổi gì
    const coMau = Boolean(pq?.kho) && (thamChieu?.cauHinh?.mauQuyen?.[nguoiDung.vaiTro]?.length ?? 0) > 0;
    const suaTheoMau = coMau && !laChinhMinh && Boolean(danhGia?.ngoaiMau.length || danhGia?.thieuMau.length);

    return (
        <PageContainer className="nd-trang flex min-h-full flex-col">
            <article className="nd-khoi flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <DauTrangNguoiDung
                    nguoiDung={nguoiDung}
                    pq={pq}
                    laChinhMinh={laChinhMinh}
                    onQuayLai={() => navigate(backTo)}
                    onPhanQuyen={() => moPhanQuyen()}
                    onCapLaiMatKhau={() => setHop("mat-khau")}
                    onKhoaMoKhoa={() => setHop("khoa")}
                />

                {!dangHoatDong ? (
                    // Thẻ "Bị khóa" ở đầu khối đã nói trạng thái: dải này chỉ ghi hệ quả và nút xử lý.
                    // Đặt trước khung Cần xem lại: không đăng nhập được là việc nặng hơn
                    <DaiBao icon={Lock} nutNhan={laChinhMinh ? null : "Mở khóa tài khoản"} onNut={() => setHop("khoa")}>
                        Người dùng không đăng nhập được cho tới khi mở khóa.
                    </DaiBao>
                ) : null}

                <CanXemLai
                    vanDe={vanDe}
                    danhDau={diemDanhDau?.ma ?? null}
                    idVung="vung-tab-nguoi-dung"
                    className={dangHoatDong ? undefined : "mt-4"}
                    onChonDiem={(ma) => {
                        // Đang ở tab Lịch sử: bấm điểm nào cũng chỉ mở lại tab Quyền với điểm đó (không tắt)
                        if (tab !== "quyen") {
                            setDanhDau(ma);
                            setTab("quyen");
                        } else {
                            setDanhDau(diemDanhDau?.ma === ma ? null : ma);
                        }
                    }}
                    onBoDanhDau={() => setDanhDau(null)}
                    nhanNut={suaTheoMau ? "Sửa theo mẫu" : null}
                    onNut={suaTheoMau ? () => moPhanQuyen(true) : null}
                />

                <div className="nd-than @container grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section aria-label="Quyền và lịch sử" className="nd-cot-trai flex min-w-0 flex-col">
                        <div className="border-b border-bo-border px-4 sm:px-6">
                            <div role="tablist" aria-label="Nội dung" className="-mb-px flex gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
                                {[
                                    { ma: "quyen", nhan: "Quyền truy cập" },
                                    { ma: "lich-su", nhan: "Lịch sử phân quyền", so: lichSu?.length },
                                ].map((t) => {
                                    const chon = t.ma === tab;
                                    return (
                                        <button
                                            key={t.ma}
                                            type="button"
                                            role="tab"
                                            id={`tab-nguoi-dung-${t.ma}`}
                                            aria-selected={chon}
                                            aria-controls="vung-tab-nguoi-dung"
                                            onClick={() => setTab(t.ma)}
                                            className={cn(
                                                "inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                                                chon
                                                    ? "border-bo-primary font-semibold text-bo-foreground"
                                                    : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
                                            )}
                                        >
                                            {t.nhan}
                                            {t.so > 0 ? (
                                                <span
                                                    className={cn(
                                                        "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                                                        chon ? "bg-bo-primary-soft text-bo-primary" : "bg-slate-100 text-slate-600",
                                                    )}
                                                >
                                                    {t.so}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div
                            id="vung-tab-nguoi-dung"
                            role="tabpanel"
                            aria-labelledby={`tab-nguoi-dung-${tab}`}
                            className="nd-vung-tab flex min-w-0 flex-1 flex-col"
                        >
                            {tab === "lich-su" ? (
                                <LichSuPhanQuyen
                                    // Lần lưu mới: dựng lại để về trang đầu, thấy ngay dòng "Vừa lưu"
                                    key={idVuaLuu ?? "lich-su"}
                                    lichSu={lichSu}
                                    dangTai={lichSuQ.loading}
                                    loi={lichSuQ.error}
                                    onThuLai={lichSuQ.reload}
                                    idVuaLuu={idVuaLuu}
                                />
                            ) : (
                                // Màn rộng: vùng này tự cuộn (index.css › .nd-cuon), khối giữ vừa khung nội dung
                                <div className="nd-cuon flex flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
                                    {thamChieuQ.error && !thamChieu ? (
                                        <ErrorState
                                            className="nd-trong min-h-48"
                                            title="Không tải được danh sách quyền"
                                            description={getApiErrorMessage(thamChieuQ.error, "Kiểm tra kết nối rồi thử lại.")}
                                            onRetry={thamChieuQ.reload}
                                        />
                                    ) : !thamChieu ? (
                                        <LoadingState className="nd-trong min-h-48" label="Đang tải quyền truy cập" />
                                    ) : (
                                        <QuyenTruyCap
                                            vaiTro={nguoiDung.vaiTro}
                                            pq={pq}
                                            danhGia={danhGia}
                                            danhDau={diemDanhDau ? new Set(diemDanhDau.maQuyen) : null}
                                            coThePhanQuyen={!laChinhMinh}
                                            onPhanQuyen={() => moPhanQuyen()}
                                            khongDocDuocCauHinh={!thamChieu.cauHinh}
                                            onTaiLaiCauHinh={thamChieuQ.reload}
                                            dangTaiCauHinh={thamChieuQ.loading}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <ThuocTinhNguoiDung nguoiDung={nguoiDung} />
                </div>
            </article>

            {thamChieu ? (
                <NganKeoPhanQuyen
                    key={`${nguoiDung.id}-${lanMo}`}
                    mo={moNganKeo}
                    nguoiDung={nguoiDung}
                    laChinhMinh={laChinhMinh}
                    dienMauKhiMo={dienMau}
                    dsQuyen={thamChieu.dsQuyen}
                    cauHinh={thamChieu.cauHinh}
                    menu={SIDEBAR_MENU}
                    onDong={() => datNganKeo(false)}
                    onDaLuu={daLuuPhanQuyen}
                    onMoLai={moLaiNganKeo}
                    onTaiLaiCauHinh={thamChieuQ.reload}
                    dangTaiCauHinh={thamChieuQ.loading}
                />
            ) : (
                <NganKeoCho
                    mo={moNganKeo}
                    loi={thamChieuQ.error}
                    onThuLai={thamChieuQ.reload}
                    onDong={() => datNganKeo(false)}
                />
            )}

            {/* Khóa / mở khóa */}
            <AlertDialog open={hop === "khoa"} onOpenChange={(m) => (!m && !dangXuLy ? setHop(null) : null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {dangHoatDong ? `Khóa tài khoản ${tenHienThi}?` : `Mở khóa tài khoản ${tenHienThi}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {dangHoatDong
                                ? "Người dùng bị đăng xuất ở thao tác tiếp theo và không đăng nhập được cho tới khi mở khóa. Phiếu, đơn và lịch sử do người này tạo vẫn giữ nguyên."
                                : "Người dùng đăng nhập lại được bằng mật khẩu hiện tại. Vai trò, nơi làm việc và quyền giữ như trước khi khóa."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={dangXuLy}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={dangXuLy}
                            onClick={(e) => {
                                e.preventDefault();
                                doiTrangThai();
                            }}
                            className={
                                dangHoatDong
                                    ? "bg-bo-danger text-white hover:bg-bo-danger/90"
                                    : "bg-bo-primary text-white hover:bg-bo-primary-hover"
                            }
                        >
                            {dangXuLy ? "Đang xử lý..." : dangHoatDong ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cấp lại mật khẩu */}
            <AlertDialog open={hop === "mat-khau"} onOpenChange={(m) => (!m && !dangXuLy ? setHop(null) : null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cấp lại mật khẩu cho {tenHienThi}?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                    Hệ thống tạo mật khẩu tạm thời ngẫu nhiên và gửi tới{" "}
                                    <span className="font-medium text-slate-900">{nguoiDung.email}</span>. Sau khi đăng nhập,
                                    người dùng phải đổi mật khẩu mới.
                                </p>
                                {!dangHoatDong ? (
                                    <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
                                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                        Tài khoản đang bị khóa: người dùng chỉ đăng nhập được bằng mật khẩu mới sau khi được mở khóa.
                                    </p>
                                ) : null}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={dangXuLy}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={dangXuLy || !nguoiDung.email}
                            onClick={(e) => {
                                e.preventDefault();
                                capLaiMatKhau();
                            }}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {dangXuLy ? "Đang gửi..." : "Cấp lại mật khẩu"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
