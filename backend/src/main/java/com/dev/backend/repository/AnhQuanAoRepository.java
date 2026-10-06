package com.dev.backend.repository;

import com.dev.backend.entities.AnhQuanAo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AnhQuanAoRepository extends JpaRepository<AnhQuanAo, Integer>, JpaSpecificationExecutor<AnhQuanAo> {

    /** Ảnh sản phẩm đang hoạt động cho một trang catalog (fallback ảnh biến thể) — 1 query batch. */
    @Query("select aq from AnhQuanAo aq join fetch aq.tepTin " +
            "where aq.quanAo.id in :quanAoIds and aq.trangThai = 1 " +
            "order by aq.quanAo.id, aq.anhChinh desc, aq.id")
    List<AnhQuanAo> findActiveByQuanAoIds(@Param("quanAoIds") Collection<Integer> quanAoIds);
}
