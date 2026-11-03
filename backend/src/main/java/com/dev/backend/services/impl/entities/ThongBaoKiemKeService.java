package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Thông báo của kiểm kê khoanh vùng.
 * <pre>
 *   Sự kiện                         Người nhận
 *   K1 Đợt chờ duyệt                Quản lý kho của kho đó (trừ người trình); kho không có quản lý nào thì quản trị viên
 *   K2 Quản lý yêu cầu đếm lại      Người chủ trì (trừ người yêu cầu)
 *   K3 Đợt đã duyệt                 Người chủ trì (trừ người duyệt)
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

    private static String ma(DotKiemKe dot) {
        return dot.getMaDotKiemKe() != null && !dot.getMaDotKiemKe().isBlank() ? dot.getMaDotKiemKe().trim() : "#" + dot.getId();
    }

    /** K1: đợt vừa trình duyệt. {@code soLech}: số dòng lệch; {@code thua} / {@code thieu}: tổng sản phẩm (số dương). */
    public void choDuyet(DotKiemKe dot, int soLech, long thua, long thieu, NguoiDung nguoiTrinh) {
        try {
            Integer id = dot.getId();
            String ma = ma(dot);
            Integer khoId = dot.getKho() == null ? null : dot.getKho().getId();
            Integer nguoiId = nguoiTrinh == null ? null : nguoiTrinh.getId();
            thongBaoService.guiSauCommit("Thông báo đợt kiểm kê " + ma + " chờ duyệt", () -> {
                String tenKho = khoId == null ? "Kho" : khoRepository.findById(khoId).map(k -> k.getTenKho())
                        .filter(t -> t != null && !t.isBlank()).map(String::trim).orElse("Kho #" + khoId);
                List<String> lech = new ArrayList<>();
                if (thua > 0) lech.add("thừa " + thua);
                if (thieu > 0) lech.add("thiếu " + thieu);
                String moTa = tenKho + (soLech == 0 ? ": khớp toàn bộ" : ": lệch " + soLech + " dòng (" + String.join(", ", lech)
                        + " sản phẩm)") + ". Khóa kiểm kê vẫn giữ tới khi duyệt.";
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Đợt kiểm kê " + ma + " chờ duyệt"),
                        nguoiId, new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE,
                        soLech > 0 ? ThongBaoService.TONE_WARNING : ThongBaoService.TONE_INFO,
                        "Đợt kiểm kê " + ma + " chờ duyệt", moTa, "/stock-take/" + id,
                        ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, "KK:" + id + ":CHO_DUYET:" + dot.getPhienBan())));
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo kiểm kê: {}", e.getMessage());
        }
    }

    /** K2: quản lý mở lại {@code soDong} dòng để đếm lại. */
    public void demLai(DotKiemKe dot, int soDong, String lyDo, NguoiDung nguoiYeuCau) {
        guiChuTri(dot, nguoiYeuCau, ThongBaoService.TONE_WARNING, "Đợt kiểm kê " + ma(dot) + " cần đếm lại " + soDong + " dòng",
                "Lý do: " + lyDo, "DEM_LAI");
    }

    /** K3: đợt đã duyệt; {@code soPhieu} null khi khớp toàn bộ. */
    public void daDuyet(DotKiemKe dot, String soPhieu, NguoiDung nguoiDuyet) {
        guiChuTri(dot, nguoiDuyet, ThongBaoService.TONE_SUCCESS, "Đợt kiểm kê " + ma(dot) + " đã được duyệt",
                soPhieu == null ? "Khớp toàn bộ, không điều chỉnh tồn. Khóa kiểm kê đã mở."
                        : "Tồn kho đã điều chỉnh theo phiếu " + soPhieu + ". Khóa kiểm kê đã mở.", "DA_DUYET");
    }

    private void guiChuTri(DotKiemKe dot, NguoiDung nguoiThaoTac, String tone, String tieuDe, String moTa, String loai) {
        try {
            Integer id = dot.getId();
            Integer khoId = dot.getKho() == null ? null : dot.getKho().getId();
            Integer chuTri = dot.getNguoiChuTri() == null ? null : dot.getNguoiChuTri().getId();
            Integer nguoiId = nguoiThaoTac == null ? null : nguoiThaoTac.getId();
            if (chuTri == null) return;
            thongBaoService.guiSauCommit("Thông báo " + tieuDe, () -> List.of(new GuiDi(List.of(chuTri), nguoiId,
                    new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE, tone, tieuDe, moTa, "/stock-take/" + id,
                            ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, "KK:" + id + ":" + loai + ":" + dot.getPhienBan()))));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo kiểm kê: {}", e.getMessage());
        }
    }
}
