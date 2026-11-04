package com.dev.backend.repository;

import com.dev.backend.entities.ThueSuatGtgt;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ThueSuatGtgtRepository extends JpaRepository<ThueSuatGtgt, Integer> {

    /** Mọi dòng thuế suất kèm danh mục (bảng nhỏ: vài chục dòng), mức chung trước rồi theo ngày hiệu lực. */
    @Query("SELECT t FROM ThueSuatGtgt t LEFT JOIN FETCH t.danhMuc ORDER BY CASE WHEN t.danhMuc IS NULL THEN 0 ELSE 1 END, t.danhMuc.id, t.hieuLucTu")
    List<ThueSuatGtgt> findAllKemDanhMuc();

    /** Các dòng mức chung (không danh mục): nguồn thuế suất in trên hóa đơn bán hàng. */
    List<ThueSuatGtgt> findByDanhMucIsNull();

    /** Mọi dòng, khóa ghi tới hết giao dịch (SELECT … FOR UPDATE): lưu cả bảng thuế suất lần lượt từng người. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM ThueSuatGtgt t")
    List<ThueSuatGtgt> khoaTatCa();
}
