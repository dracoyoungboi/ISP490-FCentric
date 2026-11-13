package com.dev.backend.services.impl.kiemke;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Phần đang kiểm kê theo (kho, mã hàng) cho các màn tồn kho (Báo cáo tồn kho, ngăn tồn của sản phẩm): giữ nguyên số tồn,
 * hiện thêm nhãn "Đang kiểm kê N" (đặc tả kiểm kê 8.2 — phần trong phạm vi đợt không bán / xuất được tới khi đợt kết
 * thúc). Chỉ đọc; kho không có đợt đang kiểm / chờ duyệt thì không có dòng.
 */
@Service
@RequiredArgsConstructor
public class KiemKeTheoMaService {

    private final KhoaKiemKeGuard guard;

    /** Một mã ở một kho: {@code soLuong} đang thuộc đợt {@code maDotKiemKe}; {@code toanKho}: đợt kiểm toàn bộ kho. */
    public record DongDangKiem(Integer khoId, Integer bienTheId, BigDecimal soLuong, String maDotKiemKe, boolean toanKho) {
    }

    /** {@code khoId} / {@code bienTheId} null: mọi kho đang có đợt / mọi mã có tồn. */
    @Transactional(readOnly = true)
    public List<DongDangKiem> dangKiem(Integer khoId, Integer bienTheId) {
        List<DongDangKiem> kq = new ArrayList<>();
        for (Integer kho : new TreeSet<>(guard.khoDangKiemKe())) {
            if (khoId != null && !khoId.equals(kho)) continue;
            KhoaKiemKeGuard.KiemKeTheoMa kk = guard.dangKiemKeTheoMa(kho, bienTheId == null ? null : List.of(bienTheId));
            boolean toanKho = kk.dotToanKho() != null;
            for (Map.Entry<Integer, BigDecimal> e : kk.soLuong().entrySet()) {
                if (e.getValue() == null || e.getValue().signum() <= 0) continue;
                String ma = toanKho ? kk.dotToanKho() : kk.dotCuaMa().get(e.getKey());
                kq.add(new DongDangKiem(kho, e.getKey(), e.getValue(), ma, toanKho));
            }
        }
        return kq;
    }
}
