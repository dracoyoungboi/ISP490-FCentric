import { useEffect, useState } from "react";

/**
 * Danh sách ngân hàng Việt Nam lấy từ API công khai của VietQR — cùng nhà cung cấp với ảnh mã QR
 * ở màn Thanh toán đơn mua (img.vietqr.io), nên mã lưu trong hồ sơ nhà cung cấp luôn tạo được QR.
 * Không viết cứng danh sách trong code: ngân hàng đổi tên / sáp nhập thì danh sách tự cập nhật.
 *
 * Giá trị lưu vào `nha_cung_cap.ngan_hang` là mã BIN (VD 970415 = VietinBank). Dữ liệu cũ có thể là
 * mã viết tắt (ICB, VCB…) hoặc tên ngắn (vietinbank) — `timNganHang` nhận cả ba.
 */
const VIETQR_BANKS_URL = import.meta.env.VITE_VIETQR_BANKS_URL || "https://api.vietqr.io/v2/banks";

let danhSachDangTai = null;

/** Tải một lần cho cả phiên; lỗi thì lần sau tải lại. */
export function layDanhSachNganHang() {
    if (!danhSachDangTai) {
        danhSachDangTai = fetch(VIETQR_BANKS_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((json) => {
                const data = Array.isArray(json?.data) ? json.data : [];
                return data
                    .filter((bank) => bank?.bin)
                    .map((bank) => ({
                        bin: String(bank.bin),
                        code: bank.code ?? "",
                        tenNgan: bank.shortName || bank.short_name || bank.code || String(bank.bin),
                        tenDayDu: bank.name ?? "",
                        logo: bank.logo ?? "",
                    }));
            })
            .catch((error) => {
                danhSachDangTai = null;
                throw error;
            });
    }
    return danhSachDangTai;
}

/** Tìm ngân hàng theo mã BIN, mã viết tắt hoặc tên ngắn (không phân biệt hoa thường). */
export function timNganHang(danhSach, giaTri) {
    const key = String(giaTri ?? "").trim().toLowerCase();
    if (!key || !Array.isArray(danhSach)) return null;
    return (
        danhSach.find((bank) => bank.bin === key)
        ?? danhSach.find((bank) => bank.code.toLowerCase() === key)
        ?? danhSach.find((bank) => bank.tenNgan.toLowerCase() === key)
        ?? null
    );
}

/** Tên hiển thị: "VietinBank" khi tra được, không thì giữ nguyên giá trị đã lưu. */
export function tenNganHang(danhSach, giaTri) {
    if (!giaTri) return "";
    return timNganHang(danhSach, giaTri)?.tenNgan ?? String(giaTri);
}

/** { danhSach, dangTai, loi } — dùng chung cho form nhà cung cấp, chi tiết và thanh toán đơn mua. */
export function useDanhSachNganHang(enabled = true) {
    const [state, setState] = useState({ danhSach: [], dangTai: enabled, loi: false });

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        layDanhSachNganHang()
            .then((danhSach) => {
                if (!cancelled) setState({ danhSach, dangTai: false, loi: false });
            })
            .catch(() => {
                if (!cancelled) setState({ danhSach: [], dangTai: false, loi: true });
            });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return state;
}
