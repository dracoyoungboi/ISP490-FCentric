package com.dev.backend.services.impl.multitable;

import com.dev.backend.services.impl.entities.PhieuChuyenKhoService;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction;
import com.dev.backend.services.impl.payos.PosPayosTransaction;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Các điểm vào giao dịch đọc phần đang giữ / giữ chỗ / trạng thái chứng từ SAU khi chờ khóa phải chạy READ_COMMITTED:
 * MySQL mặc định REPEATABLE READ, câu SELECT thường sau khi chờ khóa vẫn đọc ảnh chụp từ lần đọc đầu giao dịch (bỏ sót
 * phiếu vừa ghi xong). Hàm gọi lồng (PosCheckoutTransaction.executeWith / reserveForTransfer từ PosPayosTransaction) lấy
 * mức cô lập của bên gọi nên bên gọi cũng phải đặt.
 */
class MucCoLapDiemVaoTest {

    @Test
    @DisplayName("Điểm vào nhặt hàng, phiếu chuyển, chọn lô, thanh toán POS (tiền mặt + payOS) chạy READ_COMMITTED")
    void diemVao_readCommitted() {
        Map<Class<?>, List<String>> diemVao = new LinkedHashMap<>();
        diemVao.put(NhatHangServiceImpl.class,
                List.of("hoanTatNhatHang", "taoPickList", "luuPhanBoLo", "quetBarcode", "phanCongNguoiNhat"));
        diemVao.put(PhieuChuyenKhoService.class, List.of("tao", "duyet", "damBaoPhieuXuat", "huy", "xuLyChenhLech"));
        diemVao.put(PhieuXuatKhoService.class, List.of("pickLoHang"));
        diemVao.put(PosCheckoutTransaction.class, List.of("execute", "executeWith", "reserveForTransfer"));
        diemVao.put(PosPayosTransaction.class, List.of("createPending", "finalizePaid", "createOrderFromPaidError"));

        diemVao.forEach((lop, tens) -> {
            for (String ten : tens) {
                List<Method> ms = Arrays.stream(lop.getDeclaredMethods())
                        .filter(m -> m.getName().equals(ten) && Modifier.isPublic(m.getModifiers()) && !m.isBridge())
                        .toList();
                assertFalse(ms.isEmpty(), lop.getSimpleName() + "." + ten + " không có");
                for (Method m : ms) {
                    Transactional tx = m.getAnnotation(Transactional.class);
                    assertNotNull(tx, lop.getSimpleName() + "." + ten + " thiếu @Transactional");
                    assertEquals(Isolation.READ_COMMITTED, tx.isolation(), lop.getSimpleName() + "." + ten);
                }
            }
        });
    }
}
