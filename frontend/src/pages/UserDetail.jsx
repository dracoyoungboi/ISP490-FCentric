import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, LogIn, Mail, Pencil, RefreshCcw } from "lucide-react";

import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { PHONE_ERROR_MESSAGE, getPhoneError, isPhoneValid, sanitizePhoneInput } from "@/utils/phoneValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorModal from "@/components/AvatarEditorModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import QuyenCuaToi from "@/components/nguoi-dung/ho-so/QuyenCuaToi";
import { SIDEBAR_MENU } from "@/components/backoffice/sidebar.config";
import { QUAN_TRI_VIEN, canKho, ngayGio, quyenCuaToiTheoNhom, tenVaiTro } from "@/components/nguoi-dung/phanQuyen";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const TABS = ["thong-tin", "quyen"];
const O_NHAP =
    "h-9 max-w-[420px] border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";

/** Một dòng của form thông tin: nhãn bên trái (trên điện thoại thì nằm trên), nội dung bên phải. */
function DongThongTin({ nhan, htmlFor, children }) {
    return (
        <div className="grid gap-1.5 border-b border-slate-100 py-3.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
            {htmlFor ? (
                <label htmlFor={htmlFor} className="text-[13px] font-medium text-bo-muted">
                    {nhan}
                </label>
            ) : (
                <span className="text-[13px] font-medium text-bo-muted">{nhan}</span>
            )}
            <div className="min-w-0 text-sm text-bo-foreground">{children}</div>
        </div>
    );
}

function KhongDoiDuoc({ children }) {
    return <span className="text-xs text-bo-muted">{children}</span>;
}

function NhanNhom({ children }) {
    return <div className="mb-2.5 text-xs font-medium leading-4 text-bo-muted">{children}</div>;
}

/**
 * Hồ sơ của tôi (route /profile, chốt 18/10/2026): một khối gồm đầu trang, tab Thông tin cá nhân / Quyền của tôi
 * và cột Tài khoản · Cần hỗ trợ. Chỉ sửa được họ tên và số điện thoại; tên đăng nhập và email không đổi được
 * (máy chủ cũng chặn). Quyền đọc từ CSDL; quyền khác phiên đăng nhập thì nhắc đăng nhập lại.
 */
export default function UserDetail() {
    useClaimPageTitle(true);
    const navigate = useNavigate();

    const hoSoQ = useTaiDuLieu(async () => {
        const res = await nguoiDungService.getMe();
        if (!res?.data) throw new Error("Không đọc được dữ liệu người dùng");
        return res.data;
    }, "");
    const quyenQ = useTaiDuLieu(() => nguoiDungService.getMyPermissions(), "");

    const [tab, setTab] = useTabTrenUrl(TABS, "thong-tin", { ten: "tab" });
    const [dangSua, setDangSua] = useState(false);
    const [nhap, setNhap] = useState({ hoTen: "", soDienThoai: "" });
    const [loi, setLoi] = useState({ hoTen: "", soDienThoai: "" });
    const [dangLuu, setDangLuu] = useState(false);
    const [moAnh, setMoAnh] = useState(false);
    const [moMatKhau, setMoMatKhau] = useState(false);

    const hoSo = hoSoQ.data;
    const quyen = quyenQ.data;

    if (hoSoQ.error && !hoSo) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <ErrorState
                        title="Không tải được hồ sơ"
                        description={getApiErrorMessage(hoSoQ.error, "Kiểm tra kết nối rồi thử lại.")}
                        onRetry={hoSoQ.reload}
                    />
                </div>
            </PageContainer>
        );
    }
    if (!hoSo) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải hồ sơ" />
            </PageContainer>
        );
    }

    const laQuanTri = hoSo.vaiTro === QUAN_TRI_VIEN;
    const khoHienTai = quyen?.kho ?? hoSo.khoPhuTrachActive?.[0] ?? null;
    const khoNgan = laQuanTri
        ? "mọi kho"
        : !canKho(hoSo.vaiTro)
            ? "không dùng kho"
            : khoHienTai
                ? khoHienTai.tenKho || khoHienTai.maKho
                : "chưa có kho";
    // Đếm đúng như tab hiển thị: chỉ việc làm được thật (bỏ quyền chưa có tác dụng)
    const soQuyen = quyen && !quyen.toanQuyen ? quyenCuaToiTheoNhom(quyen, { menu: SIDEBAR_MENU }).soViec : 0;

    const batSua = () => {
        setNhap({ hoTen: hoSo.hoTen || "", soDienThoai: hoSo.soDienThoai || "" });
        setLoi({ hoTen: "", soDienThoai: "" });
        setDangSua(true);
        setTab("thong-tin");
    };
    const huySua = () => {
        setDangSua(false);
        setLoi({ hoTen: "", soDienThoai: "" });
    };
    const chuan = (v) => (v ?? "").trim();
    const coThayDoi = chuan(nhap.hoTen) !== chuan(hoSo.hoTen) || chuan(nhap.soDienThoai) !== chuan(hoSo.soDienThoai);

    const luu = async () => {
        const loiMoi = {
            hoTen: chuan(nhap.hoTen) ? "" : "Họ và tên không được để trống.",
            soDienThoai: isPhoneValid(nhap.soDienThoai) ? "" : PHONE_ERROR_MESSAGE,
        };
        setLoi(loiMoi);
        if (loiMoi.hoTen || loiMoi.soDienThoai || dangLuu) return;
        setDangLuu(true);
        try {
            const res = await nguoiDungService.updateMe({
                hoTen: chuan(nhap.hoTen),
                soDienThoai: chuan(nhap.soDienThoai) || null,
            });
            if (!res?.data) throw new Error("Không đọc được dữ liệu trả về");
            hoSoQ.setData(res.data);
            setDangSua(false);
            toast.success("Đã cập nhật hồ sơ.");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không cập nhật được hồ sơ. Vui lòng thử lại."));
        } finally {
            setDangLuu(false);
        }
    };

    const dangNhapLai = () => {
        nguoiDungService.logout();
        sessionStorage.clear();
        navigate("/login", { replace: true });
    };

    const loiSdtTrucTiep = loi.soDienThoai || getPhoneError(nhap.soDienThoai);

    return (
        <PageContainer className="flex min-h-full flex-col">
            <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                {/* Đầu khối */}
                <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex min-w-0 flex-1 basis-80 items-center gap-4">
                        <div className="relative shrink-0">
                            <UserAvatar userId={hoSo.id} name={hoSo.hoTen} avatarUrl={hoSo.avatarUrl} size="md" />
                            <button
                                type="button"
                                onClick={() => setMoAnh(true)}
                                aria-label="Đổi ảnh đại diện"
                                title="Đổi ảnh đại diện"
                                className="absolute -bottom-0.5 -right-0.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-bo-foreground text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                            >
                                <Camera className="size-3" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="min-w-0">
                            {/* Không hiện thẻ trạng thái: tự xem hồ sơ thì luôn đang hoạt động (tài khoản bị khóa không đăng nhập được) */}
                            <PageHeading className="max-sm:line-clamp-2 max-sm:whitespace-normal">
                                <span title={hoSo.hoTen || undefined}>{hoSo.hoTen || hoSo.tenDangNhap || "—"}</span>
                            </PageHeading>
                            <p className="mt-0.5 break-words text-[13px] leading-5 text-bo-muted">
                                <span className="font-mono font-semibold text-slate-700">@{hoSo.tenDangNhap}</span>
                                {` · ${tenVaiTro(hoSo.vaiTro)} · ${khoNgan}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 max-sm:w-full">
                        {dangSua ? (
                            <>
                                <Button type="button" variant="outline" onClick={huySua} disabled={dangLuu} className={`max-sm:h-11 max-sm:flex-1 ${NUT_VIEN}`}>
                                    Hủy
                                </Button>
                                <Button
                                    type="button"
                                    onClick={luu}
                                    disabled={dangLuu || !coThayDoi}
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:h-11 max-sm:flex-1"
                                >
                                    {dangLuu ? "Đang lưu..." : "Lưu thông tin"}
                                </Button>
                            </>
                        ) : (
                            // Đổi mật khẩu nằm ở dòng Mật khẩu trong tab Thông tin cá nhân, không lặp lại ở đầu trang
                            <Button type="button" onClick={batSua} className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:h-11 max-sm:flex-1">
                                <Pencil className="size-4" aria-hidden="true" />
                                Chỉnh sửa
                            </Button>
                        )}
                    </div>
                </header>

                {quyen?.canDangNhapLai ? (
                    <div className="px-4 pb-4 sm:px-6">
                        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[13px] leading-5 text-blue-950">
                            <RefreshCcw className="size-4 shrink-0 text-bo-primary" aria-hidden="true" />
                            <span className="min-w-60 flex-1">
                                <b className="font-semibold">
                                    Quyền của bạn vừa được cập nhật{quyen.capNhatLuc ? ` lúc ${ngayGio(quyen.capNhatLuc)}` : ""}.
                                </b>{" "}
                                Đăng nhập lại để dùng quyền mới.
                            </span>
                            <Button type="button" variant="outline" size="sm" onClick={dangNhapLai} className={`gap-1.5 ${NUT_VIEN}`}>
                                <LogIn className="size-3.5" aria-hidden="true" />
                                Đăng nhập lại
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="border-b border-bo-border px-4 sm:px-6">
                    <div role="tablist" aria-label="Hồ sơ" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
                        {[
                            { ma: "thong-tin", nhan: "Thông tin cá nhân" },
                            { ma: "quyen", nhan: "Quyền của tôi", so: soQuyen },
                        ].map((t) => {
                            const chon = t.ma === tab;
                            return (
                                <button
                                    key={t.ma}
                                    type="button"
                                    role="tab"
                                    id={`tab-ho-so-${t.ma}`}
                                    aria-selected={chon}
                                    aria-controls="vung-tab-ho-so"
                                    // Đang sửa mà sang tab khác thì giữ nguyên nội dung đang sửa (nút Hủy/Lưu vẫn ở đầu trang)
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

                <div className="@container grid flex-1 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section
                        id="vung-tab-ho-so"
                        role="tabpanel"
                        aria-labelledby={`tab-ho-so-${tab}`}
                        className="min-w-0 px-4 pb-6 pt-2 sm:px-6"
                    >
                        {tab === "quyen" ? (
                            <QuyenCuaToi quyen={quyen} dangTai={quyenQ.loading} loi={quyenQ.error} onThuLai={quyenQ.reload} />
                        ) : (
                            <div>
                                <DongThongTin nhan="Họ và tên" htmlFor={dangSua ? "ho-ten" : undefined}>
                                    {dangSua ? (
                                        <div>
                                            <Input
                                                id="ho-ten"
                                                value={nhap.hoTen}
                                                maxLength={100}
                                                autoComplete="name"
                                                aria-invalid={Boolean(loi.hoTen)}
                                                onChange={(e) => {
                                                    setNhap((cu) => ({ ...cu, hoTen: e.target.value }));
                                                    setLoi((cu) => ({ ...cu, hoTen: "" }));
                                                }}
                                                className={cn(O_NHAP, loi.hoTen && "border-bo-danger")}
                                            />
                                            {loi.hoTen ? <p className="mt-1 text-xs text-bo-danger">{loi.hoTen}</p> : null}
                                        </div>
                                    ) : (
                                        hoSo.hoTen || "—"
                                    )}
                                </DongThongTin>
                                <DongThongTin nhan="Số điện thoại" htmlFor={dangSua ? "so-dien-thoai" : undefined}>
                                    {dangSua ? (
                                        <div>
                                            <Input
                                                id="so-dien-thoai"
                                                value={nhap.soDienThoai}
                                                inputMode="numeric"
                                                autoComplete="tel"
                                                maxLength={10}
                                                placeholder="10 số, bắt đầu bằng 0"
                                                aria-invalid={Boolean(loiSdtTrucTiep)}
                                                onChange={(e) => {
                                                    setNhap((cu) => ({ ...cu, soDienThoai: sanitizePhoneInput(e.target.value) }));
                                                    setLoi((cu) => ({ ...cu, soDienThoai: "" }));
                                                }}
                                                className={cn(O_NHAP, loiSdtTrucTiep && "border-bo-danger")}
                                            />
                                            {loiSdtTrucTiep ? (
                                                <p className="mt-1 text-xs text-bo-danger">{loiSdtTrucTiep}</p>
                                            ) : (
                                                <p className="mt-1 text-xs text-bo-muted">Cũng dùng để đăng nhập. Để trống nếu không muốn lưu.</p>
                                            )}
                                        </div>
                                    ) : hoSo.soDienThoai ? (
                                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span className="tabular-nums">{hoSo.soDienThoai}</span>
                                            <span className="text-xs text-bo-muted">Cũng dùng để đăng nhập</span>
                                        </span>
                                    ) : (
                                        <span className="text-bo-muted">Chưa có</span>
                                    )}
                                </DongThongTin>
                                <DongThongTin nhan="Tên đăng nhập">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono">{hoSo.tenDangNhap}</span>
                                        <KhongDoiDuoc>Không đổi được</KhongDoiDuoc>
                                    </span>
                                </DongThongTin>
                                <DongThongTin nhan="Email">
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        {hoSo.email ? (
                                            <span className="break-all">{hoSo.email}</span>
                                        ) : (
                                            <span className="text-bo-muted">Chưa có</span>
                                        )}
                                        <KhongDoiDuoc>
                                            {hoSo.email
                                                ? "Không đổi được · dùng để đăng nhập và nhận thư đặt lại mật khẩu"
                                                : "Liên hệ quản trị viên để thêm email"}
                                        </KhongDoiDuoc>
                                    </span>
                                </DongThongTin>
                                <DongThongTin nhan="Mật khẩu">
                                    <span className="flex flex-wrap items-center gap-3">
                                        {hoSo.mustChangePassword ? (
                                            <span className="text-amber-700">Đang dùng mật khẩu tạm thời</span>
                                        ) : (
                                            <span aria-label="Đã đặt mật khẩu" className="tracking-widest text-bo-muted">
                                                ••••••••
                                            </span>
                                        )}
                                        <Button type="button" variant="outline" size="sm" onClick={() => setMoMatKhau(true)} className={NUT_VIEN}>
                                            Đổi mật khẩu
                                        </Button>
                                    </span>
                                </DongThongTin>
                            </div>
                        )}
                    </section>

                    <aside
                        aria-label="Tài khoản"
                        className="grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @xl:grid-cols-2 xl:block xl:border-l xl:border-t-0"
                    >
                        <section className="border-b border-slate-200/70 py-4">
                            <NhanNhom>Tài khoản</NhanNhom>
                            <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] leading-5">
                                <dt className="text-bo-muted">Vai trò</dt>
                                <dd className="m-0 min-w-0 text-bo-foreground">{tenVaiTro(hoSo.vaiTro)}</dd>
                                <dt className="text-bo-muted">Kho phụ trách</dt>
                                <dd className="m-0 min-w-0 break-words text-bo-foreground">
                                    {laQuanTri ? (
                                        "Mọi kho"
                                    ) : khoHienTai ? (
                                        <>
                                            {khoHienTai.tenKho || khoHienTai.maKho}{" "}
                                            {khoHienTai.maKho ? (
                                                <span className="font-mono text-xs text-bo-muted">{khoHienTai.maKho}</span>
                                            ) : null}
                                        </>
                                    ) : (
                                        <span className="text-bo-muted">{canKho(hoSo.vaiTro) ? "Chưa có" : "Không dùng kho"}</span>
                                    )}
                                </dd>
                                <dt className="text-bo-muted">Ngày tạo</dt>
                                <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(hoSo.ngayTao)}</dd>
                                <dt className="text-bo-muted">Cập nhật</dt>
                                <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(hoSo.ngayCapNhat)}</dd>
                            </dl>
                        </section>
                        {!laQuanTri ? (
                            <section className="py-4">
                                <NhanNhom>Cần hỗ trợ</NhanNhom>
                                {quyen?.capNhatBoi ? (
                                    <div className="flex items-center gap-2.5">
                                        <UserAvatar name={quyen.capNhatBoi} size="xs" className="shrink-0" />
                                        <div className="min-w-0 flex-1 text-[13px] leading-[18px]">
                                            <div className="truncate font-semibold">{quyen.capNhatBoi}</div>
                                            <div className="text-bo-muted">Người phân quyền gần nhất</div>
                                        </div>
                                        {quyen.capNhatBoiEmail ? (
                                            <Button asChild variant="outline" size="sm" className={`gap-1.5 ${NUT_VIEN}`}>
                                                <a href={`mailto:${quyen.capNhatBoiEmail}`} aria-label={`Gửi email cho ${quyen.capNhatBoi}`}>
                                                    <Mail className="size-3.5" aria-hidden="true" />
                                                    Email
                                                </a>
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                                <p className="mt-2.5 text-[12.5px] leading-[18px] text-bo-muted">
                                    Đổi kho hoặc thêm quyền do quản trị viên làm.
                                </p>
                            </section>
                        ) : null}
                    </aside>
                </div>
            </article>

            <AvatarEditorModal
                open={moAnh}
                onOpenChange={setMoAnh}
                userId={hoSo.id}
                userName={hoSo.hoTen}
                avatarUrl={hoSo.avatarUrl}
                onSaved={(dto) => hoSoQ.setData(dto)}
            />
            <ChangePasswordModal
                open={moMatKhau}
                onOpenChange={setMoMatKhau}
                onSuccess={() => {
                    toast.success("Đã đổi mật khẩu.");
                    hoSoQ.reload();
                }}
            />
        </PageContainer>
    );
}
