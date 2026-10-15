package com.dev.backend.repository;

import com.dev.backend.entities.BangChungDongGoi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BangChungDongGoiRepository extends JpaRepository<BangChungDongGoi, Integer> {

    List<BangChungDongGoi> findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(Integer donBanHangId, Integer trangThai);

    List<BangChungDongGoi> findByPhieuXuatKhoIdAndTrangThai(Integer phieuXuatKhoId, Integer trangThai);

    List<BangChungDongGoi> findByDanhSachNhatHangIdAndTrangThai(Integer pickListId, Integer trangThai);

    Optional<BangChungDongGoi> findByDonBanHangIdAndLoaiBangChungAndTrangThai(Integer donBanHangId, String loaiBangChung, Integer trangThai);

    List<BangChungDongGoi> findTop100ByTrangThaiAndNgayTaoBefore(Integer trangThai, Instant threshold);

    List<BangChungDongGoi> findByDonBanHangIdInAndTrangThai(Collection<Integer> donBanHangIds, Integer trangThai);
}
