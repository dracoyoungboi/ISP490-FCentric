package com.dev.backend.repository;

import com.dev.backend.entities.ShopeeMockProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopeeMockProductRepository extends JpaRepository<ShopeeMockProduct, Integer> {

    Optional<ShopeeMockProduct> findByModelSku(String modelSku);

    Optional<ShopeeMockProduct> findByItemIdAndModelId(Long itemId, Long modelId);

    List<ShopeeMockProduct> findAllByTrangThai(String trangThai);
}
