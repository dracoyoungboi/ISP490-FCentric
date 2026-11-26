package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Hạn nhà cung cấp được báo giá một đơn mua (yêu cầu báo giá).
 * <ul>
 *   <li>Hạn = ngày gửi yêu cầu + N ngày (N là cấu hình {@code RFQ_RESPONSE_DAYS}, mặc định 5), tính đến hết ngày giờ
 *       Việt Nam: nhà cung cấp gửi được tới 23:59:59, từ 0:00 hôm sau là quá hạn.</li>
 *   <li>Chốt lúc gửi: một dòng lich_su_thay_doi {@code dat_han_bao_gia} (giá trị mới = ngày hạn) cho từng đơn. BA chốt
 *       không thêm cột; đổi N sau đó chỉ áp dụng cho đơn gửi sau, ngày đã ghi trong email nhà cung cấp luôn khớp.</li>
 *   <li>Đơn gửi trước khi có hạn (không có dòng chốt): coi hạn = ngày gửi + N hiện tại ({@link Han#daChot} false). Đơn
 *       như vậy vẫn được nhắc nếu còn kịp; quá hạn ngay lúc triển khai (chưa từng được báo hạn) thì hết hạn im lặng.</li>
 *   <li>Nhắc một lần lúc 8:00 ngày trước hạn, chỉ khi lúc gửi còn trước mốc đó (hạn là ngày mai thì không nhắc).</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class HanBaoGia {

    public static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Giờ gửi email nhắc trong ngày trước hạn (lượt xét hạn chạy mỗi giờ từ 8:00). */
    static final int GIO_NHAC = 8;

    private final CauHinhHeThongRepository cauHinhRepository;
    private final LichSuThayDoiRepository lichSuThayDoiRepository;

    /** Hạn của một đơn. {@code daChot}: có dòng chốt lúc gửi; false là đơn gửi trước khi có hạn (hạn suy ra). */
    public record Han(LocalDate ngay, boolean daChot) {
    }

    /** Số ngày đang cấu hình; chưa có, không phải số hay ngoài 1–30 thì dùng mặc định. */
    public int soNgay() {
        try {
            return cauHinhRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_HAN_BAO_GIA_NGAY)
                    .map(CauHinhHeThong::getGiaTri)
                    .map(String::trim)
                    .map(Integer::parseInt)
                    .filter(n -> n >= DieuHanhHeThongServiceImpl.HAN_BAO_GIA_NGAY_TOI_THIEU
                            && n <= DieuHanhHeThongServiceImpl.HAN_BAO_GIA_NGAY_TOI_DA)
                    .orElse(DieuHanhHeThongServiceImpl.HAN_BAO_GIA_NGAY_MAC_DINH);
        } catch (NumberFormatException e) {
            return DieuHanhHeThongServiceImpl.HAN_BAO_GIA_NGAY_MAC_DINH;
        }
    }

    /** Ngày hạn khi gửi lúc {@code guiLuc}: ngày gửi (giờ Việt Nam) + {@code soNgay}. */
    public static LocalDate hanKhiGui(Instant guiLuc, int soNgay) {
        return guiLuc.atZone(MUI_GIO_VN).toLocalDate().plusDays(soNgay);
    }

    /** Lúc hết hạn: 0:00 ngày sau ngày hạn (giờ Việt Nam). */
    public static Instant hetHanLuc(LocalDate han) {
        return han.plusDays(1).atStartOfDay(MUI_GIO_VN).toInstant();
    }

    /** Đã qua hạn lúc {@code now} (từ 0:00 ngày sau ngày hạn). Không có hạn thì chưa qua. */
    public static boolean daQuaHan(LocalDate han, Instant now) {
        return han != null && now != null && !now.isBefore(hetHanLuc(han));
    }

    /** Lúc gửi email nhắc: 8:00 ngày trước ngày hạn (giờ Việt Nam). */
    public static Instant nhacLuc(LocalDate han) {
        return han.minusDays(1).atStartOfDay(MUI_GIO_VN).plusHours(GIO_NHAC).toInstant();
    }

    /** Lúc đơn được gửi yêu cầu báo giá (ngày đặt hàng ghi lúc gửi; đơn cũ thiếu thì ngày tạo). */
    public static Instant guiLuc(DonMuaHang don) {
        if (don == null) return null;
        return don.getNgayDatHang() != null ? don.getNgayDatHang() : don.getNgayTao();
    }

    /** Ghi hạn đã chốt cho đơn vừa gửi yêu cầu báo giá (cùng giao dịch với lúc tạo đơn). */
    public void chot(DonMuaHang don, LocalDate han, NguoiDung nguoi, Instant luc) {
        lichSuThayDoiRepository.save(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.don_mua_hang)
                .idThamChieu(don.getId())
                .maDoiTuong(don.getSoDonMua())
                .kho(don.getKhoNhap())
                .hanhDong(IHanhDong.dat_han_bao_gia)
                .giaTriMoi(han.toString())
                .nguoiThucHien(nguoi)
                .nguon(nguoi == null ? INguonNhatKy.he_thong : INguonNhatKy.nguoi_dung)
                .ngayThucHien(luc)
                .build());
    }

    /** Hạn của một đơn (xem {@link #hanCua(Collection)}). null nếu đơn chưa gửi (không có ngày gửi). */
    public Han hanCua(DonMuaHang don) {
        return don == null ? null : hanCua(List.of(don)).get(don.getId());
    }

    /**
     * Hạn của nhiều đơn, đọc dòng chốt của cả nhóm một lần: dòng {@code dat_han_bao_gia} mới nhất của đơn; không có (đơn
     * gửi trước khi có hạn) thì ngày gửi + số ngày hiện tại. Đơn không có ngày gửi thì không có trong kết quả.
     */
    public Map<Integer, Han> hanCua(Collection<DonMuaHang> dons) {
        Map<Integer, Han> kq = new HashMap<>();
        List<DonMuaHang> ds = dons == null ? List.of()
                : dons.stream().filter(d -> d != null && d.getId() != null).toList();
        if (ds.isEmpty()) return kq;
        Map<Integer, LocalDate> daChot = hanDaChot(ds.stream().map(DonMuaHang::getId).toList());
        Integer soNgay = null;
        for (DonMuaHang don : ds) {
            LocalDate chot = daChot.get(don.getId());
            if (chot != null) {
                kq.put(don.getId(), new Han(chot, true));
                continue;
            }
            Instant gui = guiLuc(don);
            if (gui == null) continue;
            if (soNgay == null) soNgay = soNgay();
            kq.put(don.getId(), new Han(hanKhiGui(gui, soNgay), false));
        }
        return kq;
    }

    /** Ngày hạn đã chốt (dòng mới nhất) của các đơn; đơn không có dòng chốt hay giá trị hỏng thì không có trong map. */
    Map<Integer, LocalDate> hanDaChot(Collection<Integer> donIds) {
        Map<Integer, LocalDate> kq = new HashMap<>();
        if (donIds == null || donIds.isEmpty()) return kq;
        for (Object[] dong : lichSuThayDoiRepository.giaTriMoiTheoHanhDong(ITable.don_mua_hang, donIds,
                IHanhDong.dat_han_bao_gia)) {
            Integer id = (Integer) dong[0];
            if (id == null || kq.containsKey(id)) continue;
            try {
                kq.put(id, LocalDate.parse(String.valueOf(dong[1]).trim()));
            } catch (DateTimeParseException e) {
                // Dòng hỏng: bỏ qua, dùng dòng cũ hơn (nếu có) hoặc hạn suy ra
            }
        }
        return kq;
    }

    /** Đơn đã được gửi email nhắc hạn chưa. */
    public boolean daNhac(Integer donId) {
        return donId != null && !lichSuThayDoiRepository.idCoHanhDong(ITable.don_mua_hang, List.of(donId),
                IHanhDong.nhac_han_bao_gia).isEmpty();
    }

    /** Ghi đã gửi email nhắc (một lần cho mỗi đơn). */
    public void ghiDaNhac(DonMuaHang don, LocalDate han, Instant luc) {
        lichSuThayDoiRepository.save(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.don_mua_hang)
                .idThamChieu(don.getId())
                .maDoiTuong(don.getSoDonMua())
                .kho(don.getKhoNhap())
                .hanhDong(IHanhDong.nhac_han_bao_gia)
                .giaTriMoi(han.toString())
                .nguon(INguonNhatKy.he_thong)
                .ngayThucHien(luc)
                .build());
    }

    /**
     * Điền hạn báo giá cho các đơn của một màn: {@code hanBaoGia} cho đơn đã gửi yêu cầu (từ trạng thái 2);
     * {@code quaHanBaoGia} cho đơn còn ở 2, chưa báo giá mà đã qua hạn (lượt xét 8:00 chưa kịp đổi sang Hết hạn: màn hiện
     * Hết hạn theo giờ, không đợi). Nhận cả DTO và entity tương ứng theo id.
     */
    public void boSung(Collection<DonMuaHangDto> dtos, Collection<DonMuaHang> dons, Instant now) {
        if (dtos == null || dtos.isEmpty() || dons == null || dons.isEmpty()) return;
        List<DonMuaHang> daGui = dons.stream()
                .filter(d -> d != null && d.getTrangThai() != null && d.getTrangThai() >= DonMuaHangService.TRANG_THAI_CHO_BAO_GIA)
                .toList();
        Map<Integer, Han> han = hanCua(daGui);
        for (DonMuaHangDto dto : dtos) {
            if (dto == null || dto.getId() == null) continue;
            Han h = han.get(dto.getId());
            if (h == null) continue;
            dto.setHanBaoGia(h.ngay());
            dto.setQuaHanBaoGia(Objects.equals(dto.getTrangThai(), DonMuaHangService.TRANG_THAI_CHO_BAO_GIA)
                    && dto.getNgayBaoGia() == null && daQuaHan(h.ngay(), now));
        }
    }
}
