import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import AuthShell from '../components/auth/AuthShell';
import { nguoiDungService } from '../services/nguoiDungService';
import { getApiErrorCode, getApiErrorMessage } from '../utils/apiError';
import { GOI_Y_MAT_KHAU, kiemTraMatKhauMoi } from '../utils/matKhau';
import { formatDateTime } from '../utils/dateTime';
import { t } from "@/i18n";

/* ── Class patterns dùng chung với Đăng nhập / Quên mật khẩu ── */
const INPUT_BASE =
    'flex h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const INPUT_NORMAL = 'border-gray-300';
const INPUT_ERROR = 'border-red-500 focus:ring-red-500';
const LABEL = 'text-sm font-medium leading-none text-gray-900';
const PRIMARY_BTN =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const SECONDARY_BTN =
    'inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2';
const ERROR_BANNER =
    'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700';
const INFO_BANNER =
    'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900';
const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-sm text-red-600';
const EYE_BTN =
    'absolute right-3 top-1/2 -translate-y-1/2 rounded text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900';
const DONG_PHU = 'mt-1.5 text-sm';

// Mã nằm sau "#t=" (không gửi lên máy chủ). Đọc xong thì xóa khỏi thanh địa chỉ; giữ trong sessionStorage của tab
// để tải lại trang vẫn dùng được, đặt xong thì xóa.
const KHOA_PHIEN = 'dat_mat_khau_ma';

function layMa() {
    const tuDiaChi = new URLSearchParams(window.location.hash.slice(1)).get('t');
    if (tuDiaChi) {
        try { sessionStorage.setItem(KHOA_PHIEN, tuDiaChi); } catch { /* bỏ qua: chế độ riêng tư */ }
        // giữ nguyên state của react-router trong mục lịch sử, chỉ bỏ phần #t=…
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        return tuDiaChi;
    }
    try { return sessionStorage.getItem(KHOA_PHIEN) || ''; } catch { return ''; }
}

function quenMa() {
    try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
}

const TIEU_DE_LOI = {
    LIEN_KET_HET_HAN: t("Liên kết đã hết hạn"),
    LIEN_KET_DA_DUNG: t("Liên kết đã được dùng"),
    LIEN_KET_DA_THAY: t("Liên kết đã hết hiệu lực"),
    LIEN_KET_KHONG_HOP_LE: t("Liên kết không đúng"),
};
const MA_LOI_LIEN_KET = Object.keys(TIEU_DE_LOI);

/** Lỗi do chính liên kết (hết hạn, đã dùng, đã thay, sai): { ma, thongDiep }; lỗi khác (mạng, mật khẩu): null. */
function loiLienKet(err) {
    const ma = getApiErrorCode(err);
    if (!MA_LOI_LIEN_KET.includes(ma)) return null;
    // liên kết không dùng được nữa: bỏ mã đã giữ cho lần tải lại trang
    quenMa();
    return { ma, thongDiep: getApiErrorMessage(err, '') };
}

/**
 * Trang Đặt mật khẩu mở từ email tạo tài khoản (E2) hoặc cấp lại mật khẩu (E3). Không cần đăng nhập.
 * Mở trang chỉ kiểm liên kết (máy quét link của hộp thư mở thử cũng không làm hỏng); bấm Đặt mật khẩu mới dùng liên kết.
 */
export default function SetPasswordPage() {
    const navigate = useNavigate();
    const maRef = useRef(null);
    if (maRef.current === null) maRef.current = layMa();

    // dangKiem | loiLienKet | loiMang | nhap | xong
    const [buoc, setBuoc] = useState('dangKiem');
    const [lienKet, setLienKet] = useState(null);
    const [loi, setLoi] = useState({ ma: 'LIEN_KET_KHONG_HOP_LE', thongDiep: '' });
    const [matKhau, setMatKhau] = useState('');
    const [nhapLai, setNhapLai] = useState('');
    const [hien, setHien] = useState({ moi: false, nhapLai: false });
    const [loiO, setLoiO] = useState({});
    const [loiChung, setLoiChung] = useState('');
    const [dangGui, setDangGui] = useState(false);

    const baoLoiLienKet = (err) => {
        const l = loiLienKet(err);
        if (!l) return false;
        setLoi(l);
        setBuoc('loiLienKet');
        return true;
    };

    const kiemTra = useCallback(async () => {
        if (!maRef.current) {
            setLoi({ ma: 'LIEN_KET_KHONG_HOP_LE', thongDiep: t("Trang này cần mở từ nút Đặt mật khẩu trong email.") });
            setBuoc('loiLienKet');
            return;
        }
        setBuoc('dangKiem');
        try {
            const res = await nguoiDungService.kiemTraLienKetMatKhau(maRef.current);
            setLienKet(res?.data ?? null);
            setBuoc('nhap');
        } catch (err) {
            const l = loiLienKet(err);
            setLoi(l ?? { ma: null, thongDiep: getApiErrorMessage(err, t("Chưa kiểm tra được liên kết")) });
            setBuoc(l ? 'loiLienKet' : 'loiMang');
        }
    }, []);

    useEffect(() => {
        kiemTra();
    }, [kiemTra]);

    // Mở liên kết khác ngay trong tab đang ở /set-password: chỉ phần # đổi, trang không tải lại, nên đọc mã mới ở đây
    useEffect(() => {
        const doiMa = () => {
            if (!new URLSearchParams(window.location.hash.slice(1)).get('t')) return;
            maRef.current = layMa();
            setLienKet(null);
            setMatKhau('');
            setNhapLai('');
            setLoiO({});
            setLoiChung('');
            kiemTra();
        };
        window.addEventListener('hashchange', doiMa);
        return () => window.removeEventListener('hashchange', doiMa);
    }, [kiemTra]);

    // Rời trang (nút điều hướng, Back): bỏ mã khỏi tab để người dùng sau mở /set-password không dùng được.
    // Tải lại trang thì không chạy (giữ mã cho lần tải lại).
    useEffect(() => () => quenMa(), []);

    // Đổi màn: đưa con trỏ tới chỗ cần đọc / cần gõ (nút gửi vừa biến mất thì con trỏ không rơi về <body>)
    const tieuDeRef = useRef(null);
    useEffect(() => {
        if (buoc === 'nhap') document.getElementById('dat-mk-moi')?.focus();
        else if (buoc !== 'dangKiem') tieuDeRef.current?.focus();
    }, [buoc]);

    const kiemO = (k, mk = matKhau, nl = nhapLai) => {
        if (k === 'moi') {
            return kiemTraMatKhauMoi(mk, { tenDangNhap: lienKet?.tenDangNhap, email: lienKet?.email });
        }
        if (!nl) return t("Nhập lại mật khẩu mới.");
        return nl === mk ? '' : t("Chưa khớp với mật khẩu mới.");
    };

    const datMatKhau = async (e) => {
        e.preventDefault();
        if (dangGui) return;
        const ketQua = { moi: kiemO('moi'), nhapLai: kiemO('nhapLai') };
        setLoiO(ketQua);
        setLoiChung('');
        const oSai = ['moi', 'nhapLai'].find((k) => ketQua[k]);
        if (oSai) {
            document.getElementById(oSai === 'moi' ? 'dat-mk-moi' : 'dat-mk-nhap-lai')?.focus();
            return;
        }
        setDangGui(true);
        try {
            await nguoiDungService.datMatKhauQuaLienKet({ ma: maRef.current, matKhauMoi: matKhau });
            quenMa();
            setMatKhau('');
            setNhapLai('');
            setBuoc('xong');
        } catch (err) {
            if (!baoLoiLienKet(err)) setLoiChung(getApiErrorMessage(err, t("Không đặt được mật khẩu. Vui lòng thử lại.")));
        } finally {
            setDangGui(false);
        }
    };

    const veDangNhap = () => navigate('/login', { state: { tenDangNhap: lienKet?.tenDangNhap } });

    const oMatKhau = (k, id, nhan, giaTri, datGiaTri) => (
        <div className="space-y-2">
            <label htmlFor={id} className={LABEL}>{nhan}</label>
            <div className="relative">
                <input
                    id={id}
                    type={hien[k] ? 'text' : 'password'}
                    className={`${INPUT_BASE} ${loiO[k] ? INPUT_ERROR : INPUT_NORMAL} pr-10`}
                    value={giaTri}
                    onChange={(e) => {
                        datGiaTri(e.target.value);
                        setLoiChung('');
                        // đang có lỗi thì kiểm lại ngay để lỗi mất khi đã sửa đúng; sửa mật khẩu mới thì kiểm lại cả ô
                        // nhập lại đang báo lỗi
                        const mk = k === 'moi' ? e.target.value : matKhau;
                        const nl = k === 'nhapLai' ? e.target.value : nhapLai;
                        setLoiO((cu) => {
                            const moi = { ...cu };
                            if (cu[k]) moi[k] = kiemO(k, mk, nl);
                            if (k === 'moi' && cu.nhapLai && nl) moi.nhapLai = kiemO('nhapLai', mk, nl);
                            return moi;
                        });
                    }}
                    autoComplete="new-password"
                    spellCheck={false}
                    readOnly={dangGui}
                    aria-invalid={Boolean(loiO[k])}
                    aria-describedby={loiO[k] ? `${id}-loi` : undefined}
                />
                <button
                    type="button"
                    className={EYE_BTN}
                    onClick={() => setHien((cu) => ({ ...cu, [k]: !cu[k] }))}
                    aria-label={hien[k] ? t("Ẩn {{nhan}}", { nhan: nhan.toLowerCase() }) : t("Hiện {{nhan}}", { nhan: nhan.toLowerCase() })}
                    aria-pressed={hien[k]}
                >
                    {hien[k] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
            {loiO[k] ? (
                <p id={`${id}-loi`} className={FIELD_ERROR}>
                    <AlertCircle size={13} className="shrink-0" />{loiO[k]}
                </p>
            ) : k === 'moi' ? (
                <>
                    {GOI_Y_MAT_KHAU ? <p className={`${DONG_PHU} text-gray-500`}>{GOI_Y_MAT_KHAU}</p> : null}
                    {giaTri && giaTri !== giaTri.trim() ? (
                        <p className={`${DONG_PHU} text-orange-800`}>{t("Mật khẩu có dấu cách ở đầu hoặc cuối — sẽ được giữ nguyên.")}</p>
                    ) : null}
                </>
            ) : null}
        </div>
    );

    const taoTaiKhoan = lienKet?.mucDich === 'TAO_TAI_KHOAN';

    return (
        <AuthShell>
            {buoc === 'dangKiem' && (
                <div role="status" className="flex items-center gap-3 text-sm text-gray-600 fade-in-up">
                    <Loader2 size={18} className="animate-spin" /> {t("Đang kiểm tra liên kết…")}
                </div>
            )}

            {(buoc === 'loiLienKet' || buoc === 'loiMang') && (
                <div className="space-y-6 fade-in-up">
                    <div>
                        <h1 ref={tieuDeRef} tabIndex={-1} className="text-3xl font-bold tracking-tight mb-3 text-gray-900 outline-none">
                            {buoc === 'loiMang' ? t("Chưa kiểm tra được liên kết") : TIEU_DE_LOI[loi.ma]}
                        </h1>
                        <p className="text-gray-600 text-base">
                            {loi.thongDiep || t("Mở lại liên kết trong email mới nhất, hoặc dùng Quên mật khẩu.")}
                        </p>
                    </div>
                    <div className="space-y-3">
                        {buoc === 'loiMang' ? (
                            <button type="button" className={PRIMARY_BTN} onClick={kiemTra}>{t("Thử lại")}</button>
                        ) : loi.ma === 'LIEN_KET_DA_DUNG' ? (
                            <button type="button" className={PRIMARY_BTN} onClick={() => navigate('/login')}>{t("Đăng nhập")}</button>
                        ) : (
                            <button type="button" className={PRIMARY_BTN} onClick={() => navigate('/forgot-password')}>
                                {t("Quên mật khẩu")}
                            </button>
                        )}
                        <button
                            type="button"
                            className={SECONDARY_BTN}
                            onClick={() => navigate(loi.ma === 'LIEN_KET_DA_DUNG' ? '/forgot-password' : '/login')}
                        >
                            {loi.ma === 'LIEN_KET_DA_DUNG' ? t("Quên mật khẩu") : t("Về trang đăng nhập")}
                        </button>
                    </div>
                </div>
            )}

            {buoc === 'nhap' && (
                <>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight mb-3 text-gray-900 fade-in-up delay-1">
                            {taoTaiKhoan ? t("Đặt mật khẩu") : t("Đặt lại mật khẩu")}
                        </h1>
                        <p className="text-gray-500 text-base fade-in-up delay-2">
                            {taoTaiKhoan
                                ? t("Đặt mật khẩu để bắt đầu dùng tài khoản FCentric của bạn.")
                                : t("Đặt mật khẩu mới để đăng nhập lại.")}
                        </p>
                    </div>

                    <form className="space-y-5 fade-in-up delay-3" onSubmit={datMatKhau} noValidate>
                        {/* Tên đăng nhập ẩn: trình quản lý mật khẩu lưu mật khẩu mới cho đúng tài khoản */}
                        <input type="text" name="username" autoComplete="username" value={lienKet?.tenDangNhap || ''} readOnly hidden />

                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                            <dt className="text-gray-500">{t("Tên đăng nhập")}</dt>
                            <dd className="min-w-0 break-words font-medium text-gray-900">{lienKet?.tenDangNhap}</dd>
                            {lienKet?.hetHanLuc ? (
                                <>
                                    <dt className="text-gray-500">{t("Liên kết dùng đến")}</dt>
                                    <dd className="text-gray-900 tabular-nums">{formatDateTime(lienKet.hetHanLuc)}</dd>
                                </>
                            ) : null}
                        </dl>

                        {lienKet?.dangKhoa && (
                            <div className={INFO_BANNER} role="note">
                                <Info size={16} className="shrink-0 mt-0.5" />
                                <span>{t("Tài khoản đang tạm khóa: bạn vẫn đặt được mật khẩu, nhưng chỉ đăng nhập được sau khi quản trị viên mở khóa.")}</span>
                            </div>
                        )}

                        {oMatKhau('moi', 'dat-mk-moi', t("Mật khẩu mới"), matKhau, setMatKhau)}
                        {oMatKhau('nhapLai', 'dat-mk-nhap-lai', t("Nhập lại mật khẩu mới"), nhapLai, setNhapLai)}

                        {loiChung && (
                            <div className={ERROR_BANNER} role="alert">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>{loiChung}</span>
                            </div>
                        )}

                        <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={dangGui}>
                            {dangGui ? (
                                <><Loader2 size={16} className="animate-spin" /> {t("Đang đặt mật khẩu...")}</>
                            ) : (
                                t("Đặt mật khẩu")
                            )}
                        </button>
                    </form>
                </>
            )}

            {buoc === 'xong' && (
                <div className="text-center space-y-6 fade-in-up">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
                    <div>
                        <h1 ref={tieuDeRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 outline-none">{t("Đã đặt mật khẩu")}</h1>
                        <p className="mt-2 text-gray-600">
                            {lienKet?.dangKhoa
                                ? t("Bạn đăng nhập được sau khi quản trị viên mở khóa tài khoản.")
                                : t("Đăng nhập bằng tên đăng nhập {{tenDangNhap}} và mật khẩu vừa đặt.", { tenDangNhap: lienKet?.tenDangNhap ?? '' })}
                        </p>
                    </div>
                    <button type="button" className={PRIMARY_BTN} onClick={veDangNhap}>{t("Đăng nhập")}</button>
                </div>
            )}
        </AuthShell>
    );
}
