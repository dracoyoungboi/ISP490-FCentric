package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.entities.DonBanHang;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import java.math.BigDecimal;

/**
 * Quy tắc tính số mua hàng của khách: trang chi tiết khách (tổng chi tiêu, số đơn…) và cột "Lần mua gần nhất" của danh
 * sách khách hàng dùng chung, để hai nơi luôn khớp.
 * <ul>
 *   <li>Đơn đã đặt: mọi đơn bán trừ đơn nháp tạo tay. Đơn sàn đang chờ xử lý cũng lưu trạng thái Nháp (trang_thai 0)
 *       nhưng là đơn khách đã đặt, nên đơn Nháp có kênh bán vẫn tính. (Đơn POS không gắn kênh và luôn Hoàn thành.)</li>
 *   <li>Đơn tính chi tiêu: đơn đã đặt trừ đơn đã hủy và bị hoàn trả.</li>
 *   <li>Tiền trả hàng tại quầy (phiếu trả hàng) của các đơn tính chi tiêu được trừ khỏi tổng chi tiêu: phiếu trả không
 *       đổi tổng tiền của đơn, đơn vẫn ở Hoàn thành. Tổng sau khi trừ không âm.</li>
 * </ul>
 * trang_thai NULL coi như Nháp (DEFAULT của cột là 0).
 */
public final class TinhMuaHangKhach {

    /** Một nhóm đơn của khách: cùng trạng thái và cùng có / không gắn kênh bán. */
    public record Dong(Integer trangThai, boolean coKenh, long soDon, BigDecimal tongTien) {
    }

    private TinhMuaHangKhach() {
    }

    static int trangThai(Integer trangThai) {
        return trangThai == null ? ITrangThaiDonBanHang.NHAP : trangThai;
    }

    public static boolean laDaDat(Integer trangThai, boolean coKenh) {
        return trangThai(trangThai) != ITrangThaiDonBanHang.NHAP || coKenh;
    }

    public static boolean laTinhChiTieu(Integer trangThai, boolean coKenh) {
        int tt = trangThai(trangThai);
        return laDaDat(trangThai, coKenh) && tt != ITrangThaiDonBanHang.DA_HUY && tt != ITrangThaiDonBanHang.BI_HOAN_TRA;
    }

    /** Điều kiện SQL của {@link #laDaDat}. notEqual loại cả trang_thai NULL, khớp cách coi NULL là Nháp. */
    static Predicate daDat(Root<DonBanHang> root, CriteriaBuilder cb) {
        return cb.or(
                cb.notEqual(root.get("trangThai"), ITrangThaiDonBanHang.NHAP),
                cb.isNotNull(root.get("kenhBanHang")));
    }

    /** Điều kiện SQL của {@link #laTinhChiTieu}. */
    static Predicate tinhChiTieu(Root<DonBanHang> root, CriteriaBuilder cb) {
        Path<Integer> tt = root.get("trangThai");
        return cb.and(
                daDat(root, cb),
                cb.or(cb.isNull(tt), cb.not(tt.in(ITrangThaiDonBanHang.DA_HUY, ITrangThaiDonBanHang.BI_HOAN_TRA))));
    }

    /** Tổng chi tiêu sau khi trừ tiền trả hàng, không âm. */
    static BigDecimal truTraHang(BigDecimal tongTien, BigDecimal tienTraHang) {
        BigDecimal tong = tongTien == null ? BigDecimal.ZERO : tongTien;
        BigDecimal tra = tienTraHang == null ? BigDecimal.ZERO : tienTraHang;
        return tong.subtract(tra).max(BigDecimal.ZERO);
    }
}
