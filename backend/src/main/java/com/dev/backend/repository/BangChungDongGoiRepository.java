package com.dev.backend.repository;

import com.dev.backend.entities.BangChungDongGoi;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BangChungDongGoiRepository extends JpaRepository<BangChungDongGoi, Integer> {

    List<BangChungDongGoi> findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(Integer donBanHangId, Integer trangThai);

    List<BangChungDongGoi> findByDonBanHangIdAndTrangThai(Integer donBanHangId, Integer trangThai);

    // Ba câu dưới đọc thẳng CSDL (chỉ lấy cột, không lấy thực thể): open-in-view giữ thực thể đã nạp suốt request, nên
    // findById giữa chừng trả bản cũ — dùng để kiểm lại trạng thái sau khi tải tệp lên MinIO (có thể mất cả phút)
    @Query("select d.trangThai from DonBanHang d where d.id = :id")
    Integer docTrangThaiDon(@Param("id") Integer donBanHangId);

    @Query("select p.trangThai from PhieuXuatKho p where p.donBanHang.id = :id")
    List<Integer> docTrangThaiPhieuCuaDon(@Param("id") Integer donBanHangId);

    @Query("select p.trangThai from BangChungDongGoi b join b.phieuXuatKho p where b.id = :id")
    Integer docTrangThaiPhieuCuaBangChung(@Param("id") Integer bangChungId);

    List<BangChungDongGoi> findByPhieuXuatKhoIdAndTrangThai(Integer phieuXuatKhoId, Integer trangThai);

    List<BangChungDongGoi> findByDanhSachNhatHangIdAndTrangThai(Integer pickListId, Integer trangThai);

    Optional<BangChungDongGoi> findByDonBanHangIdAndLoaiBangChungAndTrangThai(Integer donBanHangId, String loaiBangChung, Integer trangThai);

    /**
     * Lô tệp đang lưu đã qua cả hai mốc hạn lưu (ngay_het_han và ngày tạo + số ngày lưu, xem
     * BangChungDongGoiServiceImpl.hanLuuThucTe) để PackingProofCleanupJob dọn. Nạp kèm tep_tin: job chạy ngoài giao dịch,
     * đọc tên tệp qua proxy LAZY sẽ lỗi LazyInitializationException và tệp trên MinIO không bị xóa.
     */
    @EntityGraph(attributePaths = "tepTin")
    List<BangChungDongGoi> findTop100ByTrangThaiAndNgayHetHanBeforeAndNgayTaoBeforeOrderByIdAsc(
            Integer trangThai, Instant hetHanTruoc, Instant taoTruoc);

    /**
     * Kéo hạn lưu các tệp đang lưu của đơn tới `han` (chỉ kéo dài, tệp đã có hạn muộn hơn giữ nguyên). Thực thể bằng
     * chứng đã nạp trong cùng phiên vẫn giữ hạn cũ — nơi gọi không sửa rồi lưu lại các thực thể đó sau lời gọi này.
     */
    @Modifying(flushAutomatically = true)
    @Query("update BangChungDongGoi b set b.ngayHetHan = :han where b.donBanHang.id = :donId and b.trangThai = 1 and b.ngayHetHan < :han")
    int keoDaiHanLuu(@Param("donId") Integer donBanHangId, @Param("han") Instant han);

    List<BangChungDongGoi> findByDonBanHangIdInAndTrangThai(Collection<Integer> donBanHangIds, Integer trangThai);
}
