import { createElement, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronRight, CircleCheck, CirclePause, Ellipsis, Mail, Pencil, Phone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThanhMuc } from "@/components/nhap-kho/ThanhBuoc";
import NutSaoChep from "@/components/shared/NutSaoChep";
import StatusBadge from "@/components/shared/StatusBadge";
import UserAvatar from "@/components/UserAvatar";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { khoService } from "@/services/khoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { laKhoAo, laKhoHoatDong } from "@/utils/kho";
import { laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";
import { gopKhuVuc, nhanPhanQuyen, taoOSo, tomTatKe } from "./chiTietKho";
import { nhanLoaiKho } from "./loaiKho";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const NUT_ICON =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";
const MUC_MENU =
    "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const MAU_TONE = { bad: "text-bo-danger", warn: "text-bo-warning" };
const KHUNG_XAM = "block animate-pulse rounded bg-slate-100";

const gioPhut = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Một dòng báo trong khối: lỗi tải (có Thử lại) hoặc không có quyền (không có nút). */
function DongBao({ children, onThuLai }) {
    return (
        <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-bo-border px-4 py-3 text-[13px] leading-5 text-slate-600"
        >
            <span className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-bo-danger" aria-hidden="true" />
                {children}
            </span>
            {onThuLai ? (
                <Button type="button" variant="outline" size="sm" onClick={onThuLai} className={NUT_VIEN}>
                    Thử lại
                </Button>
            ) : null}
        </div>
    );
}

/** Ô số liệu: bấm được thì là nút mở trang liên quan (đã lọc theo kho). */
function OSo({ o, dangTai, onMo }) {
    const noiDung = (
        <>
            <span className="flex items-center gap-0.5 text-[13px] leading-5 text-bo-muted">
                {o.nhan}
                {onMo ? (
                    <ChevronRight className="size-3.5 text-slate-300 transition-colors group-hover:text-bo-primary" aria-hidden="true" />
                ) : null}
            </span>
            {dangTai ? (
                <>
                    <span className={cn(KHUNG_XAM, "mt-1.5 h-6 w-3/5")} />
                    <span className={cn(KHUNG_XAM, "mt-2 h-3 w-4/5")} />
                </>
            ) : (
                <>
                    <span className="mt-0.5 block truncate text-[22px] font-semibold leading-[30px] tracking-[-0.01em] text-bo-heading tabular-nums max-sm:text-xl max-sm:leading-7">
                        {o.giaTri}
                    </span>
                    {o.thanh ? (
                        <ThanhMuc className="mt-1.5" phanTram={o.thanh.phanTram} tone={o.thanh.tone} label={`${o.nhan} ${o.giaTri}`} />
                    ) : null}
                    {o.phu.some((p) => p.chu) ? (
                        <span className="mt-1 block text-xs leading-4 text-bo-muted">
                            {o.phu.map((p, i) => (
                                <span key={i} className={MAU_TONE[p.tone]}>
                                    {p.chu}
                                </span>
                            ))}
                        </span>
                    ) : null}
                </>
            )}
        </>
    );
    const lop = "block min-w-0 bg-white px-4 py-3.5 text-left max-sm:px-3.5 max-sm:py-3";
    if (!onMo || dangTai) return <div className={lop} title={o.goiY}>{noiDung}</div>;
    return (
        <button
            type="button"
            onClick={onMo}
            title={o.goiY ? `${o.goiY}. Bấm để mở ${o.nhanDen}` : `Mở ${o.nhanDen}`}
            className={cn(
                lop,
                "group w-full transition-colors hover:bg-bo-surface-subtle focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary",
            )}
        >
            {noiDung}
        </button>
    );
}

/** Một dòng liên hệ của người quản lý: giá trị, nút mở (gọi / gửi email), nút sao chép. */
function DongLienHe({ giaTri, href, nhanMo, icon, nhanSaoChep }) {
    if (!giaTri) return null;
    return (
        <div className="mt-1 flex min-w-0 items-center gap-0.5">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-slate-600" title={giaTri}>
                {giaTri}
            </span>
            <a href={href} aria-label={nhanMo} title={nhanMo} className={NUT_ICON}>
                {createElement(icon, { className: "size-3.5", "aria-hidden": true })}
            </a>
            <NutSaoChep giaTri={giaTri} nhan={nhanSaoChep} />
        </div>
    );
}

function TieuDeKhoi({ id, children, phu, ben }) {
    return (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 id={id} className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold leading-5 text-bo-foreground">
                {children}
                {phu ? <span className="text-[13px] font-normal text-bo-muted">{phu}</span> : null}
            </h3>
            {ben}
        </div>
    );
}

function LienKet({ children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex min-h-8 items-center gap-0.5 rounded text-[13px] font-medium leading-5 text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary"
        >
            {children}
            <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
    );
}

/**
 * Popup Chi tiết kho — PA2 "Một khối" (chốt 18/10/2026).
 * - Đầu khối: tên + trạng thái, mã (sao chép) · loại · ngày tạo; ⋯ (Ngừng / Cho phép hoạt động), Chỉnh sửa, đóng.
 * - 4 ô số bấm được (Tồn kho, Giá trị tồn, Mã hàng, Sức chứa kệ); kho ảo 3 ô hàng đang chuyển.
 * - Trái: khu vực kệ với % đầy (vị trí bảo trì không tính); phải: thông tin + người quản lý.
 * - Điện thoại: tấm trượt từ dưới lên, ô số 2 cột, Chỉnh sửa rộng hết chân.
 * Số liệu tải lại mỗi lần mở. `coTheQuanLy`: quản trị viên (sửa / đổi trạng thái là quyền của quản trị viên).
 */
export default function ChiTietKhoDialog({ kho, open, onOpenChange, coTheQuanLy = false, onChinhSua, onDoiTrangThai }) {
    const navigate = useNavigate();
    const tieuDeRef = useRef(null);

    // Mỗi lần mở là một lần tải mới (số tồn có thể đã đổi từ lần trước)
    const [lanMo, setLanMo] = useState(0);
    const [moTruoc, setMoTruoc] = useState(open);
    if (open !== moTruoc) {
        setMoTruoc(open);
        if (open) setLanMo((n) => n + 1);
    }

    const id = kho?.id;
    const ao = laKhoAo(kho);
    const hoatDong = laKhoHoatDong(kho);
    const coKho = open && Boolean(id);

    const tomTatQ = useTaiDuLieu(
        async () => ({ ...(await khoService.tomTat(id)), luc: new Date() }),
        `tom-tat-${id}#${lanMo}`,
        { enabled: coKho },
    );
    const keQ = useTaiDuLieu(
        async () => ({ ...(await khoService.khuVucVaViTri(id)), khoId: id }),
        `ke-${id}#${lanMo}`,
        { enabled: coKho && !ao },
    );

    // Chỉ dùng dữ liệu của đúng kho đang xem (đổi kho / đang đóng thì dữ liệu cũ còn giữ trong hook)
    const cuaKhoNay = (d) => d != null && id != null && d.khoId === id;
    const tomTat = !tomTatQ.loading && !tomTatQ.error && cuaKhoNay(tomTatQ.data) ? tomTatQ.data : null;
    const ke = !keQ.loading && !keQ.error && cuaKhoNay(keQ.data) ? gopKhuVuc(keQ.data.khuVucs, keQ.data.viTris) : null;

    if (!kho) return null;

    const loai = nhanLoaiKho(kho);
    const oSo = taoOSo(kho, tomTat, ke?.tong ?? null);
    const moVitriKe = laKhoLamViecHopLe(kho);
    const loiTomTat = tomTatQ.error;
    const khongQuyenTomTat = getApiErrorStatus(loiTomTat) === 403;
    const khongQuyenKe = getApiErrorStatus(keQ.error) === 403;

    const dong = () => onOpenChange(false);
    const moDen = (den) => {
        if (!den) return;
        dong();
        if (den.loai === "vi-tri-ke") {
            setKhoLamViecId(kho.id);
            navigate("/warehouse/locations");
            return;
        }
        navigate(den.to);
    };
    const coTheMo = (o) => Boolean(o.den) && (o.den.loai !== "vi-tri-ke" || moVitriKe);

    const quanLy = kho.quanLy;
    const sdt = quanLy?.soDienThoai?.trim() || "";
    const email = quanLy?.email?.trim() || "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                    // Đưa con trỏ vào tiêu đề, không vào nút đầu tiên (trước đây nút Đóng hiện viền đen ngay khi mở)
                    event.preventDefault();
                    tieuDeRef.current?.focus({ preventScroll: true });
                }}
                className={cn(
                    "flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-[min(760px,calc(100%-2rem))]",
                    // Điện thoại: tấm trượt từ dưới lên, gần hết chiều cao màn
                    "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[calc(100dvh-2.5rem)] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
                    "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=closed]:slide-out-to-bottom-8",
                )}
            >
                <header className="flex items-start gap-3 border-b border-bo-border py-4 pl-5 pr-4 max-sm:py-3 max-sm:pl-4 max-sm:pr-2">
                    <div className="min-w-0 flex-1 basis-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <DialogTitle
                                ref={tieuDeRef}
                                tabIndex={-1}
                                className="min-w-0 break-words text-xl font-semibold leading-7 tracking-[-0.01em] text-bo-heading outline-none max-sm:text-lg max-sm:leading-[26px]"
                            >
                                {kho.tenKho || kho.maKho || "—"}
                            </DialogTitle>
                            <StatusBadge doiTuong="kho" size="lg" label={hoatDong ? "Hoạt động" : "Ngừng hoạt động"} />
                        </div>
                        <DialogDescription asChild>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[13px] leading-5 text-bo-muted">
                                {kho.maKho ? (
                                    <>
                                        <span className="font-mono font-semibold text-slate-700">{kho.maKho}</span>
                                        <NutSaoChep giaTri={kho.maKho} nhan="Sao chép mã kho" className="size-6" />
                                    </>
                                ) : null}
                                <span>
                                    {kho.maKho ? "· " : ""}
                                    {loai.label}
                                    {kho.ngayTao ? ` · tạo ${formatDate(kho.ngayTao)}` : ""}
                                </span>
                            </div>
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-2 max-sm:gap-0.5">
                        {coTheQuanLy && !ao ? (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Thao tác khác"
                                        title="Thao tác khác"
                                        className={cn(NUT_VIEN, "max-sm:size-11 max-sm:border-transparent")}
                                    >
                                        <Ellipsis className="size-4" aria-hidden="true" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-50 w-[288px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                    {hoatDong ? (
                                        <DropdownMenuItem onSelect={() => onDoiTrangThai?.(kho)} className={MUC_MENU}>
                                            <CirclePause className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                                            <span>
                                                Ngừng hoạt động
                                                <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
                                                    Không chọn được khi tạo chứng từ mới. Tồn kho và lịch sử giữ nguyên.
                                                </span>
                                            </span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onSelect={() => onDoiTrangThai?.(kho)} className={MUC_MENU}>
                                            <CircleCheck className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                                            <span>
                                                Cho phép hoạt động
                                                <span className="mt-0.5 block text-xs leading-4 text-bo-muted">Dùng lại được cho chứng từ mới.</span>
                                            </span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                        {coTheQuanLy ? (
                            <Button
                                type="button"
                                onClick={() => onChinhSua?.(kho)}
                                className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:hidden"
                            >
                                <Pencil className="size-4" aria-hidden="true" />
                                Chỉnh sửa
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={dong}
                            aria-label="Đóng"
                            title="Đóng"
                            className="text-bo-muted hover:bg-slate-100 hover:text-bo-foreground max-sm:size-11"
                        >
                            <X className="size-4 max-sm:size-5" aria-hidden="true" />
                        </Button>
                    </div>
                </header>

                {!hoatDong ? (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-bo-border bg-bo-surface-subtle px-5 py-2.5 text-[13px] leading-5 text-slate-600 max-sm:px-4">
                        <span>Kho đang ngừng hoạt động: không chọn được khi tạo chứng từ mới.</span>
                        {coTheQuanLy ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => onDoiTrangThai?.(kho)} className={NUT_VIEN}>
                                Cho phép hoạt động
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 max-sm:px-4 max-sm:py-4" aria-busy={tomTatQ.loading || keQ.loading}>
                    {loiTomTat ? (
                        <DongBao onThuLai={khongQuyenTomTat ? null : tomTatQ.reload}>
                            {khongQuyenTomTat
                                ? "Bạn không phụ trách kho này nên không xem được số liệu tồn kho."
                                : getApiErrorMessage(loiTomTat, "Không tải được số liệu tồn kho")}
                        </DongBao>
                    ) : (
                        <div
                            className={cn(
                                "grid gap-px overflow-hidden rounded-lg border border-bo-border bg-bo-border",
                                oSo.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
                            )}
                        >
                            {oSo.map((o) => (
                                <OSo
                                    key={o.khoa}
                                    o={o}
                                    dangTai={o.khoa === "suc-chua" ? keQ.loading : tomTatQ.loading}
                                    onMo={coTheMo(o) ? () => moDen(o.den) : null}
                                />
                            ))}
                        </div>
                    )}

                    <div className="grid gap-x-7 gap-y-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        {ao ? (
                            <section aria-labelledby="ctk-dang-chuyen">
                                <TieuDeKhoi id="ctk-dang-chuyen">
                                    Hàng đang chuyển
                                </TieuDeKhoi>
                                <p className="border-t border-slate-100 pt-3 text-[13px] leading-5 text-bo-muted">
                                    {tomTatQ.loading
                                        ? "Đang tải..."
                                        : Number(tomTat?.soLuongTon) > 0
                                          ? `${oSo[0].giaTri} sản phẩm đang trên đường giữa các kho. Kho ảo không có khu vực kệ.`
                                          : "Không có hàng đang chuyển giữa các kho. Kho ảo không có khu vực kệ."}
                                </p>
                            </section>
                        ) : (
                            <section aria-labelledby="ctk-khu">
                                <TieuDeKhoi
                                    id="ctk-khu"
                                    phu={ke?.tong.coKe ? tomTatKe(ke.tong) : null}
                                    ben={moVitriKe && ke?.tong.coKe ? <LienKet onClick={() => moDen({ loai: "vi-tri-ke" })}>Mở vị trí kệ</LienKet> : null}
                                >
                                    Khu vực kệ
                                </TieuDeKhoi>
                                {keQ.loading ? (
                                    <ul aria-label="Đang tải khu vực kệ">
                                        {[0, 1, 2].map((i) => (
                                            <li key={i} className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-4 border-t border-slate-100 py-3">
                                                <span>
                                                    <span className={cn(KHUNG_XAM, "h-3.5 w-1/2")} />
                                                    <span className={cn(KHUNG_XAM, "mt-2 h-3 w-1/3")} />
                                                </span>
                                                <span className={cn(KHUNG_XAM, "h-1.5")} />
                                            </li>
                                        ))}
                                    </ul>
                                ) : keQ.error ? (
                                    <DongBao onThuLai={khongQuyenKe ? null : keQ.reload}>
                                        {khongQuyenKe ? "Chỉ xem được khu vực kệ của kho bạn phụ trách." : "Không tải được khu vực kệ."}
                                    </DongBao>
                                ) : ke && ke.khu.length > 0 ? (
                                    <ul>
                                        {ke.khu.map((z) => (
                                            <li key={z.id} className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-4 border-t border-slate-100 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_108px] max-sm:gap-3">
                                                <div className="grid min-w-0 grid-cols-[minmax(1.5rem,auto)_minmax(0,1fr)] gap-x-2">
                                                    <span className="row-span-2 max-w-20 truncate pt-px font-mono text-xs font-semibold leading-5 text-bo-muted" title={z.ma}>
                                                        {z.ma}
                                                    </span>
                                                    <span className="truncate text-sm leading-5 text-bo-foreground" title={z.ten}>
                                                        {z.ten}
                                                    </span>
                                                    <span className="text-xs leading-4 text-bo-muted">
                                                        {[z.loai, `${z.soViTri} vị trí`, z.soBaoTri ? `${z.soBaoTri} bảo trì` : ""].filter(Boolean).join(" · ")}
                                                    </span>
                                                </div>
                                                <div>
                                                    {z.coThanh ? <ThanhMuc phanTram={z.phanTram} tone={z.tone} label={`${z.ten}: ${z.nhanMuc}`} /> : null}
                                                    <div className={cn("mt-1 text-right text-xs leading-4 tabular-nums", MAU_TONE[z.tone] ?? "text-slate-600")}>
                                                        {z.nhanMuc}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-start gap-2 border-t border-slate-100 pt-3 text-[13px] leading-5 text-bo-muted">
                                        <span>Kho chưa có khu vực và vị trí kệ.</span>
                                        {moVitriKe ? (
                                            <Button type="button" variant="outline" size="sm" onClick={() => moDen({ loai: "vi-tri-ke" })} className={NUT_VIEN}>
                                                Thiết lập vị trí kệ
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </section>
                        )}

                        <section aria-labelledby="ctk-thong-tin">
                            <TieuDeKhoi id="ctk-thong-tin">Thông tin</TieuDeKhoi>
                            <dl className="space-y-3.5 border-t border-slate-100 pt-3">
                                <div>
                                    <dt className="text-[13px] leading-5 text-bo-muted">Loại kho</dt>
                                    <dd className="mt-0.5 text-sm leading-5">
                                        {loai.label}
                                        <span className="mt-0.5 block text-[13px] leading-5 text-bo-muted">{loai.moTa}</span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[13px] leading-5 text-bo-muted">Địa chỉ</dt>
                                    <dd className="mt-0.5 flex min-w-0 items-start gap-0.5 text-sm leading-5">
                                        <span className="min-w-0 flex-1 break-words">{kho.diaChi?.trim() || "—"}</span>
                                        <NutSaoChep giaTri={kho.diaChi?.trim()} nhan="Sao chép địa chỉ" className="-mt-1" />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[13px] leading-5 text-bo-muted">Người quản lý</dt>
                                    <dd className="mt-1">
                                        {quanLy ? (
                                            <div className="flex min-w-0 items-start gap-2.5">
                                                <UserAvatar userId={quanLy.id} name={quanLy.hoTen} avatarUrl={quanLy.avatarUrl} size="xs" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm leading-5" title={quanLy.hoTen}>
                                                        {quanLy.hoTen || quanLy.tenDangNhap || "—"}
                                                        {quanLy.tenDangNhap && quanLy.tenDangNhap !== quanLy.hoTen ? (
                                                            <span className="text-bo-muted"> · {quanLy.tenDangNhap}</span>
                                                        ) : null}
                                                    </div>
                                                    <DongLienHe giaTri={sdt} href={`tel:${sdt.replace(/\s+/g, "")}`} nhanMo={`Gọi ${sdt}`} icon={Phone} nhanSaoChep="Sao chép số điện thoại" />
                                                    <DongLienHe giaTri={email} href={`mailto:${email}`} nhanMo={`Gửi email tới ${email}`} icon={Mail} nhanSaoChep="Sao chép email" />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-bo-muted">Chưa có người quản lý</span>
                                        )}
                                    </dd>
                                </div>
                                {!ao && !khongQuyenTomTat ? (
                                    <div>
                                        <dt className="text-[13px] leading-5 text-bo-muted">Người được phân quyền</dt>
                                        <dd className="mt-0.5 text-sm leading-5">
                                            {tomTatQ.loading ? (
                                                <span className={cn(KHUNG_XAM, "mt-1 h-3.5 w-32")} />
                                            ) : tomTat ? (
                                                nhanPhanQuyen(tomTat.soNguoiPhanQuyen)
                                            ) : (
                                                "—"
                                            )}
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>
                        </section>
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-bo-border px-5 py-3 max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <span className="text-xs leading-4 text-bo-muted max-sm:hidden">
                        {tomTatQ.loading ? "Đang tải số liệu..." : tomTat?.luc ? `Số liệu lúc ${gioPhut(tomTat.luc)}` : ""}
                    </span>
                    <Button type="button" variant="outline" onClick={dong} className={cn(NUT_VIEN, coTheQuanLy && "max-sm:hidden", "max-sm:h-11 max-sm:w-full")}>
                        Đóng
                    </Button>
                    {coTheQuanLy ? (
                        <Button
                            type="button"
                            onClick={() => onChinhSua?.(kho)}
                            className="h-11 w-full gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover sm:hidden"
                        >
                            <Pencil className="size-4" aria-hidden="true" />
                            Chỉnh sửa
                        </Button>
                    ) : null}
                </footer>
            </DialogContent>
        </Dialog>
    );
}
