package com.dev.backend.repository;

import com.dev.backend.entities.ThongTinCongTy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ThongTinCongTyRepository extends JpaRepository<ThongTinCongTy, Integer> {
}
