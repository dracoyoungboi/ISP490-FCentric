package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKeKhoaLo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DotKiemKeKhoaLoRepository extends JpaRepository<DotKiemKeKhoaLo, Long> {

    List<DotKiemKeKhoaLo> findByDotKiemKeIdAndTrangThaiKhoa(Integer dotKiemKeId, Integer trangThaiKhoa);

    Optional<DotKiemKeKhoaLo> findByDotKiemKeIdAndViTriKhoIdAndLoHangId(Integer dotKiemKeId, Integer viTriKhoId, Integer loHangId);
}
