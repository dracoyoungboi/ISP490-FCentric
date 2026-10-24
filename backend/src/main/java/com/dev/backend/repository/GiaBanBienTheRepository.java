package com.dev.backend.repository;

import com.dev.backend.entities.BienTheSanPham;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

/**
 * Truy vấn của màn "Giá bán & tem mã vạch" và hộp In tem. Danh sách phân trang theo SẢN PHẨM: lấy trang id sản phẩm
 * trước, rồi lấy biến thể, tồn, lần đổi giá gần nhất của cả trang bằng truy vấn IN (không N+1).
 * <p>
 * Bộ lọc dùng chung ({@link #LOC}, {@link #THEO_TAB}):
 * <ul>
 *   <li>{@code tuKhoa}: đã thoát % _ ! (escape '!'), null = không lọc; khớp tên / mã sản phẩm hoặc SKU / mã vạch.</li>
 *   <li>{@code canXuLy}: chỉ biến thể đang hoạt động có giá bán trống, ≤ 0 hoặc thấp hơn giá vốn.</li>
 *   <li>{@code tab}: "tat-ca" | "hoat-dong" (trang_thai = 1) | "ngung-hoat-dong" (khác 1).</li>
 * </ul>
 */
public interface GiaBanBienTheRepository extends org.springframework.data.repository.Repository<BienTheSanPham, Integer> {

    String KHOP_TEN = " (LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!'"
            + " OR LOWER(sp.maSanPham) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!') ";

    String LOC = " (:tuKhoa IS NULL OR" + KHOP_TEN
            + " OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!'"
            + " OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!')"
            + " AND (:canXuLy = false OR (bt.trangThai = 1"
            + " AND (bt.giaBan IS NULL OR bt.giaBan <= 0 OR bt.giaBan < bt.giaVon))) ";

    String THEO_TAB = " (:tab = 'tat-ca'"
            + " OR (:tab = 'hoat-dong' AND bt.trangThai = 1)"
            + " OR (:tab = 'ngung-hoat-dong' AND (bt.trangThai IS NULL OR bt.trangThai <> 1))) ";

    /** Trang id sản phẩm có ít nhất một biến thể khớp bộ lọc, sản phẩm mới tạo lên trước (thứ tự cố định ở đây). */
    @Query(value = "SELECT sp.id FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB
            + " GROUP BY sp.id, sp.ngayTao ORDER BY sp.ngayTao DESC, sp.id DESC",
            countQuery = "SELECT COUNT(DISTINCT sp.id) FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB)
    Page<Integer> trangSanPhamId(@Param("tuKhoa") String tuKhoa,
                                 @Param("canXuLy") boolean canXuLy,
                                 @Param("tab") String tab,
                                 Pageable pageable);

    /**
     * Biến thể khớp bộ lọc của các sản phẩm trong trang, nạp sẵn sản phẩm, màu, kích cỡ và ảnh biến thể (quan hệ một-một
     * phía không giữ khóa luôn được nạp; không gộp vào đây thì mỗi dòng thêm một truy vấn); xếp theo màu rồi thứ tự kích cỡ.
     */
    @Query("SELECT bt FROM BienTheSanPham bt JOIN FETCH bt.sanPham sp JOIN FETCH bt.mauSac ms JOIN FETCH bt.size s"
            + " LEFT JOIN FETCH bt.anhBienThe abt LEFT JOIN FETCH abt.tepTin"
            + " WHERE sp.id IN :sanPhamIds AND " + LOC + " AND " + THEO_TAB
            + " ORDER BY ms.tenMau, ms.id, s.thuTuSapXep, s.id, bt.id")
    List<BienTheSanPham> bienTheKhopLoc(@Param("sanPhamIds") Collection<Integer> sanPhamIds,
                                        @Param("tuKhoa") String tuKhoa,
                                        @Param("canXuLy") boolean canXuLy,
                                        @Param("tab") String tab);

    /** Sản phẩm (trong danh sách) có tên hoặc mã khớp từ khóa: khớp tên thì trả đủ biến thể, không tự mở nhóm. */
    @Query("SELECT sp.id FROM SanPhamQuanAo sp WHERE sp.id IN :sanPhamIds AND " + KHOP_TEN)
    List<Integer> sanPhamKhopTen(@Param("sanPhamIds") Collection<Integer> sanPhamIds, @Param("tuKhoa") String tuKhoa);

    /** [sanPhamId, số biến thể] — tổng phân loại của sản phẩm, không phụ thuộc bộ lọc. */
    @Query("SELECT bt.sanPham.id, COUNT(bt.id) FROM BienTheSanPham bt WHERE bt.sanPham.id IN :sanPhamIds GROUP BY bt.sanPham.id")
    List<Object[]> demPhanLoai(@Param("sanPhamIds") Collection<Integer> sanPhamIds);

    /** Số biến thể khớp bộ lọc trên mọi trang. */
    @Query("SELECT COUNT(bt.id) FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB)
    long demSku(@Param("tuKhoa") String tuKhoa, @Param("canXuLy") boolean canXuLy, @Param("tab") String tab);

    /** [tổng, đang hoạt động] theo từ khóa và bộ lọc cần xử lý giá (không theo tab); ngừng = tổng − đang hoạt động. */
    @Query("SELECT COUNT(bt.id), COALESCE(SUM(CASE WHEN bt.trangThai = 1 THEN 1 ELSE 0 END), 0)"
            + " FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC)
    List<Object[]> demTheoTab(@Param("tuKhoa") String tuKhoa, @Param("canXuLy") boolean canXuLy);

    /** [chưa có giá, dưới giá vốn] của biến thể đang hoạt động trên toàn hệ thống. */
    @Query("""
            SELECT COALESCE(SUM(CASE WHEN bt.trangThai = 1 AND (bt.giaBan IS NULL OR bt.giaBan <= 0) THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN bt.trangThai = 1 AND bt.giaBan > 0 AND bt.giaBan < bt.giaVon THEN 1 ELSE 0 END), 0)
            FROM BienTheSanPham bt
            """)
    List<Object[]> demCanXuLy();

    /** [bienTheId, tổng so_luong_ton mọi kho]; biến thể không có dòng nào hiểu là tồn 0. */
    @Query("SELECT lh.bienTheSanPham.id, SUM(tk.soLuongTon) FROM TonKhoTheoLo tk JOIN tk.loHang lh"
            + " WHERE lh.bienTheSanPham.id IN :bienTheIds GROUP BY lh.bienTheSanPham.id")
    List<Object[]> tonKho(@Param("bienTheIds") Collection<Integer> bienTheIds);

    /** [bienTheId, lần đổi giá bán gần nhất]. */
    @Query("SELECT l.idThamChieu, MAX(l.ngayThucHien) FROM LichSuThayDoi l"
            + " WHERE l.loaiThamChieu = 'bien_the_san_pham' AND l.hanhDong = 'doi_gia_ban' AND l.idThamChieu IN :bienTheIds"
            + " GROUP BY l.idThamChieu")
    List<Object[]> lanDoiGiaGanNhat(@Param("bienTheIds") Collection<Integer> bienTheIds);

    /**
     * Khóa các biến thể sắp đổi giá (thứ tự id cố định, tránh khóa chéo): hai người đổi cùng lúc thì người sau đọc giá
     * người trước vừa lưu, lịch sử ghi đúng giá cũ.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT bt FROM BienTheSanPham bt LEFT JOIN FETCH bt.anhBienThe WHERE bt.id IN :ids ORDER BY bt.id")
    List<BienTheSanPham> khoaTheoIds(@Param("ids") Collection<Integer> ids);

    /** Biến thể kèm sản phẩm, màu, kích cỡ để dựng dòng in tem. */
    @Query("SELECT bt FROM BienTheSanPham bt JOIN FETCH bt.sanPham JOIN FETCH bt.mauSac JOIN FETCH bt.size"
            + " LEFT JOIN FETCH bt.anhBienThe WHERE bt.id IN :ids")
    List<BienTheSanPham> bienTheInTem(@Param("ids") Collection<Integer> ids);

    /** Quét mã ở hộp In tem: khớp CHÍNH XÁC mã vạch hoặc SKU (không phân biệt hoa thường), mã vạch ưu tiên trước. */
    @Query("""
            SELECT bt FROM BienTheSanPham bt JOIN FETCH bt.sanPham JOIN FETCH bt.mauSac JOIN FETCH bt.size
            LEFT JOIN FETCH bt.anhBienThe
            WHERE LOWER(bt.maVachSku) = LOWER(:ma) OR LOWER(bt.maSku) = LOWER(:ma)
            ORDER BY CASE WHEN LOWER(bt.maVachSku) = LOWER(:ma) THEN 0 ELSE 1 END, bt.id
            """)
    List<BienTheSanPham> timTheoMa(@Param("ma") String ma);

    /**
     * Ghi riêng cột giá bán mặc định của sản phẩm sau khi đổi giá: không UPDATE cả dòng sản phẩm đã nạp, để khỏi đè
     * trạng thái / giá vốn mặc định mà giao dịch hoàn tất phiếu chạy cùng lúc vừa tính lại.
     */
    @Modifying
    @Query("UPDATE SanPhamQuanAo s SET s.giaBanMacDinh = :gia WHERE s.id = :id")
    int capNhatGiaBanMacDinh(@Param("id") Integer id, @Param("gia") BigDecimal gia);
}
