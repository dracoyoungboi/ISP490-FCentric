package com.dev.backend.repository;

import com.dev.backend.entities.BienTheSanPham;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Truy vấn của màn "Tem mã vạch", hộp In tem và thanh "Cần xử lý giá" ở Danh sách sản phẩm. Danh sách phân trang theo SẢN PHẨM: lấy trang id sản phẩm
 * trước, rồi lấy biến thể, lần đổi giá gần nhất của cả trang bằng truy vấn IN (không N+1).
 * <p>
 * Bộ lọc dùng chung ({@link #LOC}, {@link #THEO_TAB}):
 * <ul>
 *   <li>{@code tuKhoa}: đã thoát % _ ! (escape '!'), null = không lọc; khớp tên / mã sản phẩm hoặc SKU / mã vạch.</li>
 *   <li>{@code tab}: "tat-ca" | "doi-gia" (đổi giá bán từ {@code tuLuc}, có giá cũ) | "chua-gia" (giá trống / ≤ 0)
 *   | "thieu-ma" (mã vạch trống). Mọi tab chỉ lấy biến thể đang hoạt động: SKU ngừng không in tem.</li>
 *   <li>{@code tuLuc}: mốc "đổi giá gần đây" (tab doi-gia); các tab khác vẫn phải truyền.</li>
 * </ul>
 */
public interface GiaBanBienTheRepository extends org.springframework.data.repository.Repository<BienTheSanPham, Integer> {

    String KHOP_TEN = " (LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!'"
            + " OR LOWER(sp.maSanPham) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!') ";

    String LOC = " (:tuKhoa IS NULL OR" + KHOP_TEN
            + " OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!'"
            + " OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) ESCAPE '!') ";

    /**
     * Lần đổi giá bán (form Sửa sản phẩm) của biến thể {@code bt} từ {@code :tuLuc}, có giá cũ lớn hơn 0: tem đang dán
     * còn giá cũ. Đặt giá lần đầu (giá cũ trống / 0) chưa có tem nào để in lại.
     */
    String DOI_GIA_GAN_DAY = " EXISTS (SELECT 1 FROM LichSuThayDoi ls WHERE ls.loaiThamChieu = 'bien_the_san_pham'"
            + " AND ls.idThamChieu = bt.id AND ls.hanhDong = 'doi_gia_ban' AND ls.ngayThucHien >= :tuLuc"
            + " AND ls.giaTriCu <> '{\"giaBan\":null}' AND ls.giaTriCu <> '{\"giaBan\":0}') ";

    String THEO_TAB = " bt.trangThai = 1 AND (:tab = 'tat-ca'"
            + " OR (:tab = 'doi-gia' AND" + DOI_GIA_GAN_DAY + ")"
            + " OR (:tab = 'chua-gia' AND (bt.giaBan IS NULL OR bt.giaBan <= 0))"
            + " OR (:tab = 'thieu-ma' AND (bt.maVachSku IS NULL OR TRIM(bt.maVachSku) = ''))) ";

    /** Trang id sản phẩm có ít nhất một biến thể khớp bộ lọc, sản phẩm mới tạo lên trước (thứ tự cố định ở đây). */
    @Query(value = "SELECT sp.id FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB
            + " GROUP BY sp.id, sp.ngayTao ORDER BY sp.ngayTao DESC, sp.id DESC",
            countQuery = "SELECT COUNT(DISTINCT sp.id) FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB)
    Page<Integer> trangSanPhamId(@Param("tuKhoa") String tuKhoa,
                                 @Param("tab") String tab,
                                 @Param("tuLuc") Instant tuLuc,
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
                                        @Param("tab") String tab,
                                        @Param("tuLuc") Instant tuLuc);

    /** Sản phẩm (trong danh sách) có tên hoặc mã khớp từ khóa: khớp tên thì trả đủ biến thể, không tự mở nhóm. */
    @Query("SELECT sp.id FROM SanPhamQuanAo sp WHERE sp.id IN :sanPhamIds AND " + KHOP_TEN)
    List<Integer> sanPhamKhopTen(@Param("sanPhamIds") Collection<Integer> sanPhamIds, @Param("tuKhoa") String tuKhoa);

    /** [sanPhamId, số biến thể] — tổng phân loại của sản phẩm, không phụ thuộc bộ lọc. */
    @Query("SELECT bt.sanPham.id, COUNT(bt.id) FROM BienTheSanPham bt WHERE bt.sanPham.id IN :sanPhamIds GROUP BY bt.sanPham.id")
    List<Object[]> demPhanLoai(@Param("sanPhamIds") Collection<Integer> sanPhamIds);

    /** Số biến thể khớp bộ lọc trên mọi trang. */
    @Query("SELECT COUNT(bt.id) FROM BienTheSanPham bt JOIN bt.sanPham sp WHERE " + LOC + " AND " + THEO_TAB)
    long demSku(@Param("tuKhoa") String tuKhoa, @Param("tab") String tab, @Param("tuLuc") Instant tuLuc);

    /** [chưa có giá, dưới giá vốn] của biến thể đang hoạt động trên toàn hệ thống. */
    @Query("""
            SELECT COALESCE(SUM(CASE WHEN bt.trangThai = 1 AND (bt.giaBan IS NULL OR bt.giaBan <= 0) THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN bt.trangThai = 1 AND bt.giaBan > 0 AND bt.giaBan < bt.giaVon THEN 1 ELSE 0 END), 0)
            FROM BienTheSanPham bt
            """)
    List<Object[]> demCanXuLy();

    /**
     * [bienTheId, giá trị cũ (JSON {"giaBan":…}), lúc đổi] của các lần đổi giá bán từ {@code tuLuc} có giá cũ, mới nhất
     * trước: lấy dòng đầu của mỗi biến thể làm "giá trước lần đổi gần nhất".
     */
    @Query("SELECT ls.idThamChieu, ls.giaTriCu, ls.ngayThucHien FROM LichSuThayDoi ls"
            + " WHERE ls.loaiThamChieu = 'bien_the_san_pham' AND ls.hanhDong = 'doi_gia_ban'"
            + " AND ls.idThamChieu IN :bienTheIds AND ls.ngayThucHien >= :tuLuc"
            + " AND ls.giaTriCu <> '{\"giaBan\":null}' AND ls.giaTriCu <> '{\"giaBan\":0}'"
            + " ORDER BY ls.ngayThucHien DESC, ls.id DESC")
    List<Object[]> doiGiaGanDay(@Param("bienTheIds") Collection<Integer> bienTheIds, @Param("tuLuc") Instant tuLuc);

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
}
