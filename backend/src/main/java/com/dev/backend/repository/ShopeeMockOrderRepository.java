package com.dev.backend.repository;

import com.dev.backend.entities.ShopeeMockOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopeeMockOrderRepository extends JpaRepository<ShopeeMockOrder, Integer> {

    Optional<ShopeeMockOrder> findByOrderSn(String orderSn);

    List<ShopeeMockOrder> findAllByOrderByCreateTimeDesc();

    List<ShopeeMockOrder> findByOrderStatusOrderByCreateTimeDesc(String orderStatus);

    List<ShopeeMockOrder> findByCreateTimeGreaterThanEqual(Long createTime);
}
