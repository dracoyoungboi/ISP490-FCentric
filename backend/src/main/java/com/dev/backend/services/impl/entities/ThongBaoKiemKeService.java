package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Thông báo của kiểm kê. Kiểm kê chưa có bước duyệt chênh lệch: người đếm bấm Hoàn thành là tồn theo lô đổi ngay, nên
 * quản lý kho cần biết khi có lô lệch.
 * <pre>
 *   Sự kiện                                Người nhận
 *   K1 Đợt kiểm kê hoàn thành, có lô lệch   Quản lý kho của kho đó (trừ người vừa hoàn thành); kho không có quản lý
 *                                          nào thì quản trị viên (quản lý duy nhất tự hoàn thành thì không ai nhận)
 * </pre>
 * Chỉ chụp các trường đã có trong bộ nhớ; tìm người nhận, tên kho và ghi thông báo chạy sau commit
 * ({@link ThongBaoService#guiSauCommit}). Không bao giờ ném lỗi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoKiemKeService {

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;

    /**
     * K1: đợt kiểm kê vừa hoàn thành. {@code soLoLech}: số lô có số đếm khác số hệ thống; {@code tongThua} /
     * {@code tongThieu}: tổng sản phẩm thừa / thiếu (số dương). Không có lô lệch thì không gửi.
     */
    public void daHoanThanh(DotKiemKe dot, int soLoLech, BigDecimal tongThua, BigDecimal tongThieu, NguoiDung nguoiHoanThanh) {
        if (soLoLech <= 0) return;
        try {
            Integer id = dot.getId();
            String ma = dot.getMaDotKiemKe() != null && !dot.getMaDotKiemKe().isBlank() ? dot.getMaDotKiemKe().trim() : "#" + id;
            Integer khoId = dot.getKho() == null ? null : dot.getKho().getId();
            Integer nguoiId = nguoiHoanThanh == null ? null : nguoiHoanThanh.getId();
            BigDecimal thua = tongThua == null ? BigDecimal.ZERO : tongThua;
            BigDecimal thieu = tongThieu == null ? BigDecimal.ZERO : tongThieu;
            thongBaoService.guiSauCommit("Thông báo đợt kiểm kê " + ma + " lệch", () -> {
                String tenKho = khoId == null ? "Kho" : khoRepository.findById(khoId).map(k -> k.getTenKho())
                        .filter(t -> t != null && !t.isBlank()).map(String::trim).orElse("Kho #" + khoId);
                List<String> lech = new ArrayList<>();
                if (thua.signum() > 0) lech.add("thừa " + ThongBaoXuatKhoService.so(thua));
                if (thieu.signum() > 0) lech.add("thiếu " + ThongBaoXuatKhoService.so(thieu));
                String moTa = tenKho + (lech.isEmpty() ? "" : ": " + String.join(", ", lech) + " sản phẩm")
                        + ". Tồn kho đã cập nhật theo số đếm.";
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Đợt kiểm kê " + ma + " lệch"),
                        nguoiId, new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE, ThongBaoService.TONE_WARNING,
                                "Đợt kiểm kê " + ma + " lệch " + soLoLech + " lô", moTa, "/stock-take/" + id,
                                ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, "KK:" + id + ":LECH")));
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo kiểm kê: {}", e.getMessage());
        }
    }
}
