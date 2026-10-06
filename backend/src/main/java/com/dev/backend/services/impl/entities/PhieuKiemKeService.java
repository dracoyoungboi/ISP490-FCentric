// src/main/java/com/dev/backend/services/impl/entities/PhieuKiemKeService.java
package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ChiTietKiemKeUpdate;
import com.dev.backend.dto.request.PhieuKiemKeCreate;
import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.dto.response.entities.ChiTietKiemKeDto;
import com.dev.backend.dto.response.entities.DotKiemKeDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.LoHangDto;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietKiemKe;
import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.LichSuGiaoDichKho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.ChiTietKiemKeRepository;
import com.dev.backend.repository.DotKiemKeRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PhieuKiemKeService {

    private final DotKiemKeRepository dotKiemKeRepository;
    private final ChiTietKiemKeRepository chiTietRepository;
    private final TonKhoTheoLoRepository tonKhoRepository;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final LichSuGiaoDichKhoService lichSuService;

    @Autowired
    public PhieuKiemKeService(
            DotKiemKeRepository dotKiemKeRepository,
            ChiTietKiemKeRepository chiTietRepository,
            TonKhoTheoLoRepository tonKhoRepository,
            KhoRepository khoRepository,
            NguoiDungRepository nguoiDungRepository,
            LichSuGiaoDichKhoService lichSuService) {
        this.dotKiemKeRepository = dotKiemKeRepository;
        this.chiTietRepository = chiTietRepository;
        this.tonKhoRepository = tonKhoRepository;
        this.khoRepository = khoRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.lichSuService = lichSuService;
    }

    // ─────────────────────────────────────────────────────────────
    // DANH SÁCH
    // ─────────────────────────────────────────────────────────────

    public List<DotKiemKeDto> getList() {
        return dotKiemKeRepository.findAllWithDetails()
                .stream()
                .map(this::toDotKiemKeDto)
                .collect(Collectors.toList());
    }

    public DotKiemKeDto getById(Integer id) {
        DotKiemKe dot = dotKiemKeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đợt kiểm kê ID: " + id));
        return toDotKiemKeDto(dot);
    }

    // ─────────────────────────────────────────────────────────────
    // TẠO ĐỢT KIỂM KÊ
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public Integer create(PhieuKiemKeCreate create) {
        // FIX: Lấy người dùng đang login từ SecurityContext
        NguoiDung nguoiChuTri = getCurrentUser();

        var kho = khoRepository.findById(create.getKhoId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy kho ID: " + create.getKhoId()));

        // Tạo dot_kiem_ke với đầy đủ thông tin
        DotKiemKe dot = DotKiemKe.builder()
                .maDotKiemKe("KK" + System.currentTimeMillis())
                .tenDotKiemKe("Kiểm kê kho " + kho.getTenKho())
                .kho(kho)
                .nguoiChuTri(nguoiChuTri)   // FIX: set nguoiChuTri để tránh NOT NULL
                .loaiKiemKe(DotKiemKe.LoaiKiemKe.toan_bo)
                .ghiChu(create.getGhiChu())
                .trangThai((byte) 0)
                .ngayBatDau(Instant.now())
                .ngayTao(Instant.now())
                .ngayCapNhat(Instant.now())
                .build();
        dot = dotKiemKeRepository.save(dot);

        // Tạo chi tiết cho từng lô hàng trong kho
        List<TonKhoTheoLo> tonKhos = tonKhoRepository.findByKho_Id(create.getKhoId());

        if (tonKhos.isEmpty()) {
            throw new RuntimeException("Kho không có hàng tồn để kiểm kê");
        }

        for (TonKhoTheoLo tonKho : tonKhos) {
            ChiTietKiemKe chiTiet = ChiTietKiemKe.builder()
                    .dotKiemKeId(dot.getId())
                    .bienTheSanPham(tonKho.getLoHang().getBienTheSanPham())
                    .loHang(tonKho.getLoHang())
                    .soLuongHeThong(tonKho.getSoLuongTon())
                    .soLuongThucTe(BigDecimal.ZERO)
                    .trangThai((byte) 0)
                    .ngayTao(Instant.now())
                    .build();
            chiTietRepository.save(chiTiet);
        }

        return dot.getId();
    }

    // ─────────────────────────────────────────────────────────────
    // CHI TIẾT
    // ─────────────────────────────────────────────────────────────

    public List<ChiTietKiemKeDto> getChiTiet(Integer dotKiemKeId) {
        // Validate đợt kiểm kê tồn tại
        dotKiemKeRepository.findById(dotKiemKeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đợt kiểm kê ID: " + dotKiemKeId));

        return chiTietRepository.findByDotKiemKeId(dotKiemKeId)
                .stream()
                .map(this::toChiTietDto)
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────
    // HOÀN THÀNH
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public void complete(Integer dotKiemKeId, Integer khoId, List<ChiTietKiemKeUpdate> updates) {
        DotKiemKe dot = dotKiemKeRepository.findById(dotKiemKeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đợt kiểm kê ID: " + dotKiemKeId));

        if (dot.getTrangThai() == 1) {
            throw new RuntimeException("Đợt kiểm kê này đã hoàn thành");
        }

        NguoiDung nguoiKiemDem = getCurrentUser();

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = new ArrayList<>();
        for (ChiTietKiemKeUpdate update : updates) {
            ChiTietKiemKe chiTietTmp = chiTietRepository.findById(update.getChiTietId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy chi tiết ID: " + update.getChiTietId()));
            lotIdsToLock.add(chiTietTmp.getLoHang().getId());
        }
        tonKhoRepository.lockLotsForUpdateByLotIds(lotIdsToLock.stream().distinct().toList());

        for (ChiTietKiemKeUpdate update : updates) {
            ChiTietKiemKe chiTiet = chiTietRepository.findById(update.getChiTietId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy chi tiết ID: " + update.getChiTietId()));

            BigDecimal soLuongHeThong = chiTiet.getSoLuongHeThong() != null
                    ? chiTiet.getSoLuongHeThong() : BigDecimal.ZERO;
            BigDecimal soLuongThucTe = BigDecimal.valueOf(update.getSoLuongThucTe());
            BigDecimal chenhLech = soLuongThucTe.subtract(soLuongHeThong);

            chiTiet.setSoLuongThucTe(soLuongThucTe);
            chiTiet.setChenhLechSoLuong(chenhLech);
            chiTiet.setLoaiChenhLech(
                    chenhLech.compareTo(BigDecimal.ZERO) < 0 ? ChiTietKiemKe.LoaiChenhLech.thieu :
                            chenhLech.compareTo(BigDecimal.ZERO) > 0 ? ChiTietKiemKe.LoaiChenhLech.thua :
                                    ChiTietKiemKe.LoaiChenhLech.khop
            );
            chiTiet.setNguoiKiemDem(nguoiKiemDem);
            chiTiet.setNgayKiemDem(Instant.now());
            chiTiet.setTrangThai((byte) 1);
            chiTiet.setNgayCapNhat(Instant.now());
            chiTietRepository.save(chiTiet);

            // Cập nhật tồn kho
            TonKhoTheoLo tonKho = tonKhoRepository
                    .findByKho_IdAndLoHang_Id(khoId, chiTiet.getLoHang().getId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy tồn kho cho lô: " + chiTiet.getLoHang().getId()));
            tonKho.setSoLuongTon(soLuongThucTe);
            tonKhoRepository.save(tonKho);

            // Ghi lịch sử chỉ khi có chênh lệch
            if (chenhLech.compareTo(BigDecimal.ZERO) != 0) {
                LichSuGiaoDichKho lichSu = LichSuGiaoDichKho.builder()
                        .loaiGiaoDich("dieu_chinh")
                        .soLuong(chenhLech)
                        .soLuongTruoc(soLuongHeThong)
                        .soLuongSau(soLuongThucTe)
                        .bienTheSanPham(chiTiet.getBienTheSanPham())
                        .loHang(chiTiet.getLoHang())
                        .kho(tonKho.getKho())
                        .idThamChieu(dotKiemKeId)
                        .loaiThamChieu("kiem_ke")
                        .nguoiDung(nguoiKiemDem)
                        .ngayGiaoDich(Instant.now())
                        .build();
                lichSuService.create(lichSu);
            }
        }

        // Đánh dấu hoàn thành
        dot.setTrangThai((byte) 1);
        dot.setNgayHoanThanh(Instant.now());
        dot.setNgayCapNhat(Instant.now());
        dotKiemKeRepository.save(dot);
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Lấy NguoiDung đang login từ Spring Security context.
     * Spring Security đặt email (hoặc tenDangNhap) làm principal name trong JWT.
     * NguoiDungRepository có findByEmail → dùng trực tiếp.
     * Nếu JWT dùng tenDangNhap thay vì email, đổi sang:
     *   nguoiDungRepository.findByTenDangNhapOrEmailOrSoDienThoai(name, name, name)
     */
    private NguoiDung getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return nguoiDungRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng: " + email));
    }

    private DotKiemKeDto toDotKiemKeDto(DotKiemKe dot) {
        return DotKiemKeDto.builder()
                .id(dot.getId())
                .maDotKiemKe(dot.getMaDotKiemKe())
                .tenDotKiemKe(dot.getTenDotKiemKe())
                .kho(dot.getKho() != null ? KhoDto.builder()
                        .id(dot.getKho().getId())
                        .tenKho(dot.getKho().getTenKho())
                        .build() : null)
                .loaiKiemKe(dot.getLoaiKiemKe() != null ? dot.getLoaiKiemKe().name() : null)
                .trangThai(dot.getTrangThai())
                .ghiChu(dot.getGhiChu())
                .nguoiChuTri(dot.getNguoiChuTri() != null ? NguoiDungDto.builder()
                        .id(dot.getNguoiChuTri().getId())
                        .hoTen(dot.getNguoiChuTri().getHoTen())
                        .build() : null)
                .ngayBatDau(dot.getNgayBatDau())
                .ngayHoanThanh(dot.getNgayHoanThanh())
                .ngayTao(dot.getNgayTao())
                .build();
    }

    private ChiTietKiemKeDto toChiTietDto(ChiTietKiemKe ct) {
        BienTheSanPhamDto bienTheDto = null;
        if (ct.getBienTheSanPham() != null) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            bienTheDto = BienTheSanPhamDto.builder()
                    .id(bt.getId())
                    .tenBienThe(buildTenBienThe(bt))
                    .maSku(bt.getMaSku())
                    .build();
        }

        return ChiTietKiemKeDto.builder()
                .id(ct.getId())
                .loHang(ct.getLoHang() != null ? LoHangDto.builder()
                        .id(ct.getLoHang().getId())
                        .maLo(ct.getLoHang().getMaLo())
                        .build() : null)
                .bienTheSanPham(bienTheDto)
                .soLuongHeThong(ct.getSoLuongHeThong())
                .soLuongThucTe(ct.getSoLuongThucTe())
                .chenhLechSoLuong(ct.getChenhLechSoLuong())
                .loaiChenhLech(ct.getLoaiChenhLech() != null ? ct.getLoaiChenhLech().name() : null)
                .build();
    }

    /**
     * Ghép tên biến thể: TênSảnPhẩm - TênMàu / TênSize
     * Ví dụ: "Áo thun basic - Đen / M"
     * Fallback về maSku nếu các quan hệ null.
     */
    private String buildTenBienThe(BienTheSanPham bt) {
        StringBuilder sb = new StringBuilder();
        if (bt.getSanPham() != null) {
            sb.append(bt.getSanPham().getTenSanPham());
        }
        if (bt.getMauSac() != null) {
            sb.append(" - ").append(bt.getMauSac().getTenMau());
        }
        if (bt.getSize() != null) {
            sb.append(" / ").append(bt.getSize().getTenSize());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? bt.getMaSku() : result;
    }
}