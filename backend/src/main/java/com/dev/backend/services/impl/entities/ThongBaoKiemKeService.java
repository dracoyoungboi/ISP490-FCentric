package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Thông báo của kiểm kê khoanh vùng.
 * <pre>
 *   Sự kiện                         Người nhận
 *   K1 Đợt chờ duyệt                Quản lý kho của kho đó (trừ người trình); kho không có quản lý nào thì quản trị viên
 *   K2 Quản lý yêu cầu đếm lại      Người chủ trì (trừ người yêu cầu)
 *   K3 Đợt đã duyệt                 Người chủ trì (trừ người duyệt)
 *   K4 Đợt bắt đầu                  Quản lý kho, nhân viên kho, nhân viên bán hàng của kho (trừ người bắt đầu)
 *   K5 Đợt kết thúc (duyệt / hủy)   Như K4 (trừ người thao tác; khi duyệt trừ cả người chủ trì — đã có K3)
 * </pre>
 * K4 / K5 để người bán và người kho biết trước hàng nào tạm dừng, không chỉ biết khi bị chặn (đặc tả kiểm kê 8.2).
 * Nhân viên bán hàng nhận đường dẫn tới quầy bán (không có quyền xem đợt), người kho nhận đường dẫn tới đợt.
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
                        .filter(t -> t != null && !t.isBlank()).map(String::trim).orElse(ThongDiep.vi("thongBaoChung.khoSo", khoId));
                String cauLech;
                if (soLech == 0) cauLech = ThongDiep.vi("thongBaoKiemKe.choDuyetKhop", tenKho);
                else if (thua > 0 && thieu > 0) cauLech = ThongDiep.vi("thongBaoKiemKe.choDuyetLechCaHai", tenKho, soLech, thua, thieu);
                else if (thua > 0) cauLech = ThongDiep.vi("thongBaoKiemKe.choDuyetLechThua", tenKho, soLech, thua);
                else if (thieu > 0) cauLech = ThongDiep.vi("thongBaoKiemKe.choDuyetLechThieu", tenKho, soLech, thieu);
                else cauLech = ThongDiep.vi("thongBaoKiemKe.choDuyetLechKhongSo", tenKho, soLech);
                String moTa = cauLech + " " + ThongDiep.vi("thongBaoKiemKe.khoaVanGiu");
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nguoiNhan.quanLyKho(khoId), "Đợt kiểm kê " + ma + " chờ duyệt"),
                        nguoiId, new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE,
                        soLech > 0 ? ThongBaoService.TONE_WARNING : ThongBaoService.TONE_INFO,
                        ThongDiep.vi("thongBaoKiemKe.choDuyetTieuDe", ma), moTa, "/stock-take/" + id,
                        ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, "KK:" + id + ":CHO_DUYET:" + dot.getPhienBan())));
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo kiểm kê: {}", e.getMessage());
        }
    }

    /** K0: người khác (vd. nhân viên kho có quyền lập đợt) lưu nháp và giao cho người chủ trì bắt đầu. */
    public void choBatDau(DotKiemKe dot, NguoiDung nguoiLap) {
        String ten = nguoiLap == null || nguoiLap.getHoTen() == null || nguoiLap.getHoTen().isBlank()
                ? ThongDiep.vi("thongBaoKiemKe.nguoiLap") : nguoiLap.getHoTen().trim();
        guiChuTri(dot, nguoiLap, ThongBaoService.TONE_INFO, ThongDiep.vi("thongBaoKiemKe.choBatDauTieuDe", ma(dot)),
                ThongDiep.vi("thongBaoKiemKe.daLapDotNhap", ten) + " " + ThongDiep.vi("thongBaoKiemKe.xemLaiPhamVi"), "CHO_BAT_DAU");
    }

    /** K2: quản lý mở lại {@code soDong} dòng để đếm lại. */
    public void demLai(DotKiemKe dot, int soDong, String lyDo, NguoiDung nguoiYeuCau) {
        guiChuTri(dot, nguoiYeuCau, ThongBaoService.TONE_WARNING, ThongDiep.vi("thongBaoKiemKe.demLaiTieuDe", ma(dot), soDong),
                ThongDiep.vi("thongBaoKiemKe.lyDo", lyDo), "DEM_LAI");
    }

    /** K3: đợt đã duyệt; {@code soPhieu} null khi khớp toàn bộ. */
    public void daDuyet(DotKiemKe dot, String soPhieu, NguoiDung nguoiDuyet) {
        guiChuTri(dot, nguoiDuyet, ThongBaoService.TONE_SUCCESS, ThongDiep.vi("thongBaoKiemKe.daDuyetTieuDe", ma(dot)),
                (soPhieu == null ? ThongDiep.vi("thongBaoKiemKe.duyetKhop") : ThongDiep.vi("thongBaoKiemKe.duyetDaDieuChinh", soPhieu))
                        + " " + ThongDiep.vi("thongBaoKiemKe.khoaDaMo"), "DA_DUYET");
    }

    /** K4: đợt vừa bắt đầu, phạm vi đã khóa. */
    public void batDau(DotKiemKe dot, NguoiDung nguoiBatDau) {
        boolean toanKho = dot.getLoaiKiemKe() == DotKiemKe.LoaiKiemKe.toan_bo;
        guiKho(dot, nguoiBatDau, false, ThongBaoService.TONE_WARNING, "thongBaoKiemKe.batDauTieuDe",
                toanKho ? "thongBaoKiemKe.batDauToanKho" : "thongBaoKiemKe.batDauPhamVi", "BAT_DAU");
    }

    /** K5: đợt đang giữ khóa vừa được duyệt ({@code daDuyet}) hoặc hủy — phạm vi đã mở. */
    public void ketThuc(DotKiemKe dot, boolean daDuyet, NguoiDung nguoiThaoTac) {
        guiKho(dot, nguoiThaoTac, daDuyet, ThongBaoService.TONE_SUCCESS,
                daDuyet ? "thongBaoKiemKe.ketThucDuyetTieuDe" : "thongBaoKiemKe.ketThucHuyTieuDe",
                "thongBaoKiemKe.hangBanLai", daDuyet ? "KET_THUC_DUYET" : "KET_THUC_HUY");
    }

    private void guiKho(DotKiemKe dot, NguoiDung nguoiThaoTac, boolean truChuTri, String tone, String khoaTieuDe,
                        String khoaMoTa, String loai) {
        try {
            Integer id = dot.getId();
            String ma = ma(dot);
            Integer khoId = dot.getKho() == null ? null : dot.getKho().getId();
            if (khoId == null) return;
            Integer nguoiId = nguoiThaoTac == null ? null : nguoiThaoTac.getId();
            Integer chuTri = truChuTri && dot.getNguoiChuTri() != null ? dot.getNguoiChuTri().getId() : null;
            Object phienBan = dot.getPhienBan();
            thongBaoService.guiSauCommit("Thông báo đợt kiểm kê " + ma + " " + loai, () -> {
                String tenKho = khoRepository.findById(khoId).map(k -> k.getTenKho())
                        .filter(t -> t != null && !t.isBlank()).map(String::trim).orElse(ThongDiep.vi("thongBaoChung.khoSo", khoId));
                String tieuDe = ThongDiep.vi(khoaTieuDe, tenKho, ma);
                String moTa = ThongDiep.vi(khoaMoTa);
                Set<Integer> kho = new LinkedHashSet<>(nguoiNhan.quanLyKho(khoId));
                kho.addAll(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_kho));
                Set<Integer> ban = new LinkedHashSet<>(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_ban_hang));
                ban.removeAll(kho);
                if (chuTri != null) {
                    kho.remove(chuTri);
                    ban.remove(chuTri);
                }
                String khoa = "KK:" + id + ":" + loai + ":" + phienBan;
                List<GuiDi> gui = new ArrayList<>();
                if (!kho.isEmpty()) gui.add(new GuiDi(kho, nguoiId, new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE, tone, tieuDe,
                        moTa, "/stock-take/" + id, ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, khoa)));
                if (!ban.isEmpty()) gui.add(new GuiDi(ban, nguoiId, new NoiDung(ThongBaoService.LOAI_DOT_KIEM_KE, tone, tieuDe,
                        moTa, "/pos", ThongBaoService.LOAI_DOT_KIEM_KE, id, khoId, khoa + ":QUAY")));
                return gui;
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo kiểm kê: {}", e.getMessage());
        }
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
