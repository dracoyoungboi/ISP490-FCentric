package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.entities.ThanhToanDonBan;

import java.math.BigDecimal;
import java.util.Collection;

/**
 * Trạng thái thanh toán của đơn bán tính từ các phiếu (hàm thuần, không đọc DB).
 * Phải thu = tổng cộng của đơn; đơn đã hủy hoặc bị hoàn trả thì phải thu bằng 0.
 * Đã thu = tổng phiếu THU trừ tổng phiếu HOAN, không tính phiếu đã hủy.
 */
public final class TinhThanhToan {

    public static final String CHUA_THANH_TOAN = "chua_thanh_toan";
    public static final String THANH_TOAN_MOT_PHAN = "thanh_toan_mot_phan";
    public static final String DA_THANH_TOAN = "da_thanh_toan";
    /** Đã thu nhiều hơn phải thu: khách trả dư, hoặc đơn đã thu tiền rồi bị hủy / hoàn trả. */
    public static final String CAN_HOAN_TIEN = "can_hoan_tien";

    private TinhThanhToan() {
    }

    public static BigDecimal phaiThu(Integer trangThaiDon, BigDecimal tongCong) {
        if (trangThaiDon != null && (trangThaiDon == ITrangThaiDonBanHang.DA_HUY
                || trangThaiDon == ITrangThaiDonBanHang.BI_HOAN_TRA)) {
            return BigDecimal.ZERO;
        }
        return tongCong == null ? BigDecimal.ZERO : tongCong;
    }

    public static BigDecimal daThu(Collection<ThanhToanDonBan> phieu) {
        BigDecimal tong = BigDecimal.ZERO;
        if (phieu == null) return tong;
        for (ThanhToanDonBan p : phieu) {
            if (!p.hieuLuc() || p.getSoTien() == null) continue;
            tong = ThanhToanDonBan.LOAI_HOAN.equals(p.getLoai()) ? tong.subtract(p.getSoTien()) : tong.add(p.getSoTien());
        }
        return tong;
    }

    public static String trangThai(BigDecimal phaiThu, BigDecimal daThu) {
        BigDecimal phai = phaiThu == null ? BigDecimal.ZERO : phaiThu;
        BigDecimal da = daThu == null ? BigDecimal.ZERO : daThu;
        int ss = da.compareTo(phai);
        if (ss > 0) return CAN_HOAN_TIEN;
        if (da.signum() <= 0) return CHUA_THANH_TOAN;
        if (ss == 0) return DA_THANH_TOAN;
        return THANH_TOAN_MOT_PHAN;
    }
}
