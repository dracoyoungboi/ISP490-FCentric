import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import { CAU_PHIEN_HET_HAN } from './loiCong';
import { DUONG_DAN_CONG, diaChiDangNhap, docPhien, phienDaHetHan, xoaPhien } from './phienCong';
import { demViec } from './congUtils';
import { t } from '@/i18n';

/* ── Số việc trên tab "Cần xử lý": dùng chung giữa các trang của cổng trong một lần tải trang ── */
let soViec;
let dangTaiSoViec = null;
const nguoiNghe = new Set();
const baoDoi = () => nguoiNghe.forEach((f) => f());

export function datSoViec(so) {
    soViec = so;
    baoDoi();
}

/** Tải lại số việc (sau khi xác nhận biên bản, gửi báo giá). Lỗi thì giữ số cũ, không báo. */
export function taiLaiSoViec() {
    if (!dangTaiSoViec) {
        dangTaiSoViec = congNhaCungCapService
            .viecCanLam()
            .then((viec) => datSoViec(demViec(viec)))
            .catch(() => {})
            .finally(() => {
                dangTaiSoViec = null;
            });
    }
    return dangTaiSoViec;
}

export function useSoViec() {
    return useSyncExternalStore(
        (f) => {
            nguoiNghe.add(f);
            return () => nguoiNghe.delete(f);
        },
        () => soViec,
    );
}

/** Tiêu đề thẻ trình duyệt: "<trang> · Cổng nhà cung cấp". */
export function useTieuDeCong(tieuDe) {
    useEffect(() => {
        const cu = document.title;
        document.title = tieuDe ? `${tieuDe} · ${t("Cổng nhà cung cấp")}` : t("Cổng nhà cung cấp");
        return () => {
            document.title = cu;
        };
    }, [tieuDe]);
}

/**
 * Phiên cổng cho các trang sau đăng nhập. Chưa đăng nhập / phiên đã quá hạn thì về trang nhận mã, giữ trang đang xem
 * để quay lại (`?tiep=`). Trả `phien` (null trong lúc đang chuyển trang: trang không vẽ gì), `hetPhien()` (gọi khi
 * máy chủ báo PHIEN_HET_HAN) và `thoat()` (nút Thoát).
 */
export function useCongNcc() {
    const navigate = useNavigate();
    const [phien] = useState(() => docPhien());
    const conHieuLuc = Boolean(phien) && !phienDaHetHan(phien);

    const veDangNhap = useCallback(
        (coThongBao) => {
            const email = docPhien()?.nhaCungCap?.email || phien?.nhaCungCap?.email;
            xoaPhien();
            datSoViec(undefined);
            // Trang đang xem lúc gọi (không lấy từ lần vẽ trước: trang có thể đã đổi tham số tìm kiếm)
            const dich = `${window.location.pathname}${window.location.search}`;
            navigate(diaChiDangNhap({ tiep: dich, email }), {
                replace: true,
                state: coThongBao ? { thongBao: CAU_PHIEN_HET_HAN } : null,
            });
        },
        [navigate, phien],
    );

    useEffect(() => {
        // Có phiên mà đã quá hạn: báo hết hạn; chưa từng đăng nhập: về trang nhận mã, không báo gì
        if (!conHieuLuc) veDangNhap(Boolean(phien));
    }, [conHieuLuc, phien, veDangNhap]);

    const hetPhien = useCallback(() => veDangNhap(true), [veDangNhap]);

    const thoat = useCallback(async () => {
        try {
            await congNhaCungCapService.dangXuat();
        } catch {
            // Máy chủ không nhận được: phiên tự hết hạn sau 60 phút; trên máy này vẫn xóa
        }
        xoaPhien();
        datSoViec(undefined);
        navigate(DUONG_DAN_CONG.dangNhap, { replace: true });
    }, [navigate]);

    return useMemo(
        () => ({ phien: conHieuLuc ? phien : null, hetPhien, thoat }),
        [conHieuLuc, phien, hetPhien, thoat],
    );
}
