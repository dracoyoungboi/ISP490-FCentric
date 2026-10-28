package com.dev.backend.repository;

import com.dev.backend.entities.BangChungDongGoi;
import org.springframework.data.jpa.repository.JpaRepository;
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

    List<BangChungDongGoi> findTop100ByTrangThaiAndNgayTaoBefore(Integer trangThai, Instant threshold);

    List<BangChungDongGoi> findByDonBanHangIdInAndTrangThai(Collection<Integer> donBanHangIds, Integer trangThai);
}
