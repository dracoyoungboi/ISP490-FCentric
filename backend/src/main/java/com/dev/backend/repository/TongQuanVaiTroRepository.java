package com.dev.backend.repository;

import com.dev.backend.dto.response.TongQuanVaiTroResponse.BaoGiaCuaToi;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ChoBaoGia;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ChuyenKho;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DonCuaToi;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DonCuaToiTom;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DonChoXuat;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DonHangVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DongGoi;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DongViec;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.HangSapVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.HomNayCuaBan;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NghiepVu;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NhanHang;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NhatHang;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.PhieuNhatCuaBan;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.QuyTrinh;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonBienThe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.XuatKho;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Truy vấn cho màn Tổng quan của quản lý kho, nhân viên kho, nhân viên mua hàng và nhân viên bán hàng.
 *
 * Dùng chung quy ước giờ của {@link TongQuanAdminRepository}: mọi mốc vào/ra là GIỜ VIỆT NAM; trước khi so sánh,
 * mốc được đổi sang giờ của CSDL (cột do ứng dụng ghi: {@code mocUngDung}, cột MySQL tự điền DEFAULT
 * CURRENT_TIMESTAMP: {@code mocTuDien}); khi đọc ra thì cột được cộng độ lệch tương ứng (:lech / :lechCsdl).
 * Gọi {@link TongQuanAdminRepository#thoiDiemHienTai()} trước để độ lệch được đo ở lần xem này.
 *
 * Cột do MySQL tự điền: ngay_tao của don_ban_hang, don_mua_hang, phieu_nhap_kho, phieu_xuat_kho,
 * danh_sach_nhat_hang và lich_su_giao_dich_kho.ngay_giao_dich. Các cột thời gian khác do ứng dụng ghi
 * (ngay_dat_hang, ngay_giao_hang, ngay_giao_du_kien, ngay_nhap, ngay_xuat, ngay_hoan_tat, ngay_tao của
 * yeu_cau_mua_hang và dot_kiem_ke).
 *
 * "Phiếu chuyển" là phieu_xuat_kho loai_xuat = 'khac' có kho_chuyen_den_id (0 Nháp, 1 Chờ duyệt, 2 Chờ xuất hàng,
 * 3 Đang vận chuyển, 4 Hủy, 5 Hoàn thành), cùng cách lọc với danh sách Chuyển kho nội bộ.
 *
 * Đơn mua (don_mua_hang): khi gửi yêu cầu báo giá, mỗi nhà cung cấp một đơn ở trạng thái 2 (DonMuaHangService
 * .guiYeuCauBaoGiaDenNhaCungCap); nhà cung cấp báo giá thì đơn vẫn ở 2 nhưng các dòng có đơn giá > 0 (như
 * baoGiaUtils.daCoBaoGiaTruoc ở giao diện); chọn nhà cung cấp thì đơn sang 3; 5 là trạng thái cuối. Trạng thái 1 chỉ
 * có ở dữ liệu cũ, coi như đã gửi chưa báo giá. Hoàn tất phiếu nhập kho (PhieuNhapKhoService) chuyển đơn nhận đủ sang
 * 4, trùng mã "Không chấp nhận báo giá": số "đã chốt" (đặt mua, giao đúng hạn, nhà cung cấp) dùng DON_DA_CHOT để vẫn
 * tính các đơn này.
 * "Đang về" = đơn 3 hoặc 5 còn dòng chưa nhận đủ (đơn 5 có thể còn hàng chưa nhận ở dữ liệu cũ), cùng cách tính với
 * Báo cáo tồn kho và Tổng quan quản trị (SQL_DANG_VE); dùng chung cho mọi số "đang về / đang giao / sắp về / trễ".
 */
@Repository
public class TongQuanVaiTroRepository {

    private static final String THOI_DIEM = "'%Y-%m-%dT%H:%i:%s'";
    private static final String NGAY = "'%Y-%m-%d'";

    /** Đơn mua còn dòng chưa nhận đủ (cùng cách tính phần "đang về" với Tổng quan quản trị và Báo cáo tồn kho). */
    private static final String CON_HANG_CHUA_NHAN = """
            EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ctm
                     WHERE ctm.don_mua_hang_id = dm.id
                       AND ctm.so_luong_dat > COALESCE(ctm.so_luong_da_nhan, 0))""";

    /** Đơn mua đã chốt còn hàng chưa nhận. */
    private static final String DANG_VE = "dm.trang_thai IN (3, 5) AND " + CON_HANG_CHUA_NHAN;

    /**
     * Đơn mua đã chốt (đã chọn nhà cung cấp): 3 (Đang vận chuyển), 5 (Đã nhận đủ), hoặc 4 khi đã có hàng nhận. Luồng
     * hoàn tất phiếu nhập kho (PhieuNhapKhoService) chuyển đơn nhận đủ sang 4, trong khi mã 4 của bảng trạng thái là
     * "Không chấp nhận báo giá"; báo giá bị từ chối không bao giờ có hàng nhận nên hai trường hợp không lẫn nhau.
     */
    private static final String DON_DA_CHOT = """
            (dm.trang_thai IN (3, 5)
              OR (dm.trang_thai = 4 AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ctn
                                                 WHERE ctn.don_mua_hang_id = dm.id AND ctn.so_luong_da_nhan > 0)))""";

    /** Nhà cung cấp đã báo giá cho đơn: có ngay_bao_gia (ghi mỗi lần nhà cung cấp gửi báo giá trên cổng). */
    private static final String DA_BAO_GIA = "dm.ngay_bao_gia IS NOT NULL";

    /** Yêu cầu báo giá đã gửi một nhà cung cấp, chưa có báo giá. */
    private static final String CHO_BAO_GIA = "dm.trang_thai IN (1, 2) AND NOT " + DA_BAO_GIA;

    /** Yêu cầu nhập (bí danh y) đã có đơn mua được chọn nhà cung cấp. */
    private static final String YC_DA_CHOT = """
            EXISTS (SELECT 1 FROM don_mua_hang dm
                     WHERE dm.yeu_cau_mua_hang_id = y.id AND %s)""".formatted(DON_DA_CHOT);

    /** Yêu cầu nhập (bí danh y) có ít nhất một yêu cầu báo giá đã được nhà cung cấp báo giá. */
    private static final String YC_CO_BAO_GIA = """
            EXISTS (SELECT 1 FROM don_mua_hang dm
                     WHERE dm.yeu_cau_mua_hang_id = y.id AND dm.trang_thai IN (1, 2) AND %s)"""
            .formatted(DA_BAO_GIA);

    /** Hỏi giá đang chờ: yêu cầu nhập ở bước hỏi giá, chưa chốt, chưa có báo giá nào. */
    private static final String YC_DANG_HOI_GIA = "y.trang_thai = 3 AND NOT " + YC_DA_CHOT + " AND NOT "
            + YC_CO_BAO_GIA;

    /*
     * Số lượng của một phiếu nhập (bí danh p). Phiếu nhập theo đơn mua giữ dòng dự kiến (chưa có lô, số cần nhận) và
     * thêm các dòng theo lô khai báo khi kiểm đếm (số đạt), nên không cộng chung hai loại dòng. Phiếu nhập chuyển kho
     * chỉ có dòng theo lô; phiếu cũ đã nhập có thể không có lô.
     */

    /** Đã nhập: cộng dòng theo lô nếu có, không có thì cộng mọi dòng. */
    private static final String SL_PHIEU_DA_NHAP = """
            (SELECT CASE WHEN SUM(ct.lo_hang_id IS NOT NULL) > 0
                         THEN SUM(CASE WHEN ct.lo_hang_id IS NOT NULL THEN ct.so_luong_nhap ELSE 0 END)
                         ELSE COALESCE(SUM(ct.so_luong_nhap), 0) END
               FROM chi_tiet_phieu_nhap_kho ct WHERE ct.phieu_nhap_kho_id = p.id)""";

    /** Chờ nhập: cộng dòng dự kiến nếu có, không có (phiếu nhập chuyển kho) thì cộng mọi dòng. */
    private static final String SL_PHIEU_CHO_NHAP = """
            (SELECT CASE WHEN SUM(ct.lo_hang_id IS NULL) > 0
                         THEN SUM(CASE WHEN ct.lo_hang_id IS NULL THEN ct.so_luong_nhap ELSE 0 END)
                         ELSE COALESCE(SUM(ct.so_luong_nhap), 0) END
               FROM chi_tiet_phieu_nhap_kho ct WHERE ct.phieu_nhap_kho_id = p.id)""";

    private static final String SO_CON_LAI = """
            (SELECT COALESCE(SUM(ctm.so_luong_dat - COALESCE(ctm.so_luong_da_nhan, 0)), 0)
               FROM chi_tiet_don_mua_hang ctm
              WHERE ctm.don_mua_hang_id = dm.id
                AND ctm.so_luong_dat > COALESCE(ctm.so_luong_da_nhan, 0))""";

    private final NamedParameterJdbcTemplate jdbc;
    private final TongQuanAdminRepository admin;

    public TongQuanVaiTroRepository(NamedParameterJdbcTemplate jdbc, TongQuanAdminRepository admin) {
        this.jdbc = jdbc;
        this.admin = admin;
    }

    /** Một yêu cầu nhập hàng đang mở có mã hàng: yêu cầu mới nhất và số yêu cầu đang mở có mã đó. */
    public record YeuCauMo(Integer id, String ma, long soYeuCau) {}

    /** Số việc chờ quản lý kho; cũ nhất theo giờ Việt Nam (chuỗi ISO) hoặc null. */
    public record ViecQuanLyKho(long yeuCauChoDuyet, String yeuCauCuNhat,
                                long phieuChuyenChoDuyet, String phieuChuyenCuNhat,
                                long donChoGomPhieu, String donChoGomCuNhat,
                                long phieuNhatChuaPhanCong, String phieuNhatCuNhat,
                                long dotKiemKeMo, String dotKiemKeCuNhat, String tenDotKiemKeCuNhat) {}

    public record NhaCungCapGiaTri(Integer id, String ten, BigDecimal giaTri) {}

    /** Đơn mua đến hạn của một nhà cung cấp (nccId null: đơn không ghi nhà cung cấp) và số giao đúng hạn. */
    public record GiaoHanNcc(Integer nccId, long denHan, long dungHan) {}

    public record SanPhamTim(Integer id, String ma, String ten) {}

    /** Biến thể của kết quả tra tồn, kèm sản phẩm và giá bán. */
    public record BienTheTim(Integer sanPhamId, BigDecimal giaBan, TraTonBienThe bienThe) {}

    /* ======================================================================
     * QUẢN LÝ KHO
     * ====================================================================== */

    static final String SQL_NHAP_XUAT_KHOANG = """
            SELECT COALESCE(SUM(CASE WHEN lg.loai_giao_dich = 'nhap_kho' THEN ABS(lg.so_luong) ELSE 0 END), 0) AS nhap,
                   COALESCE(SUM(CASE WHEN lg.loai_giao_dich = 'xuat_kho' THEN ABS(lg.so_luong) ELSE 0 END), 0) AS xuat
            FROM lich_su_giao_dich_kho lg
            WHERE lg.kho_id = :khoId
              AND lg.loai_giao_dich IN ('nhap_kho', 'xuat_kho')
              AND lg.ngay_giao_dich >= :tu AND lg.ngay_giao_dich <= :den
            """;

    /** Số sản phẩm nhập / xuất của kho trong [tu, den] (giờ Việt Nam), cùng cách tính với biểu đồ nhập – xuất. */
    public long[] nhapXuatKhoang(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        return jdbc.queryForObject(SQL_NHAP_XUAT_KHOANG, thamSo(khoId)
                        .addValue("tu", admin.mocTuDien(tu)).addValue("den", admin.mocTuDien(den)),
                (rs, i) -> new long[]{so(rs, "nhap"), so(rs, "xuat")});
    }

    static final String SQL_SO_PHIEU_TRONG_KHOANG = """
            SELECT
              (SELECT COUNT(*) FROM phieu_nhap_kho p
                WHERE p.kho_id = :khoId AND p.trang_thai = 3
                  AND p.ngay_nhap >= :tu AND p.ngay_nhap <= :den)                       AS so_phieu_nhap,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.kho_id = :khoId AND p.trang_thai = 3 AND p.loai_xuat IN ('ban_hang', 'chuyen_kho')
                  AND p.ngay_xuat >= :tu AND p.ngay_xuat <= :den)                       AS so_phieu_xuat
            """;

    /** Số phiếu nhập đã nhập kho và phiếu xuất đã xuất (bán hàng, chuyển kho) của kho trong [tu, den]. */
    public long[] soPhieuNhapXuat(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        return jdbc.queryForObject(SQL_SO_PHIEU_TRONG_KHOANG, thamSo(khoId)
                        .addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den)),
                (rs, i) -> new long[]{rs.getLong("so_phieu_nhap"), rs.getLong("so_phieu_xuat")});
    }

    static final String SQL_DON_CHO_XUAT = """
            SELECT COUNT(*) AS tong,
                   COALESCE(SUM(CASE WHEN d.ngay_dat_hang < :mocChoLau THEN 1 ELSE 0 END), 0) AS cho_lau
            FROM don_ban_hang d
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (1, 7, 8, 2) AND d.kho_xuat_id = :khoId
            """;

    /** Đơn bán của kho còn phải nhặt / đóng gói / xuất; chờ lâu = đặt trước mocChoLau. */
    public DonChoXuat donChoXuat(Integer khoId, LocalDateTime mocChoLau) {
        return jdbc.queryForObject(SQL_DON_CHO_XUAT,
                thamSo(khoId).addValue("mocChoLau", admin.mocUngDung(mocChoLau)),
                (rs, i) -> new DonChoXuat(rs.getLong("tong"), rs.getLong("cho_lau")));
    }

    private static final String PHIEU_CHUYEN = "p.loai_xuat = 'khac' AND p.kho_chuyen_den_id IS NOT NULL";

    static final String SQL_NGHIEP_VU = """
            SELECT
              (SELECT COUNT(*) FROM phieu_nhap_kho p WHERE p.trang_thai = 0 AND p.kho_id = :khoId)     AS phieu_cho_nhap,
              (SELECT COUNT(*) FROM don_mua_hang dm
                WHERE dm.kho_nhap_id = :khoId AND %1$s)                                                AS dang_ve,
              (SELECT COUNT(*) FROM don_mua_hang dm
                WHERE dm.kho_nhap_id = :khoId
                  AND dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :homNay AND %1$s)    AS tre_han,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %2$s AND p.trang_thai = 3 AND p.kho_chuyen_den_id = :khoId)                      AS dang_chuyen_den,
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (1, 2)
                  AND d.danh_sach_nhat_hang_id IS NULL AND d.kho_xuat_id = :khoId)                     AS cho_gom_phieu,
              (SELECT COUNT(*) FROM danh_sach_nhat_hang n
                WHERE n.trang_thai = 'dang_nhat' AND n.kho_xuat_id = :khoId)                           AS dang_nhat,
              (SELECT COUNT(*) FROM danh_sach_nhat_hang n
                WHERE n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL
                  AND n.kho_xuat_id = :khoId)                                                          AS chua_phan_cong,
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 7 AND d.kho_xuat_id = :khoId)  AS cho_dong_goi,
              (SELECT COUNT(*) FROM don_ban_hang d
                LEFT JOIN danh_sach_nhat_hang n ON n.id = d.danh_sach_nhat_hang_id
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 7 AND d.kho_xuat_id = :khoId
                  AND COALESCE(n.ngay_hoan_tat, d.ngay_dat_hang) < :mocChoLau)                          AS dong_goi_cho_lau,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.loai_xuat = 'ban_hang' AND p.trang_thai = 6 AND p.kho_id = :khoId)              AS phieu_cho_xuat,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %2$s AND p.trang_thai = 2 AND p.kho_id = :khoId)                                 AS chuyen_cho_xuat,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %2$s AND p.trang_thai = 1 AND (p.kho_id = :khoId OR p.kho_chuyen_den_id = :khoId)) AS pck_cho_duyet,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %2$s AND p.trang_thai = 2 AND (p.kho_id = :khoId OR p.kho_chuyen_den_id = :khoId)) AS pck_cho_xuat,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %2$s AND p.trang_thai = 3 AND (p.kho_id = :khoId OR p.kho_chuyen_den_id = :khoId)) AS pck_dang_chuyen,
              (SELECT COUNT(*) FROM dot_kiem_ke dk WHERE dk.trang_thai = 0 AND dk.kho_id = :khoId)       AS kiem_ke_mo
            """.formatted(DANG_VE, PHIEU_CHUYEN);

    /**
     * Ô "Công việc trong kho": mỗi số khớp đúng một danh sách (và tab) của hệ thống.
     * homNay: 0 giờ hôm nay (đơn mua trễ = quá ngày giao dự kiến); mocChoLau: đóng gói chờ lâu (nhặt xong trước mốc).
     */
    public NghiepVu nghiepVu(Integer khoId, LocalDateTime homNay, LocalDateTime mocChoLau) {
        MapSqlParameterSource p = thamSo(khoId)
                .addValue("homNay", admin.mocUngDung(homNay))
                .addValue("mocChoLau", admin.mocUngDung(mocChoLau));
        return jdbc.queryForObject(SQL_NGHIEP_VU, p, (rs, i) -> new NghiepVu(
                new NhanHang(rs.getLong("phieu_cho_nhap"), rs.getLong("dang_ve"), rs.getLong("tre_han"),
                        rs.getLong("dang_chuyen_den")),
                new NhatHang(rs.getLong("cho_gom_phieu"), rs.getLong("dang_nhat"), rs.getLong("chua_phan_cong")),
                new DongGoi(rs.getLong("cho_dong_goi"), rs.getLong("dong_goi_cho_lau")),
                new XuatKho(rs.getLong("phieu_cho_xuat"), rs.getLong("chuyen_cho_xuat")),
                new ChuyenKho(rs.getLong("pck_cho_duyet"), rs.getLong("pck_cho_xuat"), rs.getLong("pck_dang_chuyen")),
                rs.getLong("kiem_ke_mo")));
    }

    static final String SQL_VIEC_QUAN_LY_KHO = """
            SELECT
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y WHERE y.trang_thai = 1 AND y.kho_nhap_id = :khoId) AS yc_so,
              (SELECT DATE_FORMAT(DATE_ADD(MIN(y.ngay_tao), INTERVAL :lech MINUTE), %3$s)
                 FROM yeu_cau_mua_hang y WHERE y.trang_thai = 1 AND y.kho_nhap_id = :khoId)            AS yc_cu,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE %1$s AND p.trang_thai = 1 AND p.kho_id = :khoId)                                 AS pck_so,
              (SELECT DATE_FORMAT(DATE_ADD(MIN(p.ngay_tao), INTERVAL :lechCsdl MINUTE), %3$s)
                 FROM phieu_xuat_kho p WHERE %1$s AND p.trang_thai = 1 AND p.kho_id = :khoId)           AS pck_cu,
              (SELECT COUNT(*) FROM don_ban_hang d WHERE %2$s)                                         AS gom_so,
              (SELECT DATE_FORMAT(DATE_ADD(MIN(d.ngay_dat_hang), INTERVAL :lech MINUTE), %3$s)
                 FROM don_ban_hang d WHERE %2$s)                                                       AS gom_cu,
              (SELECT COUNT(*) FROM danh_sach_nhat_hang n
                WHERE n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL
                  AND n.kho_xuat_id = :khoId)                                                          AS pc_so,
              (SELECT DATE_FORMAT(DATE_ADD(MIN(n.ngay_tao), INTERVAL :lechCsdl MINUTE), %3$s)
                 FROM danh_sach_nhat_hang n
                WHERE n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL
                  AND n.kho_xuat_id = :khoId)                                                          AS pc_cu,
              (SELECT COUNT(*) FROM dot_kiem_ke dk WHERE dk.trang_thai = 0 AND dk.kho_id = :khoId)       AS kk_so,
              (SELECT DATE_FORMAT(DATE_ADD(MIN(dk.ngay_tao), INTERVAL :lech MINUTE), %3$s)
                 FROM dot_kiem_ke dk WHERE dk.trang_thai = 0 AND dk.kho_id = :khoId)                    AS kk_cu,
              (SELECT dk.ten_dot_kiem_ke FROM dot_kiem_ke dk WHERE dk.trang_thai = 0 AND dk.kho_id = :khoId
                ORDER BY dk.ngay_tao IS NULL, dk.ngay_tao, dk.id LIMIT 1)                               AS kk_ten
            """.formatted(PHIEU_CHUYEN,
            "d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (1, 2) AND d.danh_sach_nhat_hang_id IS NULL"
                    + " AND d.kho_xuat_id = :khoId",
            THOI_DIEM);

    /**
     * Việc quản lý kho phải tự làm ở kho này: duyệt yêu cầu nhập hàng (kho nhập), duyệt phiếu chuyển đi (kho gửi),
     * gom đơn thành phiếu nhặt, phân công phiếu nhặt, hoàn tất đợt kiểm kê.
     */
    public ViecQuanLyKho viecQuanLyKho(Integer khoId) {
        return jdbc.queryForObject(SQL_VIEC_QUAN_LY_KHO, thamSoGio(khoId), (rs, i) -> new ViecQuanLyKho(
                rs.getLong("yc_so"), rs.getString("yc_cu"),
                rs.getLong("pck_so"), rs.getString("pck_cu"),
                rs.getLong("gom_so"), rs.getString("gom_cu"),
                rs.getLong("pc_so"), rs.getString("pc_cu"),
                rs.getLong("kk_so"), rs.getString("kk_cu"), rs.getString("kk_ten")));
    }

    static final String SQL_YEU_CAU_MO = """
            SELECT ct.bien_the_san_pham_id AS bien_the_id, y.id, y.so_yeu_cau_mua_hang AS ma
            FROM chi_tiet_yeu_cau_mua_hang ct
            JOIN yeu_cau_mua_hang y ON y.id = ct.yeu_cau_mua_hang_id
            WHERE y.trang_thai IN (0, 1, 2, 3) AND ct.bien_the_san_pham_id IN (:ids)
            ORDER BY y.id DESC
            """;

    /** Yêu cầu nhập hàng chưa thành đơn mua (Nháp, Chờ duyệt, Đã duyệt, Đã gửi yêu cầu báo giá) theo mã hàng. */
    public Map<Integer, YeuCauMo> yeuCauMoTheoBienThe(Collection<Integer> bienTheIds) {
        Map<Integer, YeuCauMo> ketQua = new HashMap<>();
        if (bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        Map<Integer, Set<Integer>> daDem = new HashMap<>();
        jdbc.query(SQL_YEU_CAU_MO, new MapSqlParameterSource("ids", bienTheIds), rs -> {
            int bienThe = rs.getInt("bien_the_id");
            int id = rs.getInt("id");
            if (!daDem.computeIfAbsent(bienThe, k -> new HashSet<>()).add(id)) return;
            YeuCauMo cu = ketQua.get(bienThe);
            ketQua.put(bienThe, cu == null ? new YeuCauMo(id, rs.getString("ma"), 1)
                    : new YeuCauMo(cu.id(), cu.ma(), cu.soYeuCau() + 1));
        });
        return ketQua;
    }

    /* ======================================================================
     * NHÂN VIÊN KHO
     * ====================================================================== */

    static final String SQL_PHIEU_NHAT_CUA_BAN = """
            SELECT n.id, n.ma_pick_list, n.trang_thai,
                   DATE_FORMAT(DATE_ADD(n.ngay_tao, INTERVAL :lechCsdl MINUTE), %s) AS ngay_tao,
                   (SELECT COUNT(*) FROM don_ban_hang d WHERE d.danh_sach_nhat_hang_id = n.id)          AS so_don,
                   (SELECT COALESCE(SUM(c.so_luong_can_nhat), 0) FROM chi_tiet_nhat_hang c
                     WHERE c.danh_sach_nhat_hang_id = n.id)                                            AS can_nhat,
                   (SELECT COALESCE(SUM(LEAST(COALESCE(c.so_luong_da_quet, 0), c.so_luong_can_nhat)), 0)
                      FROM chi_tiet_nhat_hang c WHERE c.danh_sach_nhat_hang_id = n.id)                AS da_quet
            FROM danh_sach_nhat_hang n
            WHERE n.kho_xuat_id = :khoId AND n.nguoi_nhat_id = :nguoiDungId
              AND n.trang_thai IN ('cho_nhat', 'dang_nhat')
            ORDER BY n.trang_thai = 'dang_nhat' DESC, n.ngay_tao, n.id
            LIMIT :soDong
            """.formatted(THOI_DIEM);

    /** Phiếu nhặt đang giao cho người dùng ở kho này: phiếu đang nhặt trước, rồi phiếu cũ trước. */
    public List<PhieuNhatCuaBan> phieuNhatCuaBan(Integer khoId, Integer nguoiDungId, int soDong) {
        return jdbc.query(SQL_PHIEU_NHAT_CUA_BAN, thamSoGio(khoId).addValue("nguoiDungId", nguoiDungId)
                        .addValue("soDong", soDong),
                (rs, i) -> new PhieuNhatCuaBan(rs.getInt("id"), rs.getString("ma_pick_list"), rs.getString("trang_thai"),
                        rs.getLong("so_don"), so(rs, "da_quet"), so(rs, "can_nhat"), rs.getString("ngay_tao")));
    }

    static final String SQL_HOM_NAY_CUA_BAN = """
            SELECT
              (SELECT COALESCE(SUM(x.so_luong), 0)
                 FROM (SELECT %3$s AS so_luong FROM phieu_nhap_kho p WHERE %1$s) x)                    AS sp_nhap,
              (SELECT COUNT(*) FROM phieu_nhap_kho p WHERE %1$s)                                       AS phieu_nhap,
              (SELECT COALESCE(SUM(LEAST(COALESCE(c.so_luong_da_quet, 0), c.so_luong_can_nhat)), 0)
                 FROM danh_sach_nhat_hang n JOIN chi_tiet_nhat_hang c ON c.danh_sach_nhat_hang_id = n.id
                WHERE %2$s)                                                                            AS sp_nhat,
              (SELECT COUNT(*) FROM danh_sach_nhat_hang n WHERE %2$s)                                  AS phieu_nhat,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.trang_thai = 3 AND p.nguoi_xuat_id = :nguoiDungId AND p.kho_id = :khoId
                  AND p.loai_xuat IN ('ban_hang', 'chuyen_kho')
                  AND p.ngay_xuat >= :tu AND p.ngay_xuat <= :den)                                      AS phieu_xuat
            """.formatted(
            "p.trang_thai = 3 AND p.nguoi_nhap_id = :nguoiDungId AND p.kho_id = :khoId"
                    + " AND p.ngay_nhap >= :tu AND p.ngay_nhap <= :den",
            "n.trang_thai = 'da_nhat' AND n.nguoi_nhat_id = :nguoiDungId AND n.kho_xuat_id = :khoId"
                    + " AND n.ngay_hoan_tat >= :tu AND n.ngay_hoan_tat <= :den",
            SL_PHIEU_DA_NHAP);

    /** Việc người dùng đã làm xong ở kho này trong [tu, den]. */
    public HomNayCuaBan homNayCuaBan(Integer khoId, Integer nguoiDungId, LocalDateTime tu, LocalDateTime den) {
        MapSqlParameterSource p = thamSo(khoId).addValue("nguoiDungId", nguoiDungId)
                .addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den));
        return jdbc.queryForObject(SQL_HOM_NAY_CUA_BAN, p, (rs, i) -> new HomNayCuaBan(
                so(rs, "sp_nhap"), rs.getLong("phieu_nhap"), so(rs, "sp_nhat"), rs.getLong("phieu_nhat"),
                rs.getLong("phieu_xuat")));
    }

    /* ---- Việc chung của kho: mỗi nhóm có câu đếm và câu lấy danh sách cùng điều kiện ---- */

    private static final String DK_NHAN_HANG = "p.trang_thai = 0 AND p.kho_id = :khoId";

    static final String SQL_VIEC_NHAN_HANG = """
            SELECT p.id, p.so_phieu_nhap AS ma,
                   CASE WHEN p.phieu_chuyen_id IS NOT NULL THEN 1 ELSE 0 END                      AS la_chuyen,
                   COALESCE(kg.ten_kho, ncc.ten_nha_cung_cap, ncc2.ten_nha_cung_cap)              AS doi_tac,
                   %s                                                                              AS so_luong,
                   DATE_FORMAT(DATE_ADD(p.ngay_tao, INTERVAL :lechCsdl MINUTE), %s)              AS thoi_diem,
                   CASE WHEN p.ngay_tao < :mocChoLauCsdl THEN 1 ELSE 0 END                       AS cho_lau
            FROM phieu_nhap_kho p
            LEFT JOIN nha_cung_cap ncc   ON ncc.id = p.nha_cung_cap_id
            LEFT JOIN don_mua_hang dm    ON dm.id = p.don_mua_hang_id
            LEFT JOIN nha_cung_cap ncc2  ON ncc2.id = dm.nha_cung_cap_id
            LEFT JOIN phieu_xuat_kho pck ON pck.id = p.phieu_chuyen_id
            LEFT JOIN kho kg             ON kg.id = pck.kho_id
            WHERE %s
            ORDER BY p.ngay_tao IS NULL, p.ngay_tao, p.id
            LIMIT :soDong
            """.formatted(SL_PHIEU_CHO_NHAP, THOI_DIEM, DK_NHAN_HANG);

    /** Phiếu nhập Nháp của kho (hàng đã về / đang về, chờ kiểm đếm và nhập kho). */
    public List<DongViec> viecNhanHang(Integer khoId, LocalDateTime mocChoLau, int soDong) {
        return jdbc.query(SQL_VIEC_NHAN_HANG, thamSoViec(khoId, mocChoLau, soDong), (rs, i) -> new DongViec(
                rs.getInt("la_chuyen") == 1 ? "phieu_nhap_chuyen_kho" : "phieu_nhap", rs.getInt("id"),
                rs.getString("ma"), rs.getString("doi_tac"), so(rs, "so_luong"), 0,
                rs.getString("thoi_diem"), rs.getInt("cho_lau") == 1));
    }

    public long demNhanHang(Integer khoId) {
        return dem("SELECT COUNT(*) FROM phieu_nhap_kho p WHERE " + DK_NHAN_HANG, thamSo(khoId));
    }

    private static final String DK_NHAT_HANG =
            "n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL AND n.kho_xuat_id = :khoId";

    static final String SQL_VIEC_NHAT_HANG = """
            SELECT n.id, n.ma_pick_list AS ma,
                   (SELECT COUNT(*) FROM don_ban_hang d WHERE d.danh_sach_nhat_hang_id = n.id)   AS so_don,
                   (SELECT COALESCE(SUM(c.so_luong_can_nhat), 0) FROM chi_tiet_nhat_hang c
                     WHERE c.danh_sach_nhat_hang_id = n.id)                                     AS so_luong,
                   DATE_FORMAT(DATE_ADD(n.ngay_tao, INTERVAL :lechCsdl MINUTE), %s)             AS thoi_diem,
                   CASE WHEN n.ngay_tao < :mocChoLauCsdl THEN 1 ELSE 0 END                      AS cho_lau
            FROM danh_sach_nhat_hang n
            WHERE %s
            ORDER BY n.ngay_tao IS NULL, n.ngay_tao, n.id
            LIMIT :soDong
            """.formatted(THOI_DIEM, DK_NHAT_HANG);

    /** Phiếu nhặt của kho chưa giao cho ai. */
    public List<DongViec> viecNhatHang(Integer khoId, LocalDateTime mocChoLau, int soDong) {
        return jdbc.query(SQL_VIEC_NHAT_HANG, thamSoViec(khoId, mocChoLau, soDong), (rs, i) -> new DongViec(
                "phieu_nhat", rs.getInt("id"), rs.getString("ma"), null, so(rs, "so_luong"), rs.getLong("so_don"),
                rs.getString("thoi_diem"), rs.getInt("cho_lau") == 1));
    }

    public long demNhatHang(Integer khoId) {
        return dem("SELECT COUNT(*) FROM danh_sach_nhat_hang n WHERE " + DK_NHAT_HANG, thamSo(khoId));
    }

    private static final String DK_DONG_GOI =
            "d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 7 AND d.kho_xuat_id = :khoId";

    static final String SQL_VIEC_DONG_GOI = """
            SELECT d.id, d.so_don_hang AS ma, COALESCE(kh.ten_khach_hang, kb.ten_kenh) AS doi_tac,
                   (SELECT COALESCE(SUM(ct.so_luong_dat), 0) FROM chi_tiet_don_ban_hang ct
                     WHERE ct.don_ban_hang_id = d.id)                                                     AS so_luong,
                   DATE_FORMAT(DATE_ADD(COALESCE(n.ngay_hoan_tat, d.ngay_dat_hang), INTERVAL :lech MINUTE), %s) AS thoi_diem,
                   CASE WHEN COALESCE(n.ngay_hoan_tat, d.ngay_dat_hang) < :mocChoLau THEN 1 ELSE 0 END    AS cho_lau
            FROM don_ban_hang d
            LEFT JOIN danh_sach_nhat_hang n ON n.id = d.danh_sach_nhat_hang_id
            LEFT JOIN khach_hang kh         ON kh.id = d.khach_hang_id
            LEFT JOIN kenh_ban_hang kb      ON kb.id = d.kenh_ban_id
            WHERE %s
            ORDER BY COALESCE(n.ngay_hoan_tat, d.ngay_dat_hang), d.id
            LIMIT :soDong
            """.formatted(THOI_DIEM, DK_DONG_GOI);

    /** Đơn bán đã nhặt xong, chờ đóng gói; thời điểm = lúc nhặt xong. */
    public List<DongViec> viecDongGoi(Integer khoId, LocalDateTime mocChoLau, int soDong) {
        return jdbc.query(SQL_VIEC_DONG_GOI, thamSoViec(khoId, mocChoLau, soDong), (rs, i) -> new DongViec(
                "don_ban", rs.getInt("id"), rs.getString("ma"), rs.getString("doi_tac"), so(rs, "so_luong"), 0,
                rs.getString("thoi_diem"), rs.getInt("cho_lau") == 1));
    }

    public long demDongGoi(Integer khoId) {
        return dem("SELECT COUNT(*) FROM don_ban_hang d WHERE " + DK_DONG_GOI, thamSo(khoId));
    }

    private static final String DK_XUAT_BAN = "p.loai_xuat = 'ban_hang' AND p.trang_thai = 6 AND p.kho_id = :khoId";
    private static final String DK_CHUYEN_CHO_XUAT = PHIEU_CHUYEN + " AND p.trang_thai = 2 AND p.kho_id = :khoId";

    static final String SQL_VIEC_XUAT_KHO = """
            SELECT x.loai, x.id, x.ma, x.doi_tac, x.so_luong,
                   DATE_FORMAT(DATE_ADD(x.goc, INTERVAL :lechCsdl MINUTE), %s)  AS thoi_diem,
                   CASE WHEN x.goc < :mocChoLauCsdl THEN 1 ELSE 0 END          AS cho_lau
            FROM (
              (SELECT 'phieu_xuat' AS loai, p.id, p.so_phieu_xuat AS ma,
                      COALESCE(kh.ten_khach_hang, kb.ten_kenh, d.so_don_hang) AS doi_tac,
                      (SELECT COALESCE(SUM(ct.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho ct
                        WHERE ct.phieu_xuat_kho_id = p.id AND ct.lo_hang_id IS NOT NULL) AS so_luong,
                      p.ngay_tao AS goc
                 FROM phieu_xuat_kho p
                 LEFT JOIN don_ban_hang d   ON d.id = p.don_ban_hang_id
                 LEFT JOIN khach_hang kh    ON kh.id = d.khach_hang_id
                 LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                WHERE %s)
              UNION ALL
              (SELECT 'phieu_chuyen', p.id, p.so_phieu_xuat, kd.ten_kho,
                      (SELECT COALESCE(SUM(ct.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho ct
                        WHERE ct.phieu_xuat_kho_id = p.id),
                      p.ngay_tao
                 FROM phieu_xuat_kho p
                 JOIN kho kd ON kd.id = p.kho_chuyen_den_id
                WHERE %s)
            ) x
            ORDER BY x.goc IS NULL, x.goc, x.id
            LIMIT :soDong
            """.formatted(THOI_DIEM, DK_XUAT_BAN, DK_CHUYEN_CHO_XUAT);

    /** Phiếu xuất bán đã đóng gói chờ xuất và phiếu chuyển của kho đã duyệt chờ xuất hàng. */
    public List<DongViec> viecXuatKho(Integer khoId, LocalDateTime mocChoLau, int soDong) {
        return jdbc.query(SQL_VIEC_XUAT_KHO, thamSoViec(khoId, mocChoLau, soDong), (rs, i) -> new DongViec(
                rs.getString("loai"), rs.getInt("id"), rs.getString("ma"), rs.getString("doi_tac"),
                so(rs, "so_luong"), 0, rs.getString("thoi_diem"), rs.getInt("cho_lau") == 1));
    }

    public long demXuatKho(Integer khoId) {
        return dem("SELECT (SELECT COUNT(*) FROM phieu_xuat_kho p WHERE " + DK_XUAT_BAN + ")"
                + " + (SELECT COUNT(*) FROM phieu_xuat_kho p WHERE " + DK_CHUYEN_CHO_XUAT + ")", thamSo(khoId));
    }

    private static final String DK_KIEM_KE = "dk.trang_thai = 0 AND dk.kho_id = :khoId";

    static final String SQL_VIEC_KIEM_KE = """
            SELECT dk.id, dk.ma_dot_kiem_ke AS ma, dk.ten_dot_kiem_ke AS doi_tac,
                   (SELECT COUNT(*) FROM chi_tiet_kiem_ke c WHERE c.dot_kiem_ke_id = dk.id) AS so_luong,
                   DATE_FORMAT(DATE_ADD(dk.ngay_tao, INTERVAL :lech MINUTE), %s)           AS thoi_diem
            FROM dot_kiem_ke dk
            WHERE %s
            ORDER BY dk.ngay_tao IS NULL, dk.ngay_tao, dk.id
            LIMIT :soDong
            """.formatted(THOI_DIEM, DK_KIEM_KE);

    /** Đợt kiểm kê đang mở của kho; soLuong = số dòng cần đếm. */
    public List<DongViec> viecKiemKe(Integer khoId, int soDong) {
        return jdbc.query(SQL_VIEC_KIEM_KE, thamSoGio(khoId).addValue("soDong", soDong), (rs, i) -> new DongViec(
                "kiem_ke", rs.getInt("id"), rs.getString("ma"), rs.getString("doi_tac"), rs.getLong("so_luong"), 0,
                rs.getString("thoi_diem"), false));
    }

    public long demKiemKe(Integer khoId) {
        return dem("SELECT COUNT(*) FROM dot_kiem_ke dk WHERE " + DK_KIEM_KE, thamSo(khoId));
    }

    private static final String DK_DON_MUA_SAP_VE = "dm.kho_nhap_id = :khoId"
            + " AND dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :denNgay AND " + DANG_VE;
    private static final String DK_CHUYEN_DEN = PHIEU_CHUYEN + " AND p.trang_thai = 3 AND p.kho_chuyen_den_id = :khoId";

    static final String SQL_DON_MUA_SAP_VE = """
            SELECT dm.id, dm.so_don_mua AS ma, ncc.ten_nha_cung_cap AS doi_tac, %s AS so_luong,
                   DATE_FORMAT(DATE_ADD(dm.ngay_giao_du_kien, INTERVAL :lech MINUTE), %s) AS ngay,
                   CASE WHEN dm.ngay_giao_du_kien < :homNay THEN 1 ELSE 0 END             AS tre
            FROM don_mua_hang dm
            LEFT JOIN nha_cung_cap ncc ON ncc.id = dm.nha_cung_cap_id
            WHERE %s
            ORDER BY dm.ngay_giao_du_kien, dm.id
            LIMIT :soDong
            """.formatted(SO_CON_LAI, NGAY, DK_DON_MUA_SAP_VE);

    static final String SQL_CHUYEN_DEN = """
            SELECT p.id, p.so_phieu_xuat AS ma, kg.ten_kho AS doi_tac,
                   (SELECT COALESCE(SUM(ct.so_luong_xuat), 0)
                      FROM phieu_xuat_kho px
                      JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = px.id AND ct.lo_hang_id IS NOT NULL
                     WHERE px.parent_id = p.id AND px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3) AS so_luong,
                   DATE_FORMAT(DATE_ADD(p.ngay_xuat, INTERVAL :lech MINUTE), %s)                     AS ngay
            FROM phieu_xuat_kho p
            JOIN kho kg ON kg.id = p.kho_id
            WHERE %s
            ORDER BY p.ngay_xuat IS NULL, p.ngay_xuat, p.id
            LIMIT :soDong
            """.formatted(NGAY, DK_CHUYEN_DEN);

    /**
     * Hàng sắp về kho: đơn mua đang vận chuyển còn hàng chưa nhận, ngày giao dự kiến trước denNgay (gồm cả đơn đã
     * trễ), và phiếu chuyển đang trên đường đến kho. Trả về hai danh sách nối nhau (đơn mua trước), mỗi loại tối đa
     * soDong; service sắp xếp lại.
     */
    public List<HangSapVe> hangSapVe(Integer khoId, LocalDateTime homNay, LocalDateTime denNgay, int soDong) {
        MapSqlParameterSource p = thamSoGio(khoId).addValue("homNay", admin.mocUngDung(homNay))
                .addValue("denNgay", admin.mocUngDung(denNgay)).addValue("soDong", soDong);
        List<HangSapVe> ds = new ArrayList<>(jdbc.query(SQL_DON_MUA_SAP_VE, p, (rs, i) -> new HangSapVe(
                "don_mua", rs.getInt("id"), rs.getString("ma"), rs.getString("doi_tac"), so(rs, "so_luong"),
                rs.getString("ngay"), rs.getInt("tre") == 1)));
        ds.addAll(jdbc.query(SQL_CHUYEN_DEN, p, (rs, i) -> new HangSapVe(
                "phieu_chuyen", rs.getInt("id"), rs.getString("ma"), rs.getString("doi_tac"), so(rs, "so_luong"),
                rs.getString("ngay"), false)));
        return ds;
    }

    public long demHangSapVe(Integer khoId, LocalDateTime denNgay) {
        return dem("SELECT (SELECT COUNT(*) FROM don_mua_hang dm WHERE " + DK_DON_MUA_SAP_VE + ")"
                        + " + (SELECT COUNT(*) FROM phieu_xuat_kho p WHERE " + DK_CHUYEN_DEN + ")",
                thamSo(khoId).addValue("denNgay", admin.mocUngDung(denNgay)));
    }

    /* ======================================================================
     * NHÂN VIÊN MUA HÀNG (mọi kho)
     * ====================================================================== */

    static final String SQL_DAT_MUA_THEO_NGAY = """
            SELECT DATE_FORMAT(DATE_ADD(dm.ngay_dat_hang, INTERVAL :lech MINUTE), %s) AS ngay,
                   COALESCE(SUM(dm.tong_tien), 0)                                   AS gia_tri
            FROM don_mua_hang dm
            WHERE %s AND dm.ngay_dat_hang >= :tu AND dm.ngay_dat_hang < :den
            GROUP BY 1
            """.formatted(NGAY, DON_DA_CHOT);

    /** Giá trị đơn mua đã chốt (xem DON_DA_CHOT) theo ngày đặt hàng trong [tu, den). */
    public Map<LocalDate, BigDecimal> datMuaTheoNgay(LocalDateTime tu, LocalDateTime den) {
        Map<LocalDate, BigDecimal> ketQua = new HashMap<>();
        jdbc.query(SQL_DAT_MUA_THEO_NGAY, thamSoGio(null)
                        .addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den)),
                rs -> { ketQua.put(LocalDate.parse(rs.getString("ngay")), bd(rs, "gia_tri")); });
        return ketQua;
    }

    /** Số đơn mua (Đang vận chuyển, Đã nhận đủ) còn hàng chưa nhận, cùng điều kiện với số lượng "đang về". */
    public long demDonDangVe() {
        return dem("SELECT COUNT(*) FROM don_mua_hang dm WHERE " + DANG_VE,
                new MapSqlParameterSource());
    }

    static final String SQL_GIAO_DUNG_HAN = """
            SELECT dm.nha_cung_cap_id AS ncc_id,
                   COUNT(*) AS den_han,
                   COALESCE(SUM(CASE
                     WHEN NOT %s
                      AND (SELECT MAX(pn.ngay_nhap) FROM phieu_nhap_kho pn
                            WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3)
                          < DATE_SUB(TIMESTAMP(DATE(DATE_ADD(dm.ngay_giao_du_kien, INTERVAL :lech MINUTE)) + INTERVAL 1 DAY),
                                     INTERVAL :lech MINUTE)
                     THEN 1 ELSE 0 END), 0) AS dung_han
            FROM don_mua_hang dm
            WHERE %s AND dm.ngay_giao_du_kien >= :tu AND dm.ngay_giao_du_kien < :den
            GROUP BY dm.nha_cung_cap_id
            """.formatted(CON_HANG_CHUA_NHAN, DON_DA_CHOT);

    /**
     * Đơn mua đã chốt có ngày giao dự kiến trong [tu, den) theo từng nhà cung cấp. Đúng hạn: mọi dòng đã nhận đủ và
     * phiếu nhập (đã nhập kho) cuối cùng của đơn trước 0 giờ ngày hôm sau của ngày giao dự kiến (giờ Việt Nam).
     */
    public List<GiaoHanNcc> giaoDungHan(LocalDateTime tu, LocalDateTime den) {
        return jdbc.query(SQL_GIAO_DUNG_HAN, thamSoGio(null)
                        .addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den)),
                (rs, i) -> new GiaoHanNcc(rs.getObject("ncc_id", Integer.class), rs.getLong("den_han"),
                        rs.getLong("dung_han")));
    }

    static final String SQL_CHO_BAO_GIA = """
            SELECT COUNT(*) AS tong,
                   COALESCE(SUM(CASE WHEN dm.ngay_tao < :mocQuaHanCsdl THEN 1 ELSE 0 END), 0) AS qua_han,
                   COUNT(DISTINCT dm.nha_cung_cap_id) AS so_ncc
            FROM don_mua_hang dm
            LEFT JOIN yeu_cau_mua_hang y ON y.id = dm.yeu_cau_mua_hang_id
            WHERE %s AND (y.id IS NULL OR (y.trang_thai = 3 AND NOT %s))
            """.formatted(CHO_BAO_GIA, YC_DA_CHOT);

    /**
     * Yêu cầu báo giá đã gửi nhà cung cấp mà nhà cung cấp chưa báo giá, của yêu cầu nhập hàng còn đang hỏi giá
     * (yêu cầu đã chọn được nhà cung cấp thì các yêu cầu báo giá còn lại không tính).
     */
    public ChoBaoGia choBaoGia(LocalDateTime mocQuaHan) {
        return jdbc.queryForObject(SQL_CHO_BAO_GIA,
                new MapSqlParameterSource("mocQuaHanCsdl", admin.mocTuDien(mocQuaHan)),
                (rs, i) -> new ChoBaoGia(rs.getLong("tong"), rs.getLong("qua_han"), rs.getLong("so_ncc")));
    }

    static final String SQL_QUY_TRINH = """
            SELECT
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y WHERE y.trang_thai = 2)                        AS da_duyet,
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y WHERE %1$s
                  AND EXISTS (SELECT 1 FROM don_mua_hang dm WHERE dm.yeu_cau_mua_hang_id = y.id
                               AND %2$s))                                                             AS cho_bao_gia,
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y WHERE %1$s
                  AND EXISTS (SELECT 1 FROM don_mua_hang dm WHERE dm.yeu_cau_mua_hang_id = y.id
                               AND %2$s AND dm.ngay_tao < :mocQuaHanCsdl))                            AS cho_bao_gia_qua_han,
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y
                WHERE y.trang_thai = 3 AND NOT %3$s AND %4$s)                                          AS cho_chot,
              (SELECT COUNT(*) FROM don_mua_hang dm WHERE %5$s)                                        AS dang_giao,
              (SELECT COUNT(*) FROM don_mua_hang dm WHERE %5$s
                  AND dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :homNay)            AS dang_giao_tre
            """.formatted(YC_DANG_HOI_GIA, CHO_BAO_GIA, YC_DA_CHOT, YC_CO_BAO_GIA, DANG_VE);

    /**
     * Bốn bước mua: yêu cầu nhập đã duyệt chưa hỏi giá · đang hỏi giá (còn yêu cầu báo giá đã gửi, chưa nhà cung cấp
     * nào báo giá) · chờ chốt đơn (đã có ít nhất một báo giá, chưa chọn nhà cung cấp) · đơn đang về (trễ = quá ngày
     * giao dự kiến). Yêu cầu nhập ở bước hỏi giá nhưng không thuộc hai nhóm giữa (mọi yêu cầu báo giá bị từ chối, hoặc
     * đã có đơn được chọn) không được đếm, nên tổng hai nhóm có thể nhỏ hơn số ở tab "Đang hỏi giá".
     */
    public QuyTrinh quyTrinh(LocalDateTime homNay, LocalDateTime mocQuaHan) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("homNay", admin.mocUngDung(homNay))
                .addValue("mocQuaHanCsdl", admin.mocTuDien(mocQuaHan));
        return jdbc.queryForObject(SQL_QUY_TRINH, p, (rs, i) -> new QuyTrinh(rs.getLong("da_duyet"),
                rs.getLong("cho_bao_gia"), rs.getLong("cho_bao_gia_qua_han"), rs.getLong("cho_chot"),
                rs.getLong("dang_giao"), rs.getLong("dang_giao_tre")));
    }

    static final String SQL_LICH_HANG_VE = """
            SELECT dm.id, dm.so_don_mua AS ma, ncc.ten_nha_cung_cap AS ncc, %s AS con_lai,
                   DATE_FORMAT(DATE_ADD(dm.ngay_giao_du_kien, INTERVAL :lech MINUTE), %s) AS ngay_giao,
                   CASE WHEN dm.ngay_giao_du_kien < :homNay THEN 1 ELSE 0 END             AS tre
            FROM don_mua_hang dm
            LEFT JOIN nha_cung_cap ncc ON ncc.id = dm.nha_cung_cap_id
            WHERE dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :denNgay
              AND %s
            ORDER BY dm.ngay_giao_du_kien, dm.id
            LIMIT :soDong
            """.formatted(SO_CON_LAI, NGAY, DANG_VE);

    /** Đơn mua đang về (còn hàng chưa nhận), ngày giao dự kiến trước denNgay (gồm cả đơn đã trễ). */
    public List<DonHangVe> lichHangVe(LocalDateTime homNay, LocalDateTime denNgay, int soDong) {
        MapSqlParameterSource p = thamSoGio(null).addValue("homNay", admin.mocUngDung(homNay))
                .addValue("denNgay", admin.mocUngDung(denNgay)).addValue("soDong", soDong);
        return jdbc.query(SQL_LICH_HANG_VE, p, (rs, i) -> new DonHangVe(rs.getInt("id"), rs.getString("ma"),
                rs.getString("ncc"), so(rs, "con_lai"), rs.getString("ngay_giao"), rs.getInt("tre") == 1));
    }

    static final String SQL_NHA_CUNG_CAP_NHIEU_NHAT = """
            SELECT ncc.id, ncc.ten_nha_cung_cap AS ten, COALESCE(SUM(dm.tong_tien), 0) AS gia_tri
            FROM don_mua_hang dm
            JOIN nha_cung_cap ncc ON ncc.id = dm.nha_cung_cap_id
            WHERE %s AND dm.ngay_dat_hang >= :tu AND dm.ngay_dat_hang < :den
            GROUP BY ncc.id, ncc.ten_nha_cung_cap
            ORDER BY gia_tri DESC, ncc.id
            LIMIT :soDong
            """.formatted(DON_DA_CHOT);

    /** Nhà cung cấp có giá trị đơn mua đã chốt lớn nhất, theo ngày đặt hàng trong [tu, den). */
    public List<NhaCungCapGiaTri> nhaCungCapNhieuNhat(LocalDateTime tu, LocalDateTime den, int soDong) {
        return jdbc.query(SQL_NHA_CUNG_CAP_NHIEU_NHAT, new MapSqlParameterSource()
                        .addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den))
                        .addValue("soDong", soDong),
                (rs, i) -> new NhaCungCapGiaTri(rs.getInt("id"), rs.getString("ten"), bd(rs, "gia_tri")));
    }

    static final String SQL_DANG_VE_THEO_BIEN_THE = """
            SELECT ctm.bien_the_san_pham_id AS bien_the_id,
                   SUM(ctm.so_luong_dat - COALESCE(ctm.so_luong_da_nhan, 0)) AS dang_ve
            FROM chi_tiet_don_mua_hang ctm
            JOIN don_mua_hang dm ON dm.id = ctm.don_mua_hang_id
            WHERE dm.trang_thai IN (3, 5) AND dm.kho_nhap_id = :khoId
              AND ctm.so_luong_dat > COALESCE(ctm.so_luong_da_nhan, 0)
              AND ctm.bien_the_san_pham_id IN (:ids)
            GROUP BY ctm.bien_the_san_pham_id
            """;

    /** Phần chưa nhận của đơn mua đã chốt về kho, theo mã hàng. */
    public Map<Integer, Long> dangVeTheoBienThe(Integer khoId, Collection<Integer> bienTheIds) {
        Map<Integer, Long> ketQua = new HashMap<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        jdbc.query(SQL_DANG_VE_THEO_BIEN_THE, thamSo(khoId).addValue("ids", bienTheIds),
                rs -> { ketQua.put(rs.getInt("bien_the_id"), so(rs, "dang_ve")); });
        return ketQua;
    }

    /* ======================================================================
     * NHÂN VIÊN BÁN HÀNG
     * ====================================================================== */

    /** Đơn bán mới của kho trong [tu, den] được tạo từ quầy POS (bảng pos_checkout_request có thể chưa có). */
    public long demDonTaiQuay(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        if (!admin.coBang("pos_checkout_request")) return 0;
        return dem("""
                SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
                  AND d.ngay_dat_hang >= :tu AND d.ngay_dat_hang <= :den AND d.kho_xuat_id = :khoId
                  AND EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = d.id)
                """, thamSo(khoId).addValue("tu", admin.mocUngDung(tu)).addValue("den", admin.mocUngDung(den)));
    }

    private static final String DK_DON_CUA_TOI = "d.loai_chung_tu = 'don_ban_hang' AND d.nguoi_tao_id = :nguoiDungId"
            + " AND d.trang_thai IN (0, 1, 7, 8, 2)";
    private static final String CHU_Y_DON = "CASE WHEN d.trang_thai = 0 THEN 'nhap'"
            + " WHEN d.ngay_dat_hang < :mocChoLau THEN 'cho_lau' END";

    static final String SQL_DON_CUA_TOI = """
            SELECT d.id, d.so_don_hang AS ma, COALESCE(kh.ten_khach_hang, kb.ten_kenh) AS khach,
                   d.tong_cong, d.trang_thai,
                   DATE_FORMAT(DATE_ADD(d.ngay_dat_hang, INTERVAL :lech MINUTE), %s) AS ngay_dat,
                   %s AS chu_y
            FROM don_ban_hang d
            LEFT JOIN khach_hang kh    ON kh.id = d.khach_hang_id
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            WHERE %s
            ORDER BY (%s) IS NULL, d.ngay_dat_hang DESC, d.id DESC
            LIMIT :soDong
            """.formatted(THOI_DIEM, CHU_Y_DON, DK_DON_CUA_TOI, CHU_Y_DON);

    /** Đơn bán do người dùng tạo còn chưa xong: cần chú ý (nháp, chờ lâu) trước, rồi mới nhất trước. */
    public List<DonCuaToi> donCuaToi(Integer nguoiDungId, LocalDateTime mocChoLau, int soDong) {
        MapSqlParameterSource p = thamSoGio(null).addValue("nguoiDungId", nguoiDungId)
                .addValue("mocChoLau", admin.mocUngDung(mocChoLau)).addValue("soDong", soDong);
        return jdbc.query(SQL_DON_CUA_TOI, p, (rs, i) -> new DonCuaToi(rs.getInt("id"), rs.getString("ma"),
                rs.getString("khach"), so(rs, "tong_cong"), rs.getInt("trang_thai"), rs.getString("ngay_dat"),
                rs.getString("chu_y")));
    }

    static final String SQL_DON_CUA_TOI_TOM = """
            SELECT COUNT(*) AS tong,
                   COALESCE(SUM(CASE WHEN (%s) IS NOT NULL THEN 1 ELSE 0 END), 0) AS can_chu_y,
                   COALESCE(SUM(d.tong_cong), 0) AS gia_tri
            FROM don_ban_hang d
            WHERE %s
            """.formatted(CHU_Y_DON, DK_DON_CUA_TOI);

    public DonCuaToiTom donCuaToiTom(Integer nguoiDungId, LocalDateTime mocChoLau) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("nguoiDungId", nguoiDungId)
                .addValue("mocChoLau", admin.mocUngDung(mocChoLau));
        return jdbc.queryForObject(SQL_DON_CUA_TOI_TOM, p, (rs, i) -> new DonCuaToiTom(rs.getLong("tong"),
                rs.getLong("can_chu_y"), so(rs, "gia_tri")));
    }

    static final String SQL_BAO_GIA_CUA_TOI = """
            SELECT d.id, d.so_don_hang AS ma, COALESCE(kh.ten_khach_hang, kb.ten_kenh) AS khach, d.tong_cong,
                   DATE_FORMAT(DATE_ADD(d.ngay_tao, INTERVAL :lechCsdl MINUTE), %s) AS ngay_tao,
                   CASE WHEN d.ngay_tao < :mocQuaHanCsdl THEN 1 ELSE 0 END          AS qua_han
            FROM don_ban_hang d
            LEFT JOIN khach_hang kh    ON kh.id = d.khach_hang_id
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            WHERE d.loai_chung_tu = 'bao_gia' AND d.nguoi_tao_id = :nguoiDungId AND d.trang_thai = 0
            ORDER BY d.ngay_tao IS NULL, d.ngay_tao, d.id
            LIMIT :soDong
            """.formatted(THOI_DIEM);

    /** Báo giá do người dùng tạo đang chờ khách phản hồi, cũ trước; quá hạn = tạo trước mocQuaHan. */
    public List<BaoGiaCuaToi> baoGiaCuaToi(Integer nguoiDungId, LocalDateTime mocQuaHan, int soDong) {
        MapSqlParameterSource p = thamSoGio(null).addValue("nguoiDungId", nguoiDungId)
                .addValue("mocQuaHanCsdl", admin.mocTuDien(mocQuaHan)).addValue("soDong", soDong);
        return jdbc.query(SQL_BAO_GIA_CUA_TOI, p, (rs, i) -> new BaoGiaCuaToi(rs.getInt("id"), rs.getString("ma"),
                rs.getString("khach"), so(rs, "tong_cong"), rs.getString("ngay_tao"), rs.getInt("qua_han") == 1));
    }

    /* ======================================================================
     * TRA TỒN
     * ====================================================================== */

    static final String SQL_TIM_SAN_PHAM = """
            SELECT sp.id, sp.ma_san_pham, sp.ten_san_pham
            FROM san_pham_quan_ao sp
            WHERE sp.trang_thai IN (0, 1)
              AND EXISTS (SELECT 1 FROM bien_the_san_pham bt0 WHERE bt0.san_pham_id = sp.id AND bt0.trang_thai = 1)
              AND (REPLACE(LOWER(sp.ten_san_pham), :dd, 'd') LIKE :mau
                   OR LOWER(sp.ma_san_pham) LIKE :mau
                   OR EXISTS (SELECT 1 FROM bien_the_san_pham bt
                               WHERE bt.san_pham_id = sp.id AND bt.trang_thai = 1 AND LOWER(bt.ma_sku) LIKE :mau))
            ORDER BY LOWER(sp.ma_san_pham) = :tu DESC, sp.ten_san_pham, sp.id
            LIMIT :soDong
            """;

    /**
     * Sản phẩm đang kinh doanh (kể cả đang "Hết hàng", để tra ra được là hết) khớp tên, mã sản phẩm hoặc mã SKU.
     * Không phân biệt hoa thường và dấu (theo collation
     * utf8mb4_unicode_ci; riêng "đ" được đổi thành "d" ở cả hai phía).
     *
     * @param tuKhoa đã chuẩn hóa: chữ thường, "đ" → "d", đã thoát ký tự đặc biệt của LIKE
     * @param tuKhoaGoc chữ thường, chưa thoát (để xếp sản phẩm trùng mã lên đầu)
     */
    public List<SanPhamTim> timSanPham(String tuKhoa, String tuKhoaGoc, int soDong) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("dd", "đ").addValue("mau", "%" + tuKhoa + "%").addValue("tu", tuKhoaGoc)
                .addValue("soDong", soDong);
        return jdbc.query(SQL_TIM_SAN_PHAM, p, (rs, i) -> new SanPhamTim(rs.getInt("id"),
                rs.getString("ma_san_pham"), rs.getString("ten_san_pham")));
    }

    static final String SQL_TON_BIEN_THE = """
            SELECT bt.id, bt.san_pham_id, bt.ma_sku, bt.gia_ban, ms.ten_mau, sz.ten_size,
                   COALESCE((SELECT SUM(tk.so_luong_kha_dung) FROM ton_kho_theo_lo tk
                              JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                             WHERE lh.bien_the_san_pham_id = bt.id AND tk.kho_id = :khoId), 0)  AS tai_kho,
                   COALESCE((SELECT SUM(GREATEST(x.kha_dung, 0)) FROM (
                               SELECT lh.bien_the_san_pham_id AS bien_the_id, SUM(tk.so_luong_kha_dung) AS kha_dung
                                 FROM ton_kho_theo_lo tk
                                 JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                                 JOIN kho k ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                                WHERE tk.kho_id <> :khoId
                                  AND lh.bien_the_san_pham_id IN (SELECT b2.id FROM bien_the_san_pham b2
                                                                   WHERE b2.san_pham_id IN (:ids))
                                GROUP BY lh.bien_the_san_pham_id, tk.kho_id) x
                             WHERE x.bien_the_id = bt.id), 0)                                    AS kho_khac,
                   COALESCE((SELECT SUM(ct.so_luong_xuat) FROM phieu_xuat_kho px
                              JOIN phieu_xuat_kho pck ON pck.id = px.parent_id
                              JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = px.id AND ct.lo_hang_id IS NOT NULL
                             WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3 AND pck.trang_thai = 3
                               AND pck.kho_chuyen_den_id = :khoId AND ct.bien_the_san_pham_id = bt.id), 0)
                 + COALESCE((SELECT SUM(ctm.so_luong_dat - COALESCE(ctm.so_luong_da_nhan, 0))
                               FROM chi_tiet_don_mua_hang ctm
                               JOIN don_mua_hang dm ON dm.id = ctm.don_mua_hang_id
                              WHERE dm.trang_thai IN (3, 5) AND dm.kho_nhap_id = :khoId
                                AND ctm.bien_the_san_pham_id = bt.id
                                AND ctm.so_luong_dat > COALESCE(ctm.so_luong_da_nhan, 0)), 0)  AS dang_ve
            FROM bien_the_san_pham bt
            LEFT JOIN mau_sac ms ON ms.id = bt.mau_sac_id
            LEFT JOIN size sz    ON sz.id = bt.size_id
            WHERE bt.san_pham_id IN (:ids) AND bt.trang_thai = 1
            ORDER BY bt.san_pham_id, ms.ten_mau, sz.thu_tu_sap_xep, sz.ten_size, bt.id
            """;

    /**
     * Biến thể đang bán của các sản phẩm, với khả dụng (tồn − đang giữ, cùng công thức với danh mục bán tại quầy
     * PosCatalogService) ở kho làm việc, cộng các kho khác (kho âm tính 0, không trừ vào kho khác) và hàng đang về kho
     * (phiếu chuyển đang vận chuyển đến + đơn mua đang về).
     */
    public List<BienTheTim> tonBienThe(Integer khoId, Collection<Integer> sanPhamIds) {
        if (sanPhamIds == null || sanPhamIds.isEmpty()) return List.of();
        return jdbc.query(SQL_TON_BIEN_THE, thamSo(khoId).addValue("ids", sanPhamIds), (rs, i) -> new BienTheTim(
                rs.getInt("san_pham_id"), rs.getBigDecimal("gia_ban"),
                new TraTonBienThe(rs.getInt("id"), rs.getString("ma_sku"), rs.getString("ten_mau"),
                        rs.getString("ten_size"), Math.max(0, so(rs, "tai_kho")), Math.max(0, so(rs, "kho_khac")),
                        Math.max(0, so(rs, "dang_ve")))));
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    private long dem(String sql, MapSqlParameterSource p) {
        Long n = jdbc.queryForObject(sql, p, Long.class);
        return n == null ? 0 : n;
    }

    private static MapSqlParameterSource thamSo(Integer khoId) {
        return new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER);
    }

    /** Kho và độ lệch giờ để đọc cột thời gian ra giờ Việt Nam. */
    private MapSqlParameterSource thamSoGio(Integer khoId) {
        return thamSo(khoId).addValue("lech", admin.lechUngDung()).addValue("lechCsdl", admin.lechTuDien());
    }

    /** Tham số chung cho danh sách việc: mốc chờ lâu cho cả cột ứng dụng ghi và cột MySQL tự điền. */
    private MapSqlParameterSource thamSoViec(Integer khoId, LocalDateTime mocChoLau, int soDong) {
        return thamSoGio(khoId)
                .addValue("mocChoLau", admin.mocUngDung(mocChoLau))
                .addValue("mocChoLauCsdl", admin.mocTuDien(mocChoLau))
                .addValue("soDong", soDong);
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Số lượng / tiền làm tròn về số nguyên (như TongQuanAdminServiceImpl.so). */
    private static long so(ResultSet rs, String cot) throws SQLException {
        return bd(rs, cot).setScale(0, RoundingMode.HALF_UP).longValue();
    }
}
