package com.dev.backend.repository;

import com.dev.backend.entities.BienBanTraHangNcc;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BienBanTraHangNccRepository extends JpaRepository<BienBanTraHangNcc, Integer> {
    Optional<BienBanTraHangNcc> findByPhieuNhapKho_Id(Integer phieuNhapKhoId);

    /** Khóa biên bản (SELECT … FOR UPDATE): ghi đã ký, nhà cung cấp trả lời, giao trả, tiêu hủy cùng lúc chạy tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BienBanTraHangNcc b WHERE b.id = :id")
    Optional<BienBanTraHangNcc> khoaTheoId(@Param("id") Integer id);

    /**
     * Biên bản cho danh sách trả hàng nhà cung cấp: bỏ qua bộ lọc null. Lọc kho theo phạm vi người dùng làm ở service.
     * Chỉ biên bản của phiếu nhập từ đơn mua.
     */
    @Query("SELECT b FROM BienBanTraHangNcc b JOIN FETCH b.phieuNhapKho p JOIN FETCH p.kho JOIN FETCH b.nhaCungCap "
            + "LEFT JOIN FETCH p.donMuaHang d LEFT JOIN FETCH b.nguoiTao LEFT JOIN FETCH p.nguoiNhap "
            + "WHERE p.donMuaHang IS NOT NULL "
            + "AND (:nhaCungCapId IS NULL OR b.nhaCungCap.id = :nhaCungCapId) "
            + "AND (:donMuaHangId IS NULL OR d.id = :donMuaHangId) "
            + "ORDER BY b.ngayTao DESC, b.id DESC")
    List<BienBanTraHangNcc> timChoDanhSach(@Param("nhaCungCapId") Integer nhaCungCapId,
                                          @Param("donMuaHangId") Integer donMuaHangId);

    /** Biên bản của các nhà cung cấp (cổng nhà cung cấp: mọi nhà cung cấp dùng chung email đăng nhập), mới trước. */
    @Query("SELECT b FROM BienBanTraHangNcc b JOIN FETCH b.phieuNhapKho p JOIN FETCH p.kho JOIN FETCH b.nhaCungCap "
            + "LEFT JOIN FETCH p.donMuaHang d LEFT JOIN FETCH b.nguoiTao LEFT JOIN FETCH p.nguoiNhap "
            + "WHERE p.donMuaHang IS NOT NULL AND b.nhaCungCap.id IN :nhaCungCapIds "
            + "ORDER BY b.ngayTao DESC, b.id DESC")
    List<BienBanTraHangNcc> timTheoNhaCungCap(@Param("nhaCungCapIds") java.util.Collection<Integer> nhaCungCapIds);

    /** Số biên bản đã cấp có tiền tố (theo ngày), để cấp số tiếp theo. */
    @Query("SELECT b.maBienBan FROM BienBanTraHangNcc b WHERE b.maBienBan LIKE CONCAT(:tienTo, '%')")
    List<String> findMaBienBanTheoTienTo(@Param("tienTo") String tienTo);

    /**
     * Biên bản còn hiệu lực của phiếu nhập đã hoàn tất thuộc một đơn mua, cũ trước; khóa để đóng đơn chạy tuần tự với câu
     * trả lời của nhà cung cấp (đóng đơn khóa dòng đơn → đơn → các biên bản này).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BienBanTraHangNcc b WHERE b.phieuNhapKho.donMuaHang.id = :donId "
            + "AND b.phieuNhapKho.trangThai = 3 AND b.trangThai <> 'DA_HUY' ORDER BY b.id")
    List<BienBanTraHangNcc> khoaTheoDonMua(@Param("donId") Integer donId);

    /** Biên bản còn hiệu lực có việc có thể đang chờ nhà cung cấp: cách bù chưa chọn hoặc hàng lỗi còn ở kho. */
    @Query("SELECT b FROM BienBanTraHangNcc b JOIN FETCH b.phieuNhapKho p LEFT JOIN FETCH p.donMuaHang "
            + "WHERE b.trangThai = 'CHO_TRA_HANG' "
            + "OR (b.trangThai <> 'DA_HUY' AND (b.phuongAnXuLy IS NULL OR b.phuongAnXuLy = 'CHO_CHOT'))")
    List<BienBanTraHangNcc> timDangChoXuLy();
}
