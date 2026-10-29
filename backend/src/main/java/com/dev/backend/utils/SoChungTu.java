package com.dev.backend.utils;

/**
 * Cấp số chứng từ theo tiền tố ngày (SO20261024, PX20261024...): số đuôi LỚN NHẤT hiện có + 1.
 * Không dùng "đếm + 1": dãy số có thể có lỗ (chuyển báo giá BG…7 thành đơn SO…7 giữ nguyên số)
 * -> lần đếm sau ra đúng số đã có, thử lại bao nhiêu lần cũng trùng. Hai giao dịch lấy cùng số
 * cùng lúc thì khóa duy nhất của cột số chứng từ chặn, nơi gọi thử lại và tính lại số lớn nhất.
 */
public final class SoChungTu {

    private SoChungTu() {
    }

    /** @param soDuoiLonNhat số đuôi lớn nhất hiện có của tiền tố (null = chưa có chứng từ nào). */
    public static String tiepTheo(String tienTo, Number soDuoiLonNhat) {
        long lonNhat = soDuoiLonNhat == null ? 0 : soDuoiLonNhat.longValue();
        return tienTo + (lonNhat + 1);
    }

    /** Như {@link #tiepTheo} nhưng đệm đủ 3 chữ số: LDD-20261023-001, BBGN-20261023-012 (mẫu số của đặc tả BA). */
    public static String tiepTheoBaChuSo(String tienTo, Number soDuoiLonNhat) {
        long lonNhat = soDuoiLonNhat == null ? 0 : soDuoiLonNhat.longValue();
        return tienTo + String.format("%03d", lonNhat + 1);
    }
}
