import { useImperativeHandle, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, ClipboardPaste, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SWITCH_CLASS } from '@/components/channel/SettingsCard';
import MoneyInput from '@/components/shared/MoneyInput';
import SearchInput from '@/components/shared/SearchInput';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { hienTien } from '@/pages/product/components/product/logicBienThe';
import HopDanGia from './HopDanGia';
import { idOGia, idOGiaNhom, idOGiaNhomThe, idOGiaThe, loiDonGia, thanhTienDong } from './baoGiaUtils';
import {
    LOI_KHONG_KHOP_MA,
    LOI_NHIEU_COT,
    apGiaNhom,
    apNoiDungDan,
    batMotGia,
    congTacBanDau,
    docGiaDan,
    giaChung,
    khoiPhucGia,
    nhomCanTatSauKhiDan,
    nhomKhopTuKhoa,
    noiTenNhom,
    phanTichNoiDungDan,
    tenLoaiPhanLoai,
    tenNhomChua,
    thuTuHienThi,
} from './nhomBaoGia';

// ── Bảng kiểu Excel: ô có viền, ô trắng nhập được, ô xám chỉ xem ──
const O = 'border border-bo-border';
const O_XAM = 'bg-bo-surface-subtle';
const TH = 'h-9 border border-bo-border px-2.5 text-[13px] leading-[18px] font-medium whitespace-nowrap text-bo-muted';
const TH_NHAP = 'font-semibold text-bo-foreground';
// Ô nhập nằm gọn trong ô bảng; scroll-mb để con trỏ không bị thanh "Gửi báo giá" dính đáy che mất
const O_NHAP_BANG =
    'w-full rounded-none border-0 bg-transparent px-2.5 scroll-mb-28 focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary';
const O_NHAP_BANG_LOI = 'bg-red-50 ring-2 ring-inset ring-bo-danger/60 focus-visible:ring-bo-danger';
const O_GIA_LOI_THE = 'border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15';
const NUT_PHU = 'border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle';

const tienHoacGach = (so) => (so > 0 ? formatCurrency(so) : '—');
const giaHoacGach = (gia) => (gia === '' || gia == null ? '—' : hienTien(gia));
const coLoi = (d) => Boolean(loiDonGia(d.donGia));

function NhanChuaCoGia() {
    return (
        <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-orange-200 bg-bo-warning-soft px-2 text-xs font-medium whitespace-nowrap text-bo-warning">
            Chưa có giá
        </span>
    );
}

function LoiGia({ id, children, className }) {
    if (!children) return null;
    return (
        <span id={id} className={cn('block text-xs leading-4 text-bo-danger', className)}>
            {children}
        </span>
    );
}

/** Khung đỏ sau khi bấm Gửi: còn bao nhiêu dòng (phân loại) chưa có giá, thuộc sản phẩm nào. */
function ThongBaoThieuGia({ soDong, donVi, tenNhom, className }) {
    if (!soDong) return null;
    return (
        <div role="alert" className={cn('flex items-start gap-2 border-red-200 bg-bo-danger-soft px-4 py-2.5 text-sm leading-5 text-bo-danger-strong', className)}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
                Còn {soDong} {donVi} chưa có đơn giá{tenNhom ? ` (${tenNhom})` : ''}.
            </span>
        </div>
    );
}

/**
 * Báo kết quả một thao tác (bật công tắc khi khác giá, dán giá), kèm Hoàn tác nếu có.
 * Trình đọc màn hình đọc nội dung qua vùng `role="status"` luôn có sẵn trong BangBaoGia (vùng mới gắn vào thường không được đọc).
 */
function ThongBaoThaoTac({ tb, onHoanTac, onDong, className }) {
    return (
        <div
            data-thong-bao=""
            className={cn(
                'flex items-start gap-2 px-4 py-2.5 text-[13px] leading-5',
                tb.loi ? 'border-orange-200 bg-bo-warning-soft text-bo-warning' : 'border-blue-200 bg-bo-primary-soft text-blue-700',
                className,
            )}
        >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">
                {tb.noiDung}
                {tb.hoanTac && (
                    <>
                        {' '}
                        <button type="button" onClick={onHoanTac} className="font-semibold underline underline-offset-2 hover:no-underline">
                            Hoàn tác
                        </button>
                    </>
                )}
            </span>
            <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={onDong}
                className="-my-2 -mr-2.5 flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 md:-my-1 md:-mr-2 md:size-7"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

/** Nút lọc "Tất cả / Chưa có giá" (đếm theo dòng gửi đi, hiện theo nhóm). */
function BoLoc({ dangLoc, tongDong, soThieu, onTatCa, onThieu, nutClassName }) {
    const nut = (chon) =>
        cn(
            'rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60',
            chon ? 'bg-white text-bo-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.08)]' : 'text-slate-600 hover:text-bo-foreground',
            nutClassName,
        );
    return (
        <div role="group" aria-label="Lọc dòng" className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-[3px]">
            <button type="button" aria-pressed={!dangLoc} onClick={onTatCa} className={nut(!dangLoc)}>
                Tất cả <span className="text-bo-muted tabular-nums">{tongDong}</span>
            </button>
            <button type="button" aria-pressed={dangLoc} disabled={!dangLoc && !soThieu} onClick={onThieu} className={nut(dangLoc)}>
                Chưa có giá <span className="text-bo-warning tabular-nums">{soThieu}</span>
            </button>
        </div>
    );
}

/**
 * Bảng đơn giá (PA3): lưới kiểu Excel gom theo sản phẩm, công tắc "Một giá cho cả nhóm", tìm kiếm,
 * lọc "Chưa có giá", Enter xuống ô kế tiếp, dán nhiều giá từ Excel. Dưới 768px: mỗi sản phẩm một thẻ.
 *
 * - `dong` giữ nguyên thứ tự orderData.chiTietDonMuaHangs (máy chủ ghép đơn giá theo id dòng). Gom nhóm chỉ để hiển thị;
 *   bật công tắc nghĩa là điền cùng một số vào donGia của từng dòng trong nhóm.
 * - Không có ghi chú theo dòng: nhà cung cấp ghi một ghi chú chung cho cả báo giá (ô ở trang, HOP-DONG 2.2).
 * - `nhom`: kết quả nhomTheoSanPham(dong), cố định suốt phiên (chỉ phụ thuộc sản phẩm, không phụ thuộc giá).
 * - `dongLoi`: vị trí các dòng bị báo thiếu giá sau khi bấm Gửi.
 * - `ref.denDongThieuGia(viTri)`: bỏ lọc, mở nhóm cần thiết rồi đặt con trỏ vào ô thiếu giá đầu tiên.
 */
export default function BangBaoGia({ ref, dong, nhom, tong, chiXem, dongLoi, onCapNhatDong }) {
    const coNhieuDong = nhom.some((n) => n.viTri.length > 1);
    const [motGia, setMotGia] = useState(() => congTacBanDau(dong, nhom));
    // Nhóm đang mở các dòng con. Lúc đầu: nhóm đang tắt công tắc thì mở (để nhập từng dòng), bật thì thu gọn.
    const [moNhom, setMoNhom] = useState(() => {
        const ct = congTacBanDau(dong, nhom);
        return new Set(nhom.filter((n) => n.viTri.length > 1 && !ct[n.khoa]).map((n) => n.khoa));
    });
    const [tuKhoa, setTuKhoa] = useState('');
    // null = Tất cả. Bấm "Chưa có giá": chụp danh sách nhóm đang thiếu để nhóm không biến mất khi vừa gõ xong.
    const [locThieu, setLocThieu] = useState(null);
    // { noiDung, khoa?: nhóm hiện thông báo ngay bên dưới, hoanTac?: { cu, motGia }, loi?: boolean }
    const [thongBao, setThongBao] = useState(null);
    const [hopDan, setHopDan] = useState(false);

    const dangBat = (n) => n.viTri.length > 1 && Boolean(motGia[n.khoa]);
    const nhomThieuGia = (n) => n.viTri.some((i) => coLoi(dong[i]));
    const soThieu = tong.soSanPham - tong.daNhapGia;
    const donVi = coNhieuDong ? 'phân loại' : 'sản phẩm';
    // Đơn mới chưa nhập gì: không gắn nhãn "Chưa có giá" khắp bảng; nhập được ít nhất một giá thì mới đánh dấu chỗ còn thiếu
    const hienNhanThieu = !chiXem && tong.daNhapGia > 0;

    const tapLoi = new Set(chiXem ? [] : dongLoi);
    const loiDong = (i) => (tapLoi.has(i) ? loiDonGia(dong[i].donGia) : null);
    const loiNhom = (n) => (n.viTri.some((i) => tapLoi.has(i)) ? loiDonGia(dong[n.viTri[0]].donGia) : null);
    const dongConLoi = dongLoi.filter((i) => dong[i] && coLoi(dong[i]));
    const soDongLoi = chiXem ? 0 : dongConLoi.length;
    const tenNhomLoi = noiTenNhom(tenNhomChua(nhom, dongConLoi));

    const nhomHien = nhom
        .map((n, g) => ({ n, g }))
        .filter(({ n }) => (!locThieu || locThieu.has(n.khoa)) && nhomKhopTuKhoa(n, dong, tuKhoa));
    const nhomNhieuDong = nhom.filter((n) => n.viTri.length > 1);
    const moHet = nhomNhieuDong.length > 0 && nhomNhieuDong.every((n) => moNhom.has(n.khoa));

    // ── Cập nhật giá ──
    const doiGiaDong = (i, gia) => {
        setThongBao(null);
        onCapNhatDong((cu) => cu.map((d, j) => (j === i ? { ...d, donGia: gia } : d)));
    };
    const doiGiaNhom = (n, gia) => {
        setThongBao(null);
        onCapNhatDong((cu) => apGiaNhom(cu, n.viTri, gia));
    };

    const moThemNhom = (khoa) => setMoNhom((s) => new Set([...s, ...khoa]));
    const doiMoNhom = (khoa) =>
        setMoNhom((s) => {
            const t = new Set(s);
            if (t.has(khoa)) t.delete(khoa);
            else t.add(khoa);
            return t;
        });

    const doiCongTac = (n, bat) => {
        const loai = tenLoaiPhanLoai(dong, n.viTri);
        if (!bat) {
            // Tắt: giá chung đã nằm sẵn ở từng dòng nên không mất gì; mở nhóm để sửa riêng
            setMotGia((m) => ({ ...m, [n.khoa]: false }));
            moThemNhom([n.khoa]);
            setThongBao(null);
            return;
        }
        const { dong: moi, thayDoi } = batMotGia(dong, n.viTri);
        onCapNhatDong(moi);
        setMotGia((m) => ({ ...m, [n.khoa]: true }));
        if (!thayDoi) {
            setThongBao(null);
            return;
        }
        const khac = thayDoi.cu.filter((c) => (c.gia === '' ? '' : Number(c.gia)) !== thayDoi.gia);
        const truocDo = khac
            .slice(0, 3)
            .map((c) => `${n.nhan[c.viTri]} ${c.gia === '' ? 'chưa có giá' : `là ${formatCurrency(c.gia)}`}`)
            .join(', ');
        const conLai = khac.length > 3 ? ` và ${khac.length - 3} ${loai} khác` : '';
        setThongBao({
            khoa: n.khoa,
            noiDung: (
                <>
                    Đã dùng chung <strong className="font-semibold">{formatCurrency(thayDoi.gia)}</strong> cho cả {n.viTri.length} {loai}. Trước đó{' '}
                    {truocDo}
                    {conLai}.
                </>
            ),
            hoanTac: { cu: thayDoi.cu, motGia: { [n.khoa]: false } },
        });
    };

    /** Đặt con trỏ lại vào ô giá của dòng i (ô riêng hoặc ô giá chung của nhóm; bảng hay thẻ tùy màn) nếu tiêu điểm vừa bị mất. */
    const datConTro = (i) => {
        const g = nhom.findIndex((n) => n.viTri.includes(i));
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                if (document.activeElement && document.activeElement !== document.body) return;
                const o = [idOGia(i), idOGiaThe(i), idOGiaNhom(g), idOGiaNhomThe(g)]
                    .map((id) => document.getElementById(id))
                    .find((el) => el && el.offsetParent !== null);
                o?.focus();
            }),
        );
    };

    const hoanTac = () => {
        const h = thongBao?.hoanTac;
        if (!h || chiXem) return;
        onCapNhatDong((cu) => khoiPhucGia(cu, h.cu));
        setMotGia((m) => ({ ...m, ...h.motGia }));
        setThongBao({ khoa: thongBao.khoa, noiDung: 'Đã hoàn tác.' });
        // Nút Hoàn tác biến mất sau khi bấm: đưa con trỏ về ô giá vừa khôi phục
        if (h.cu.length) datConTro(h.cu[0].viTri);
    };

    /**
     * Dán nhiều giá. Một cột: điền lần lượt theo thứ tự dòng đang hiện, bắt đầu ở `batDau` (mặc định dòng đầu).
     * Hai cột Mã SKU + Đơn giá: ghép theo mã. Nhóm đang bật mà giá dán vào khác nhau thì tự tắt và báo, kèm Hoàn tác.
     * @returns {boolean} đã điền được ít nhất một giá
     */
    const apDan = (phanTich, batDau, khoa) => {
        if (chiXem) return false;
        if (phanTich.cheDo === 'nhieu-cot') {
            setThongBao({ khoa, loi: true, noiDung: LOI_NHIEU_COT });
            return false;
        }
        const thuTu = thuTuHienThi(nhomHien.map((x) => x.n));
        const kq = apNoiDungDan(dong, phanTich, thuTu, batDau ?? thuTu[0]);
        if (!kq.daDien.length) {
            setThongBao({
                khoa,
                loi: true,
                noiDung: phanTich.coMaLa ? LOI_KHONG_KHOP_MA : 'Không đọc được đơn giá nào trong nội dung vừa dán. Kiểm tra lại cột giá trong Excel.',
            });
            return false;
        }
        const canTat = nhomCanTatSauKhiDan(kq.dong, nhom, motGia);
        const cu = kq.daDien.map((i) => ({ viTri: i, gia: dong[i].donGia }));
        onCapNhatDong(kq.dong);
        if (canTat.length) {
            setMotGia((m) => ({ ...m, ...Object.fromEntries(canTat.map((k) => [k, false])) }));
            moThemNhom(canTat);
        }
        const tenTat = nhom.filter((n) => canTat.includes(n.khoa)).map((n) => n.tenSanPham);
        setThongBao({
            khoa,
            noiDung: (
                <>
                    Đã dán {kq.daDien.length} đơn giá từ Excel.
                    {tenTat.length > 0 && (
                        <>
                            {' '}
                            <strong className="font-semibold">{noiTenNhom(tenTat, 3)}</strong> có giá khác nhau giữa các phân loại nên đã chuyển sang nhập
                            từng phân loại.
                        </>
                    )}
                    {kq.boQua > 0 && ` ${kq.boQua} dòng không đọc được hoặc không khớp mã nên bỏ qua.`}
                    {kq.thua > 0 && ` ${kq.thua} giá dư so với số dòng trong bảng nên không dùng.`}
                </>
            ),
            hoanTac: { cu, motGia: Object.fromEntries(canTat.map((k) => [k, true])) },
        });
        // Dán vào ô giá chung làm nhóm tự tắt thì ô đó biến mất: đưa con trỏ về ô của dòng bắt đầu dán
        if (batDau != null) datConTro(batDau);
        return true;
    };

    // ── Bàn phím và dán trong ô giá ──
    const diChuyen = (e) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
        e.preventDefault();
        const khung = e.currentTarget.closest('[data-khung-gia]');
        const cacO = khung ? [...khung.querySelectorAll('[data-o-gia]')] : [];
        const tiep = cacO[cacO.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)];
        if (tiep) {
            tiep.focus();
            tiep.select();
        } else {
            xemLaiBoLoc();
        }
    };
    const xuLyDan = (e, batDau, n) => {
        const van = e.clipboardData?.getData('text/plain') ?? '';
        if (/[\r\n\t]/.test(van.trim())) {
            e.preventDefault();
            apDan(phanTichNoiDungDan(van, dong), batDau, n.khoa);
            return;
        }
        // Một ô: đọc đúng kiểu "1,250,000.00" / "185.000 ₫" (ô tiền thường chỉ lấy chữ số nên sẽ đọc sai phần lẻ).
        // Chỉ thay cả ô khi ô trống hoặc đang chọn hết; dán chèn giữa số thì để ô tiền xử lý như gõ.
        const o = e.currentTarget;
        if (o.value && !(o.selectionStart === 0 && o.selectionEnd === o.value.length)) return;
        const gia = docGiaDan(van);
        if (gia === null) return;
        e.preventDefault();
        if (dangBat(n)) doiGiaNhom(n, gia);
        else doiGiaDong(batDau, gia);
    };
    // Lọc "Chưa có giá": nhập đủ các nhóm đang lọc rồi rời bảng thì tự về "Tất cả"
    const xemLaiBoLoc = () => {
        if (locThieu && nhom.every((n) => !locThieu.has(n.khoa) || !nhomThieuGia(n))) setLocThieu(null);
    };
    const roiKhung = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) xemLaiBoLoc();
    };
    /** Thuộc tính chung của mọi ô giá: Enter đi tiếp, dán nhiều dòng. */
    const oGia = (batDau, n) => ({
        'data-o-gia': '',
        enterKeyHint: 'next',
        placeholder: 'Nhập giá',
        onKeyDown: diChuyen,
        onPaste: (e) => xuLyDan(e, batDau, n),
    });

    const locChuaCoGia = () => setLocThieu(new Set(nhom.filter(nhomThieuGia).map((n) => n.khoa)));
    const boLocVaTim = () => {
        setLocThieu(null);
        setTuKhoa('');
    };

    useImperativeHandle(
        ref,
        () => ({
            denDongThieuGia(viTri) {
                const tap = new Set(viTri);
                setTuKhoa('');
                setLocThieu(null);
                // Nhóm đang tắt công tắc: báo lỗi ở từng dòng nên phải mở nhóm; nhóm đang bật: lỗi ở ô giá chung
                moThemNhom(nhom.filter((n) => n.viTri.length > 1 && !motGia[n.khoa] && n.viTri.some((i) => tap.has(i))).map((n) => n.khoa));
                const g = nhom.findIndex((n) => n.viTri.some((i) => tap.has(i)));
                if (g < 0) return;
                const n = nhom[g];
                const ids =
                    n.viTri.length > 1 && motGia[n.khoa]
                        ? [idOGiaNhom(g), idOGiaNhomThe(g)]
                        : [idOGia(n.viTri.find((i) => tap.has(i))), idOGiaThe(n.viTri.find((i) => tap.has(i)))];
                // Đợi bảng vẽ lại (bỏ lọc, mở nhóm) rồi mới tìm ô đang hiện (bảng hoặc thẻ tùy bề rộng màn)
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                        const o = ids.map((id) => document.getElementById(id)).find((el) => el && el.offsetParent !== null);
                        o?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        o?.focus({ preventScroll: true });
                    }),
                );
            },
        }),
        [nhom, motGia],
    );

    if (dong.length === 0) {
        return (
            <section className="rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                <p className="m-0 px-5 py-10 text-center text-sm text-bo-muted">Đơn mua hàng chưa có sản phẩm nào.</p>
            </section>
        );
    }

    const tongNhom = (n) => ({
        soLuong: n.viTri.reduce((s, i) => s + dong[i].soLuongDat, 0),
        tien: n.viTri.reduce((s, i) => s + thanhTienDong(dong[i]), 0),
    });

    // Đã gửi (chỉ xem) thì bỏ thông báo thao tác cũ, kể cả nút Hoàn tác
    const thongBaoHien = chiXem ? null : thongBao;
    const thongBaoTren = thongBaoHien && !thongBaoHien.khoa;
    const nutDongThongBao = { onHoanTac: hoanTac, onDong: () => setThongBao(null) };

    const khongCoKetQua = nhomHien.length === 0 && (
        <span>
            {tuKhoa.trim() ? `Không tìm thấy sản phẩm khớp “${tuKhoa.trim()}”.` : 'Các sản phẩm đang lọc đã có đơn giá.'}{' '}
            <button type="button" onClick={boLocVaTim} className="font-medium text-bo-primary hover:underline">
                Xem tất cả
            </button>
        </span>
    );

    // ── Từ 768px: bảng ──
    const coCotMo = coNhieuDong;
    const coCotCongTac = coNhieuDong && !chiXem;
    const soCot = 5 + (coCotMo ? 1 : 0) + (coCotCongTac ? 1 : 0);

    const bang = (
        <section aria-labelledby="bg-bang-tieu-de" data-khung-gia onBlur={roiKhung} className="hidden overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm md:block">
            <h2 id="bg-bang-tieu-de" className="sr-only">Bảng đơn giá</h2>
            <div className="flex flex-wrap items-center gap-3 border-b border-bo-border px-4 py-3">
                <SearchInput
                    value={tuKhoa}
                    onChange={(e) => setTuKhoa(e.target.value)}
                    onClear={() => setTuKhoa('')}
                    label="Tìm sản phẩm"
                    placeholder="Tìm theo tên hoặc mã SKU"
                    className="w-[280px] sm:max-w-none"
                />
                {!chiXem && (
                    <BoLoc
                        dangLoc={Boolean(locThieu)}
                        tongDong={tong.soSanPham}
                        soThieu={soThieu}
                        onTatCa={() => setLocThieu(null)}
                        onThieu={locChuaCoGia}
                        nutClassName="h-[30px]"
                    />
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                    {coNhieuDong && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMoNhom(moHet ? new Set() : new Set(nhomNhieuDong.map((n) => n.khoa)))}
                            className={NUT_PHU}
                        >
                            {moHet ? <ChevronsDownUp aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" />}
                            {moHet ? 'Thu gọn hết' : 'Mở hết nhóm'}
                        </Button>
                    )}
                    {!chiXem && (
                        <Button type="button" variant="outline" onClick={() => setHopDan(true)} className={NUT_PHU}>
                            <ClipboardPaste aria-hidden="true" />
                            Dán giá từ Excel
                        </Button>
                    )}
                </div>
            </div>
            {!chiXem && (
                <p className="m-0 border-b border-bo-border bg-bo-surface-subtle px-4 py-2 text-[13px] leading-5 text-slate-600">
                    {coNhieuDong && (
                        <>
                            Bật <strong className="font-semibold">Một giá cho cả nhóm</strong> để nhập một lần cho mọi phân loại của sản phẩm.{' '}
                        </>
                    )}
                    Ô trắng nhập được, ô xám chỉ xem. <strong className="font-semibold">Enter</strong> xuống ô kế tiếp. Dán được cả
                    cột giá chép từ Excel.
                </p>
            )}
            <ThongBaoThieuGia soDong={soDongLoi} donVi={donVi} tenNhom={tenNhomLoi} className="border-b" />
            {thongBaoTren && <ThongBaoThaoTac tb={thongBaoHien} {...nutDongThongBao} className="border-b" />}

            <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[970px] border-collapse text-[13px] leading-[18px]">
                    <thead>
                        <tr className="bg-bo-surface-subtle">
                            {coCotMo && (
                                <th scope="col" className={cn(TH, 'w-11 border-l-0 p-0')}>
                                    <span className="sr-only">Mở hoặc thu gọn</span>
                                </th>
                            )}
                            <th scope="col" className={cn(TH, 'text-left', !coCotMo && 'border-l-0 pl-4')}>Sản phẩm / phân loại</th>
                            <th scope="col" className={cn(TH, 'w-[220px] text-left')}>Mã SKU</th>
                            <th scope="col" className={cn(TH, 'w-[76px] text-right')}>SL</th>
                            {coCotCongTac && <th scope="col" className={cn(TH, TH_NHAP, 'w-32 text-center')}>Một giá cho cả nhóm</th>}
                            <th scope="col" className={cn(TH, !chiXem && TH_NHAP, 'w-[150px] text-right')}>Đơn giá (₫)</th>
                            <th scope="col" className={cn(TH, 'w-[140px] border-r-0 text-right')}>Thành tiền</th>
                        </tr>
                    </thead>

                    {nhomHien.map(({ n, g }) => {
                        const nhieu = n.viTri.length > 1;
                        const bat = dangBat(n);
                        const mo = nhieu && moNhom.has(n.khoa);
                        const loai = tenLoaiPhanLoai(dong, n.viTri);
                        const t = tongNhom(n);
                        const i0 = n.viTri[0];
                        const d0 = dong[i0];
                        const gc = giaChung(dong, n.viTri);
                        const loiChung = bat ? loiNhom(n) : null;
                        const loiMot = !nhieu ? loiDong(i0) : null;
                        const loiO = loiChung || loiMot;
                        const idO = nhieu ? idOGiaNhom(g) : idOGia(i0);

                        let oGiaDau;
                        if (chiXem) {
                            oGiaDau = (
                                <td className={cn(O, 'px-2.5 text-right font-semibold tabular-nums')}>
                                    {!nhieu || gc !== null ? giaHoacGach(nhieu ? gc : d0.donGia) : <span className="font-normal text-bo-muted">Theo từng {loai}</span>}
                                </td>
                            );
                        } else if (nhieu && !bat) {
                            oGiaDau = <td className={cn(O, 'px-2.5 text-right text-bo-muted')}>Theo từng {loai}</td>;
                        } else {
                            oGiaDau = (
                                <td className={cn(O, 'bg-bo-surface p-0')}>
                                    <MoneyInput
                                        id={idO}
                                        aria-label={nhieu ? `Đơn giá chung ${n.tenSanPham}` : `Đơn giá ${n.tenSanPham}${d0.thuocTinh ? ` ${d0.thuocTinh}` : ''}`}
                                        aria-invalid={Boolean(loiO)}
                                        aria-describedby={loiO ? `${idO}-loi` : undefined}
                                        value={nhieu ? gc ?? '' : d0.donGia}
                                        onChange={(gia) => (nhieu ? doiGiaNhom(n, gia) : doiGiaDong(i0, gia))}
                                        {...oGia(i0, n)}
                                        className={cn(O_NHAP_BANG, 'h-[43px] text-sm font-semibold', loiO && O_NHAP_BANG_LOI)}
                                    />
                                    <LoiGia id={`${idO}-loi`} className="px-2.5 pt-0.5 pb-1.5 text-right">{loiO}</LoiGia>
                                </td>
                            );
                        }

                        return (
                            <tbody key={n.khoa}>
                                <tr className="bg-slate-100">
                                    {coCotMo && (
                                        <td className={cn(O, 'h-11 border-l-0 p-0 text-center')}>
                                            {nhieu && (
                                                <button
                                                    type="button"
                                                    aria-expanded={mo}
                                                    aria-label={mo ? `Thu gọn ${n.tenSanPham}` : `Mở ${n.viTri.length} ${loai} của ${n.tenSanPham}`}
                                                    onClick={() => doiMoNhom(n.khoa)}
                                                    className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-bo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                                                >
                                                    {mo ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                                                </button>
                                            )}
                                        </td>
                                    )}
                                    <th scope={nhieu ? 'rowgroup' : 'row'} className={cn(O, 'h-11 px-2.5 py-2 text-left text-sm leading-5 font-semibold', !coCotMo && 'border-l-0 pl-4')}>
                                        <span className="mr-1.5">{n.tenSanPham}</span>
                                        <span className="font-normal text-bo-muted">
                                            {nhieu
                                                ? [n.thuocTinhChung, `${n.viTri.length} ${loai}`].filter(Boolean).map((x) => `· ${x}`).join(' ')
                                                : d0.thuocTinh && `· ${d0.thuocTinh}`}
                                        </span>
                                        {hienNhanThieu && nhomThieuGia(n) && (
                                            <span className="ml-2 inline-block align-middle">
                                                <NhanChuaCoGia />
                                            </span>
                                        )}
                                    </th>
                                    <td className={cn(O, 'px-2.5', nhieu ? 'text-slate-400' : 'break-all text-slate-600')}>
                                        {nhieu ? `${n.viTri.length} mã` : d0.maSku || '—'}
                                    </td>
                                    <td className={cn(O, 'px-2.5 text-right font-semibold tabular-nums')}>{t.soLuong.toLocaleString('vi-VN')}</td>
                                    {coCotCongTac && (
                                        <td className={cn(O, 'p-0 text-center')}>
                                            {nhieu && (
                                                <Switch
                                                    checked={bat}
                                                    onCheckedChange={(v) => doiCongTac(n, v)}
                                                    aria-label={`Một giá cho cả nhóm ${n.tenSanPham}`}
                                                    className={cn(SWITCH_CLASS, 'align-middle')}
                                                />
                                            )}
                                        </td>
                                    )}
                                    {oGiaDau}
                                    <td className={cn(O, 'border-r-0 px-2.5 text-right font-semibold tabular-nums')}>
                                        {t.tien > 0 ? formatCurrency(t.tien) : <span className="font-normal text-slate-400">—</span>}
                                    </td>
                                </tr>

                                {mo &&
                                    n.viTri.map((i) => {
                                        const d = dong[i];
                                        const loi = !bat ? loiDong(i) : null;
                                        return (
                                            <tr key={d.id ?? i}>
                                                {coCotMo && <td className={cn(O, O_XAM, 'border-l-0')} />}
                                                <td className={cn(O, O_XAM, 'h-[38px] py-2 pr-2.5 pl-7')}>{n.nhan[i]}</td>
                                                <td className={cn(O, O_XAM, 'px-2.5 break-all text-slate-600')}>{d.maSku || '—'}</td>
                                                <td className={cn(O, O_XAM, 'px-2.5 text-right tabular-nums')}>{d.soLuongDat.toLocaleString('vi-VN')}</td>
                                                {coCotCongTac && <td className={cn(O, O_XAM)} />}
                                                {chiXem || bat ? (
                                                    <td className={cn(O, O_XAM, 'px-2.5 text-right tabular-nums', bat ? 'text-slate-400' : '')}>
                                                        {bat && d.donGia === '' ? 'Theo nhóm' : giaHoacGach(d.donGia)}
                                                    </td>
                                                ) : (
                                                    <td className={cn(O, 'bg-bo-surface p-0')}>
                                                        <MoneyInput
                                                            id={idOGia(i)}
                                                            aria-label={`Đơn giá ${n.tenSanPham} ${n.nhan[i]}`}
                                                            aria-invalid={Boolean(loi)}
                                                            aria-describedby={loi ? `${idOGia(i)}-loi` : undefined}
                                                            value={d.donGia}
                                                            onChange={(gia) => doiGiaDong(i, gia)}
                                                            {...oGia(i, n)}
                                                            className={cn(O_NHAP_BANG, 'h-[37px] text-[13px]', loi && O_NHAP_BANG_LOI)}
                                                        />
                                                        <LoiGia id={`${idOGia(i)}-loi`} className="px-2.5 pt-0.5 pb-1.5 text-right">{loi}</LoiGia>
                                                    </td>
                                                )}
                                                <td className={cn(O, O_XAM, 'border-r-0 px-2.5 text-right tabular-nums')}>
                                                    {thanhTienDong(d) > 0 ? formatCurrency(thanhTienDong(d)) : <span className="text-slate-400">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                {thongBaoHien?.khoa === n.khoa && (
                                    <tr>
                                        <td colSpan={soCot} className="border-b border-bo-border p-0">
                                            <ThongBaoThaoTac tb={thongBaoHien} {...nutDongThongBao} />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        );
                    })}

                    {khongCoKetQua && (
                        <tbody>
                            <tr>
                                <td colSpan={soCot} className="px-4 py-10 text-center text-sm text-bo-muted">{khongCoKetQua}</td>
                            </tr>
                        </tbody>
                    )}

                    <tfoot>
                        <tr className="bg-bo-surface-subtle">
                            <td colSpan={coCotMo ? 3 : 2} className="h-10 border-t border-bo-border py-2 pr-2.5 pl-4 text-sm font-semibold">
                                Tổng cộng · {nhom.length} sản phẩm{coNhieuDong ? `, ${tong.soSanPham} phân loại` : ''}
                            </td>
                            <td className="border-t border-bo-border px-2.5 text-right font-semibold tabular-nums">{tong.tongSoLuong.toLocaleString('vi-VN')}</td>
                            {coCotCongTac && <td className="border-t border-bo-border" />}
                            <td className="border-t border-bo-border" />
                            <td className="border-t border-bo-border px-2.5 text-right text-sm font-bold tabular-nums">{tienHoacGach(tong.tongTien)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );

    // ── Dưới 768px: mỗi sản phẩm một thẻ ──
    const theNhom = ({ n, g }) => {
        const nhieu = n.viTri.length > 1;
        const bat = dangBat(n);
        const mo = moNhom.has(n.khoa);
        const loai = tenLoaiPhanLoai(dong, n.viTri);
        const t = tongNhom(n);
        const i0 = n.viTri[0];
        const d0 = dong[i0];
        const gc = giaChung(dong, n.viTri);
        // Một ô giá cho cả thẻ: sản phẩm một dòng, nhóm đang bật, hoặc (chỉ xem) mọi dòng cùng giá
        const motO = !nhieu || (chiXem ? gc !== null : bat);
        const loiO = !nhieu ? loiDong(i0) : bat ? loiNhom(n) : null;
        const idO = nhieu ? idOGiaNhomThe(g) : idOGiaThe(i0);
        const coLoiThe = Boolean(loiO) || n.viTri.some((i) => !bat && loiDong(i));
        const moTa = nhieu
            ? [n.thuocTinhChung, `${n.viTri.length} ${loai}`, `SL ${t.soLuong.toLocaleString('vi-VN')}`]
            : [d0.thuocTinh, d0.maSku, `SL ${d0.soLuongDat.toLocaleString('vi-VN')}`];
        const cungSoLuong = n.viTri.every((i) => dong[i].soLuongDat === d0.soLuongDat);
        const tomTatDong = cungSoLuong
            ? `${n.viTri.map((i) => n.nhan[i]).join(' · ')}, mỗi ${loai === 'kích cỡ' ? 'cỡ' : 'loại'} SL ${d0.soLuongDat.toLocaleString('vi-VN')}`
            : n.viTri.map((i) => `${n.nhan[i]} × ${dong[i].soLuongDat.toLocaleString('vi-VN')}`).join(' · ');

        const thanhTien = (
            <div className="flex flex-col items-end gap-1">
                <span className="text-xs leading-[18px] text-bo-muted">Thành tiền</span>
                <span className="text-[15px] leading-[22px] font-semibold tabular-nums">{tienHoacGach(t.tien)}</span>
            </div>
        );

        return (
            <article
                key={n.khoa}
                aria-labelledby={`bg-the-nhom-${g}`}
                className={cn('flex flex-col gap-3 rounded-lg border border-bo-border bg-bo-surface px-4 py-3.5', coLoiThe && 'border-red-200 bg-[#fffafa]')}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 id={`bg-the-nhom-${g}`} className="m-0 text-[15px] leading-[22px] font-semibold break-words">{n.tenSanPham}</h3>
                        <p className="m-0 text-[13px] leading-[18px] break-words text-bo-muted">{moTa.filter(Boolean).join(' · ')}</p>
                    </div>
                    {hienNhanThieu && nhomThieuGia(n) && <NhanChuaCoGia />}
                </div>

                {nhieu && !chiXem && (
                    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-bo-surface-subtle px-3">
                        <label htmlFor={`bg-cong-tac-the-${g}`} className="flex-1 py-2.5 text-sm font-medium">Một giá cho cả nhóm</label>
                        <Switch id={`bg-cong-tac-the-${g}`} checked={bat} onCheckedChange={(v) => doiCongTac(n, v)} className={SWITCH_CLASS} />
                    </div>
                )}

                {motO ? (
                    <>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                            {chiXem ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs leading-[18px] text-bo-muted">Đơn giá (₫){nhieu ? ` · cả ${n.viTri.length} ${loai}` : ''}</span>
                                    <span className="text-[15px] leading-[22px] tabular-nums">{giaHoacGach(nhieu ? gc : d0.donGia)}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    <label htmlFor={idO} className="text-xs leading-[18px] text-bo-muted">
                                        Đơn giá (₫){nhieu ? ` · cả ${n.viTri.length} ${loai}` : ''}
                                        <span className="sr-only"> {n.tenSanPham}</span>
                                    </label>
                                    <MoneyInput
                                        id={idO}
                                        aria-invalid={Boolean(loiO)}
                                        aria-describedby={loiO ? `${idO}-loi` : undefined}
                                        value={nhieu ? gc ?? '' : d0.donGia}
                                        onChange={(gia) => (nhieu ? doiGiaNhom(n, gia) : doiGiaDong(i0, gia))}
                                        {...oGia(i0, n)}
                                        className={cn('h-11 scroll-mb-36 px-3 text-base', loiO && O_GIA_LOI_THE)}
                                    />
                                </div>
                            )}
                            <div className={cn(!chiXem && 'pb-2.5')}>{thanhTien}</div>
                        </div>
                        <LoiGia id={`${idO}-loi`} className="-mt-1.5">{loiO}</LoiGia>

                        {nhieu ? (
                            <>
                                <button
                                    type="button"
                                    aria-expanded={mo}
                                    onClick={() => doiMoNhom(n.khoa)}
                                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-bo-border px-3 py-2 text-left text-[13px] leading-[18px] text-slate-600"
                                >
                                    <span className="min-w-0 break-words">{tomTatDong}</span>
                                    {mo ? <ChevronUp className="size-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="size-4 shrink-0" aria-hidden="true" />}
                                </button>
                                {mo && (
                                    <ul className="m-0 flex list-none flex-col divide-y divide-bo-border border-y border-bo-border p-0">
                                        {n.viTri.map((i) => (
                                            <li key={dong[i].id ?? i} className="flex flex-col gap-1.5 py-2.5">
                                                <div className="flex items-baseline justify-between gap-3 text-sm leading-5">
                                                    <span className="min-w-0">
                                                        <span className="font-medium">{n.nhan[i]}</span>{' '}
                                                        <span className="text-bo-muted">× {dong[i].soLuongDat.toLocaleString('vi-VN')}</span>
                                                    </span>
                                                    <span className="shrink-0 text-bo-muted tabular-nums">{giaHoacGach(dong[i].donGia)}</span>
                                                </div>
                                                {dong[i].maSku && <span className="text-xs leading-4 break-all text-bo-muted">{dong[i].maSku}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        ) : null}
                    </>
                ) : (
                    <>
                        <ul className="m-0 flex list-none flex-col divide-y divide-bo-border border-y border-bo-border p-0">
                            {n.viTri.map((i) => {
                                const d = dong[i];
                                const loi = loiDong(i);
                                return (
                                    <li key={d.id ?? i} className="flex flex-col gap-1.5 py-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 flex-col">
                                                <span className="text-sm leading-5">
                                                    <span className="font-medium">{n.nhan[i]}</span>{' '}
                                                    <span className="text-bo-muted">× {d.soLuongDat.toLocaleString('vi-VN')}</span>
                                                </span>
                                                {d.maSku && <span className="text-xs leading-4 break-all text-bo-muted">{d.maSku}</span>}
                                            </div>
                                            {chiXem ? (
                                                <span className="shrink-0 text-[15px] tabular-nums">{giaHoacGach(d.donGia)}</span>
                                            ) : (
                                                <MoneyInput
                                                    id={idOGiaThe(i)}
                                                    aria-label={`Đơn giá ${n.tenSanPham} ${n.nhan[i]}`}
                                                    aria-invalid={Boolean(loi)}
                                                    aria-describedby={loi ? `${idOGiaThe(i)}-loi` : undefined}
                                                    value={d.donGia}
                                                    onChange={(gia) => doiGiaDong(i, gia)}
                                                    {...oGia(i, n)}
                                                    className={cn('h-11 w-[124px] shrink-0 scroll-mb-36 px-3 text-base min-[360px]:w-[140px]', loi && O_GIA_LOI_THE)}
                                                />
                                            )}
                                        </div>
                                        <LoiGia id={`${idOGiaThe(i)}-loi`} className="text-right">{loi}</LoiGia>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] leading-5 text-bo-muted">Thành tiền</span>
                            <span className="text-[15px] leading-[22px] font-semibold tabular-nums">{tienHoacGach(t.tien)}</span>
                        </div>
                    </>
                )}

                {thongBaoHien?.khoa === n.khoa && <ThongBaoThaoTac tb={thongBaoHien} {...nutDongThongBao} className="-mx-4 -mb-3.5 rounded-b-lg border-t" />}
            </article>
        );
    };

    const the = (
        <section aria-labelledby="bg-the-tieu-de" data-khung-gia onBlur={roiKhung} className="flex flex-col gap-3 md:hidden">
            <h2 id="bg-the-tieu-de" className="sr-only">Bảng đơn giá</h2>
            {!chiXem && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <BoLoc
                        dangLoc={Boolean(locThieu)}
                        tongDong={tong.soSanPham}
                        soThieu={soThieu}
                        onTatCa={() => setLocThieu(null)}
                        onThieu={locChuaCoGia}
                        nutClassName="h-9"
                    />
                    <span className="text-[13px] leading-5 text-slate-600">
                        Đã có giá {tong.daNhapGia}/{tong.soSanPham}
                    </span>
                </div>
            )}
            {tuKhoa.trim() && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-bo-border bg-bo-surface py-0.5 pr-1 pl-3 text-[13px] leading-5 text-slate-600">
                    <span className="min-w-0 break-words">Đang tìm “{tuKhoa.trim()}”</span>
                    <button type="button" onClick={() => setTuKhoa('')} className="h-9 shrink-0 rounded-md px-2 font-medium text-bo-primary hover:underline">
                        Xóa tìm kiếm
                    </button>
                </div>
            )}
            <ThongBaoThieuGia soDong={soDongLoi} donVi={donVi} tenNhom={tenNhomLoi} className="rounded-lg border" />
            {thongBaoTren && <ThongBaoThaoTac tb={thongBaoHien} {...nutDongThongBao} className="rounded-lg border" />}
            {nhomHien.map(theNhom)}
            {khongCoKetQua && <p className="m-0 rounded-lg border border-bo-border bg-bo-surface px-4 py-8 text-center text-sm text-bo-muted">{khongCoKetQua}</p>}
        </section>
    );

    return (
        <>
            {bang}
            {the}
            <div role="status" className="sr-only">{thongBaoHien?.noiDung}</div>
            {!chiXem && (
                <HopDanGia
                    mo={hopDan}
                    dong={dong}
                    soDongHien={thuTuHienThi(nhomHien.map((x) => x.n)).length}
                    dangLoc={Boolean(locThieu) || Boolean(tuKhoa.trim())}
                    onDong={() => setHopDan(false)}
                    onApDung={(phanTich) => apDan(phanTich)}
                />
            )}
        </>
    );
}
