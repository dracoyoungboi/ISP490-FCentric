package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.dto.request.inbound.KhuVucKhoRequest;
import com.dev.backend.dto.request.inbound.ViTriKhoRequest;
import com.dev.backend.dto.response.inbound.KhuVucKhoDto;
import com.dev.backend.dto.response.inbound.LoTrenKeDto;
import com.dev.backend.dto.response.inbound.ViTriKhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.KhuVucKho;
import com.dev.backend.entities.MatBangKho;
import com.dev.backend.entities.TonKhoViTri;
import com.dev.backend.entities.ViTriKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietPhieuNhapKhoRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.repository.KhuVucKhoRepository;
import com.dev.backend.repository.LoHangRepository;
import com.dev.backend.repository.MatBangKhoRepository;
import com.dev.backend.repository.TonKhoViTriRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import com.dev.backend.services.ViTriKhoService;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.services.impl.kiemke.PhanBoKeService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ViTriKhoServiceImpl implements ViTriKhoService {

    KhoRepository khoRepository;
    KhuVucKhoRepository khuVucKhoRepository;
    ViTriKhoRepository viTriKhoRepository;
    TonKhoViTriRepository tonKhoViTriRepository;
    MatBangKhoRepository matBangKhoRepository;
    ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    LoHangRepository loHangRepository;
    ObjectMapper objectMapper;

    /** Chốt chặn dữ liệu chủ của kiểm kê khoanh vùng; null khi unit test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    KhoaKiemKeGuard khoaKiemKeGuard;

    /** Phân bổ nhặt theo kệ: phiếu nhặt còn giữ hàng ở kệ thì chưa xóa kệ được; null khi unit test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    PhanBoKeService phanBoKeService;

    /** Nhật ký nghiệp vụ (khu vực, kệ, mặt bằng); null khi unit test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    NhatKyNghiepVu nhatKy;

    /** Tạo hàng loạt: nhật ký ghi tối đa chừng này mã kệ (còn lại chỉ ghi số lượng). */
    static final int TOI_DA_MA_KE_NHAT_KY = 200;

    /** KHOA_KIEM_KE chỉ do kiểm kê ghi khi khóa toàn kệ; sửa tay sang trạng thái này làm kệ khóa mà không đợt nào sở hữu. */
    private static void kiemTraTrangThaiGhiTay(String trangThai) {
        if (trangThai != null && IKiemKe.KE_KHOA_KIEM_KE.equalsIgnoreCase(trangThai.trim())) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.trangThaiKiemKeKhongChonTay"));
        }
    }

    // Sửa sơ đồ kho: kho trên đường dẫn phải là kho đang chọn (không chỉ người dùng thuộc kho trong header)
    private void kiemTraGhiKho(Integer khoId) {
        khoRepository.findById(khoId).ifPresent(k -> KhoDangChon.kiemTra(k, "Sơ đồ kho " + k.getTenKho()));
    }

    // Xem sơ đồ kho: người dùng được phân quyền ở kho đó (màn kiểm đếm lô đọc kệ của kho phiếu nhập khi đang chọn kho khác)
    private void kiemTraXemKho(Integer khoId) {
        khoRepository.findById(khoId).ifPresent(k -> KhoDangChon.kiemTraXem(k, "Sơ đồ kho " + k.getTenKho()));
    }

    // ── Khu vực ──

    @Override
    @Transactional(readOnly = true)
    public List<KhuVucKhoDto> dsKhuVuc(Integer khoId) {
        kiemTraXemKho(khoId);
        List<KhuVucKho> list = khuVucKhoRepository.findByKho_IdOrderByMaKhuVucAsc(khoId);
        return list.stream().map(k -> {
            long count = viTriKhoRepository.countByKhuVucKho_Id(k.getId());
            return KhuVucKhoDto.builder()
                    .id(k.getId())
                    .maKhuVuc(k.getMaKhuVuc())
                    .tenKhuVuc(k.getTenKhuVuc())
                    .loaiKhu(k.getLoaiKhu())
                    .ghiChu(k.getGhiChu())
                    .soViTri((int) count)
                    .build();
        }).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KhuVucKhoDto taoKhuVuc(Integer khoId, KhuVucKhoRequest request) {
        Kho kho = khoRepository.findById(khoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khoKhongTimThay", khoId)));
        KhoDangChon.kiemTra(kho, "Sơ đồ kho " + kho.getTenKho());

        String ma = request.getMaKhuVuc() != null ? request.getMaKhuVuc().trim().toUpperCase() : "";
        if (ma.isBlank()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.maKhuVucTrong"));
        }
        if (khuVucKhoRepository.existsByKho_IdAndMaKhuVuc(khoId, ma)) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.maKhuVucDaTonTai", ma));
        }

        KhuVucKho khuVuc = KhuVucKho.builder()
                .kho(kho)
                .maKhuVuc(ma)
                .tenKhuVuc(request.getTenKhuVuc() != null ? request.getTenKhuVuc().trim() : ma)
                .loaiKhu(request.getLoaiKhu() != null && !request.getLoaiKhu().isBlank() ? request.getLoaiKhu() : "LUU_KHO")
                .ghiChu(request.getGhiChu())
                .trangThai(1)
                .build();

        KhuVucKho saved = khuVucKhoRepository.save(khuVuc);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khu_vuc_kho, saved.getId(), IHanhDong.tao_khu_vuc)
                .ma(saved.getMaKhuVuc()).kho(khoId)
                .moi(anhKhuVuc(saved)));
        return KhuVucKhoDto.builder()
                .id(saved.getId())
                .maKhuVuc(saved.getMaKhuVuc())
                .tenKhuVuc(saved.getTenKhuVuc())
                .loaiKhu(saved.getLoaiKhu())
                .ghiChu(saved.getGhiChu())
                .soViTri(0)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KhuVucKhoDto suaKhuVuc(Integer khoId, Integer khuVucId, KhuVucKhoRequest request) {
        kiemTraGhiKho(khoId);
        KhuVucKho khuVuc = khuVucKhoRepository.findById(khuVucId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khuVucKhongTimThay", khuVucId)));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.khuVucKhongThuocKho"));
        }
        Map<String, Object> truocKhu = anhKhuVuc(khuVuc);

        if (request.getTenKhuVuc() != null && !request.getTenKhuVuc().isBlank()) {
            khuVuc.setTenKhuVuc(request.getTenKhuVuc().trim());
        }
        if (request.getLoaiKhu() != null && !request.getLoaiKhu().isBlank()) {
            // Loại khu là dữ liệu chủ của phạm vi đợt (đợt theo khu vực / toàn kho): giữ nguyên trong lúc đếm để sơ đồ khóa và
            // biên bản kiểm kê khớp với lúc Bắt đầu; đổi tên / ghi chú vẫn được
            if (khoaKiemKeGuard != null && !request.getLoaiKhu().equals(khuVuc.getLoaiKhu())) {
                khoaKiemKeGuard.giuKho(khoId);
                khoaKiemKeGuard.kiemTraKhuVuc(khuVuc.getId(), "đổi loại khu vực");
            }
            khuVuc.setLoaiKhu(request.getLoaiKhu());
        }
        khuVuc.setGhiChu(request.getGhiChu());

        KhuVucKho saved = khuVucKhoRepository.save(khuVuc);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khu_vuc_kho, saved.getId(), IHanhDong.sua_khu_vuc)
                .ma(saved.getMaKhuVuc()).kho(khoId)
                .thayDoi(truocKhu, anhKhuVuc(saved)));
        long count = viTriKhoRepository.countByKhuVucKho_Id(saved.getId());
        return KhuVucKhoDto.builder()
                .id(saved.getId())
                .maKhuVuc(saved.getMaKhuVuc())
                .tenKhuVuc(saved.getTenKhuVuc())
                .loaiKhu(saved.getLoaiKhu())
                .ghiChu(saved.getGhiChu())
                .soViTri((int) count)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaKhuVuc(Integer khoId, Integer khuVucId) {
        kiemTraGhiKho(khoId);
        KhuVucKho khuVuc = khuVucKhoRepository.findById(khuVucId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khuVucKhongTimThay", khuVucId)));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.khuVucKhongThuocKho"));
        }

        long count = viTriKhoRepository.countByKhuVucKho_Id(khuVucId);
        if (count > 0) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.khuVucDangChuaKe", count));
        }

        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khu_vuc_kho, khuVuc.getId(), IHanhDong.xoa_khu_vuc)
                .ma(khuVuc.getMaKhuVuc()).kho(khoId)
                .cu(anhKhuVuc(khuVuc)));
        khuVucKhoRepository.delete(khuVuc);
    }

    // ── Vị trí kệ ──

    @Override
    @Transactional(readOnly = true)
    public List<ViTriKhoDto> dsViTri(Integer khoId) {
        // Kệ (kèm số đang chứa / chờ nhập) chỉ cho người thuộc kho đó xem
        khoRepository.findById(khoId).ifPresent(k -> KhoDangChon.kiemTraXem(k, "Kho " + k.getTenKho()));
        List<ViTriKho> list = viTriKhoRepository.findByKho_IdOrderByMaViTriAsc(khoId);
        if (list.isEmpty()) return List.of();

        // Batch query gom nhóm tính dangChua chống N+1 queries (hunt-springboot)
        Map<Integer, Integer> dangChuaMap = new HashMap<>();
        List<Object[]> sumList = tonKhoViTriRepository.sumDangChuaByKhoIdGroupByViTriId(khoId);
        for (Object[] row : sumList) {
            if (row[0] != null && row[1] != null) {
                dangChuaMap.put(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
            }
        }
        // Lô đã khóa của phiếu nhập chưa xác nhận: chưa vào tồn nhưng đã giữ chỗ trên kệ
        Map<Integer, Integer> choNhapMap = new HashMap<>();
        Map<Integer, Integer> soLoChoNhapMap = new HashMap<>();
        List<Object[]> choNhapList = chiTietPhieuNhapKhoRepository.sumChoNhapTheoKho(khoId);
        if (choNhapList != null) {
            for (Object[] row : choNhapList) {
                if (row[0] != null && row[1] != null) {
                    choNhapMap.put(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
                }
                if (row[0] != null && row.length > 2 && row[2] != null) {
                    soLoChoNhapMap.put(((Number) row[0]).intValue(), ((Number) row[2]).intValue());
                }
            }
        }

        return list.stream().map(v -> ViTriKhoDto.builder()
                .id(v.getId())
                .maViTri(v.getMaViTri())
                .khuVucId(v.getKhuVucKho().getId())
                .tenKhuVuc(v.getKhuVucKho().getTenKhuVuc())
                .day(v.getDayKe())
                .hang(v.getHangKe())
                .tang(v.getTangKe())
                .sucChua(v.getSucChuaToiDa())
                .dangChua(dangChuaMap.getOrDefault(v.getId(), 0))
                .choNhap(choNhapMap.getOrDefault(v.getId(), 0))
                .soLoChoNhap(soLoChoNhapMap.getOrDefault(v.getId(), 0))
                .trangThai(v.getTrangThai())
                .build()
        ).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ViTriKhoDto> dsViTriKhaDung(Integer khoId) {
        // Vị trí HOAT_DONG còn chỗ sau khi trừ cả hàng đang chứa và hàng chờ nhập (lô đã khóa chưa nhập kho);
        // kệ không ghi sức chứa coi như không giới hạn
        return dsViTri(khoId).stream()
                .filter(v -> "HOAT_DONG".equalsIgnoreCase(v.getTrangThai()))
                .filter(v -> v.getSucChua() == null || v.getSucChua() <= 0
                        || (v.getDangChua() != null ? v.getDangChua() : 0) + (v.getChoNhap() != null ? v.getChoNhap() : 0) < v.getSucChua())
                .toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<ViTriKhoDto> taoViTri(Integer khoId, ViTriKhoRequest request) {
        kiemTraGhiKho(khoId);
        if (request.getKhuVucId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.chonKhuVucKho"));
        }
        KhuVucKho khuVuc = khuVucKhoRepository.findById(request.getKhuVucId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khuVucKhongTimThay", request.getKhuVucId())));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.khuVucKhongThuocKho"));
        }

        kiemTraTrangThaiGhiTay(request.getTrangThai());
        if (khoaKiemKeGuard != null) {
            khoaKiemKeGuard.giuKho(khoId);
            khoaKiemKeGuard.kiemTraKhuVuc(khuVuc.getId(), "thêm kệ vào khu vực");
        }

        int sucChua = request.getSucChua() != null && request.getSucChua() > 0 ? request.getSucChua() : 100;
        String trangThai = request.getTrangThai() != null && !request.getTrangThai().isBlank() ? request.getTrangThai() : "HOAT_DONG";

        List<ViTriKho> danhSachTao = new ArrayList<>();

        // Kiểm tra kịch bản sinh hàng loạt: dãy, hàng từ -> đến, tầng từ -> đến
        if (request.getHangTu() != null && request.getHangDen() != null &&
            request.getTangTu() != null && request.getTangDen() != null) {
            String day = request.getDay() != null ? request.getDay().trim().toUpperCase() : "A";
            int hTu = Math.min(request.getHangTu(), request.getHangDen());
            int hDen = Math.max(request.getHangTu(), request.getHangDen());
            int tTu = Math.min(request.getTangTu(), request.getTangDen());
            int tDen = Math.max(request.getTangTu(), request.getTangDen());

            for (int h = hTu; h <= hDen; h++) {
                for (int t = tTu; t <= tDen; t++) {
                    String ma = String.format("%s-%02d-%02d", day, h, t);
                    if (!viTriKhoRepository.existsByKho_IdAndMaViTri(khoId, ma)) {
                        danhSachTao.add(ViTriKho.builder()
                                .kho(khuVuc.getKho())
                                .khuVucKho(khuVuc)
                                .maViTri(ma)
                                .dayKe(day)
                                .hangKe(String.format("%02d", h))
                                .tangKe(String.format("%02d", t))
                                .sucChuaToiDa(sucChua)
                                .trangThai(trangThai)
                                .build());
                    }
                }
            }
        } else {
            // Tạo một vị trí đơn lẻ
            String ma = request.getMaViTri() != null ? request.getMaViTri().trim().toUpperCase() : "";
            if (ma.isBlank()) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.maViTriTrong"));
            }
            if (viTriKhoRepository.existsByKho_IdAndMaViTri(khoId, ma)) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.maViTriDaTonTai", ma));
            }
            danhSachTao.add(ViTriKho.builder()
                    .kho(khuVuc.getKho())
                    .khuVucKho(khuVuc)
                    .maViTri(ma)
                    .dayKe(request.getDay())
                    .hangKe(request.getHang())
                    .tangKe(request.getTang())
                    .sucChuaToiDa(sucChua)
                    .trangThai(trangThai)
                    .build());
        }

        if (danhSachTao.isEmpty()) {
            return List.of();
        }

        List<ViTriKho> savedList = viTriKhoRepository.saveAll(danhSachTao);
        // Mỗi kệ một dòng "Tạo kệ" (lịch sử từng kệ có điểm bắt đầu); sinh hàng loạt thì thêm một dòng tóm tắt trên khu vực
        for (ViTriKho moi : savedList) {
            ghiNhatKy(NhatKyNghiepVu.dong(ITable.vi_tri_kho, moi.getId(), IHanhDong.tao_vi_tri)
                    .ma(moi.getMaViTri()).kho(khoId)
                    .moi(anhViTri(moi))
                    .ghiChu(savedList.size() > 1 ? "Sinh hàng loạt " + savedList.size() + " kệ" : null));
        }
        if (savedList.size() > 1) {
            // Sinh hàng loạt: một dòng trên khu vực, kèm danh sách mã kệ đã tạo
            List<String> dsMa = savedList.stream().map(ViTriKho::getMaViTri).limit(TOI_DA_MA_KE_NHAT_KY).toList();
            ghiNhatKy(NhatKyNghiepVu.dong(ITable.khu_vuc_kho, khuVuc.getId(), IHanhDong.tao_vi_tri)
                    .ma(khuVuc.getMaKhuVuc()).kho(khoId)
                    .moi(NhatKyNghiepVu.anh("soViTri", savedList.size(), "maViTri", dsMa,
                            "sucChua", sucChua, "trangThai", trangThai)));
        }
        return savedList.stream().map(v -> ViTriKhoDto.builder()
                .id(v.getId())
                .maViTri(v.getMaViTri())
                .khuVucId(v.getKhuVucKho().getId())
                .tenKhuVuc(v.getKhuVucKho().getTenKhuVuc())
                .day(v.getDayKe())
                .hang(v.getHangKe())
                .tang(v.getTangKe())
                .sucChua(v.getSucChuaToiDa())
                .dangChua(0)
                .trangThai(v.getTrangThai())
                .build()
        ).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ViTriKhoDto suaViTri(Integer khoId, Integer viTriId, ViTriKhoRequest request) {
        kiemTraGhiKho(khoId);
        ViTriKho viTri = viTriKhoRepository.findById(viTriId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.viTriKhongTimThay", viTriId)));

        if (!viTri.getKhuVucKho().getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.viTriKhongThuocKho"));
        }
        kiemTraTrangThaiGhiTay(request.getTrangThai());
        // Master Data Guard: kệ đang thuộc phạm vi đợt kiểm kê không đổi khu / trạng thái / sức chứa được. Kệ chỉ khóa mịn
        // (đợt theo danh mục khóa vài lô, kệ vẫn chứa hàng khác) thì vẫn sửa được sức chứa — không ảnh hưởng số đếm
        if (khoaKiemKeGuard != null) {
            boolean doiKhu = request.getKhuVucId() != null && !request.getKhuVucId().equals(viTri.getKhuVucKho().getId());
            boolean doiTrangThai = request.getTrangThai() != null && !request.getTrangThai().isBlank()
                    && !request.getTrangThai().equals(viTri.getTrangThai());
            khoaKiemKeGuard.giuKho(khoId);
            khoaKiemKeGuard.kiemTraKe(viTriId, "sửa kệ", !doiKhu && !doiTrangThai);
        }
        Map<String, Object> truocKe = anhViTri(viTri);

        if (request.getKhuVucId() != null && !request.getKhuVucId().equals(viTri.getKhuVucKho().getId())) {
            KhuVucKho khuMoi = khuVucKhoRepository.findById(request.getKhuVucId())
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khuVucMoiKhongTimThay")));
            if (!khuMoi.getKho().getId().equals(khoId)) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.khuVucMoiKhacKho"));
            }
            if (khoaKiemKeGuard != null) {
                khoaKiemKeGuard.kiemTraKhuVuc(khuMoi.getId(), "chuyển kệ vào khu vực");
            }
            viTri.setKhuVucKho(khuMoi);
        }

        if (request.getSucChua() != null && request.getSucChua() > 0) {
            viTri.setSucChuaToiDa(request.getSucChua());
        }
        if (request.getTrangThai() != null && !request.getTrangThai().isBlank()) {
            viTri.setTrangThai(request.getTrangThai());
        }

        ViTriKho saved = viTriKhoRepository.save(viTri);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.vi_tri_kho, saved.getId(), IHanhDong.sua_vi_tri)
                .ma(saved.getMaViTri()).kho(khoId)
                .thayDoi(truocKe, anhViTri(saved)));
        int dangChua = tonKhoViTriRepository.sumDangChuaByViTriId(saved.getId());
        // Giao diện thay cả dòng kệ bằng kết quả này: thiếu "chờ nhập" thì nút xóa kệ mở lại dù kệ còn lô chờ nhập
        long choNhap = 0;
        long soLoChoNhap = 0;
        List<Object[]> loCho = chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(saved.getId());
        for (Object[] dong : loCho != null ? loCho : List.<Object[]>of()) {
            soLoChoNhap += ((Number) dong[1]).longValue();
            choNhap += ((Number) dong[2]).longValue();
        }

        return ViTriKhoDto.builder()
                .id(saved.getId())
                .maViTri(saved.getMaViTri())
                .khuVucId(saved.getKhuVucKho().getId())
                .tenKhuVuc(saved.getKhuVucKho().getTenKhuVuc())
                .day(saved.getDayKe())
                .hang(saved.getHangKe())
                .tang(saved.getTangKe())
                .sucChua(saved.getSucChuaToiDa())
                .dangChua(dangChua)
                .choNhap((int) choNhap)
                .soLoChoNhap((int) soLoChoNhap)
                .trangThai(saved.getTrangThai())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaViTri(Integer khoId, Integer viTriId) {
        // Đ5: giữ mutex kho (chia sẻ, câu đọc có khóa nên không chốt ảnh dữ liệu) trước khi khóa dòng kệ
        if (khoaKiemKeGuard != null) khoaKiemKeGuard.giuKho(khoId);
        // Khóa dòng kệ như lúc khóa lô: lô đang được khóa lên kệ này cùng lúc phải xong trước, rồi mới kiểm "chờ nhập".
        // Khóa TRƯỚC mọi lệnh đọc thường: ở REPEATABLE READ (mặc định của MySQL), lệnh đọc thường đầu tiên chốt ảnh dữ liệu
        // cho cả giao dịch, đọc trước khi có khóa thì không thấy lô vừa khóa lên kệ. Quyền kho vẫn kiểm trước khi báo 404.
        Optional<ViTriKho> keDaKhoa = viTriKhoRepository.khoaTheoId(viTriId);
        kiemTraGhiKho(khoId);
        ViTriKho viTri = keDaKhoa
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.viTriKhongTimThay", viTriId)));

        if (!viTri.getKhuVucKho().getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.viTriKhongThuocKho"));
        }
        if (khoaKiemKeGuard != null) {
            khoaKiemKeGuard.kiemTraKe(viTriId, "xóa kệ");
            List<String> dotDung = khoaKiemKeGuard.dotTungDungKe(viTriId);
            if (!dotDung.isEmpty()) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.keDaCoTrongKiemKe",
                        viTri.getMaViTri(), String.join(", ", dotDung)));
            }
        }
        if (phanBoKeService != null) {
            List<String> phieuNhat = phanBoKeService.phieuDangGiuKe(viTriId);
            if (!phieuNhat.isEmpty()) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.keDangPhanBoPhieuNhat",
                        viTri.getMaViTri(), String.join(", ", phieuNhat)));
            }
        }

        int dangChua = tonKhoViTriRepository.sumDangChuaByViTriId(viTriId);
        if (dangChua > 0) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.keDangChuaSanPham", dangChua));
        }
        // Tổng có thể về 0 khi có dòng âm bù dòng dương: dòng dương còn lại sẽ trỏ tới kệ đã xóa
        if (tonKhoViTriRepository.existsByViTriKho_IdAndSoLuongGreaterThan(viTriId, 0)) {
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("chungTuKho.keConLoTonLech", viTri.getMaViTri()));
        }

        // Lô đã khóa của phiếu Nháp còn chờ lên kệ: xóa kệ thì lô trỏ tới kệ không còn, phiếu không nhập kho được
        List<Object[]> choNhap = chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(viTriId);
        if (choNhap != null && !choNhap.isEmpty()) {
            long soLo = 0;
            long soHang = 0;
            List<String> dsPhieu = new ArrayList<>();
            for (Object[] dong : choNhap) {
                dsPhieu.add(String.valueOf(dong[0]));
                soLo += ((Number) dong[1]).longValue();
                soHang += ((Number) dong[2]).longValue();
            }
            throw new CommonException(HttpStatus.CONFLICT, soHang > 0
                    ? ThongDiep.of("chungTuKho.keDangChoNhapCuaPhieu", viTri.getMaViTri(), soHang, String.join(", ", dsPhieu))
                    : ThongDiep.of("chungTuKho.keDangGanLoKhoaCuaPhieu", viTri.getMaViTri(), soLo, String.join(", ", dsPhieu)));
        }

        // Lô đã nhập kho từng nằm trên kệ (kệ nay trống): gỡ kệ khỏi lô và bỏ các dòng tồn số 0 của kệ, để không còn gì
        // trỏ tới kệ đã xóa. Lịch sử giao dịch vẫn giữ mã kệ trong ghi chú.
        // Lấy id lô trước rồi gỡ theo khóa chính: cột kệ của lô không có chỉ mục, UPDATE theo cột đó sẽ quét và khóa cả bảng
        // lô tới hết giao dịch (chặn bán hàng, xuất kho). Đang giữ khóa kệ nên không có lô mới gắn vào kệ giữa hai lệnh.
        List<Integer> loTrenKe = loHangRepository.idLoTheoViTri(viTriId);
        if (loTrenKe != null && !loTrenKe.isEmpty()) {
            loHangRepository.goViTriKho(loTrenKe);
        }
        tonKhoViTriRepository.xoaDongSoKhongTheoViTri(viTriId);
        // Dòng kệ của phiếu nhặt đã hủy / đã xuất xong (không còn nghĩa) cũng trỏ tới kệ: bỏ trước khi xóa
        if (phanBoKeService != null) phanBoKeService.xoaDongCuCuaKe(viTriId);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.vi_tri_kho, viTri.getId(), IHanhDong.xoa_vi_tri)
                .ma(viTri.getMaViTri()).kho(khoId)
                .cu(anhViTri(viTri)));
        viTriKhoRepository.delete(viTri);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LoTrenKeDto> loTrenKe(Integer khoId, Integer viTriId) {
        kiemTraXemKho(khoId);
        // kệ phải thuộc kho trên đường dẫn (không thì xem được lô trên kệ của kho khác)
        viTriKhoRepository.findById(viTriId).ifPresent(viTri -> {
            if (viTri.getKhuVucKho() == null || viTri.getKhuVucKho().getKho() == null
                    || !viTri.getKhuVucKho().getKho().getId().equals(khoId)) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.viTriKhongThuocKho"));
            }
        });
        List<TonKhoViTri> activeLots = tonKhoViTriRepository.findActiveLotsByViTriId(viTriId);
        return activeLots.stream().map(t -> LoTrenKeDto.builder()
                .maLo(t.getLoHang() != null ? t.getLoHang().getMaLo() : "—")
                .tenBienThe(t.getBienTheSanPham() != null && t.getBienTheSanPham().getSanPham() != null
                        ? t.getBienTheSanPham().getSanPham().getTenSanPham() + " (" + t.getBienTheSanPham().getMaSku() + ")"
                        : "—")
                .soLuong(t.getSoLuong())
                .build()
        ).toList();
    }

    // ── Mặt bằng ──

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> layMatBang(Integer khoId) {
        kiemTraXemKho(khoId);
        Optional<MatBangKho> opt = matBangKhoRepository.findByKho_Id(khoId);
        if (opt.isEmpty()) return null;

        try {
            return objectMapper.readValue(opt.get().getCauHinhJson(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Không đọc được JSON mặt bằng kho {}: {}", khoId, e.getMessage());
            return null;
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> luuMatBang(Integer khoId, Map<String, Object> matBang) {
        Kho kho = khoRepository.findById(khoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.khoKhongTimThay", khoId)));
        KhoDangChon.kiemTra(kho, "Sơ đồ kho " + kho.getTenKho());

        MatBangKho entity = matBangKhoRepository.findByKho_Id(khoId)
                .orElse(MatBangKho.builder().kho(kho).build());
        Map<String, Object> matBangCu = docMatBang(entity.getCauHinhJson());

        entity.setSoCot(matBang.get("soCot") != null ? ((Number) matBang.get("soCot")).intValue() : 20);
        entity.setSoHang(matBang.get("soHang") != null ? ((Number) matBang.get("soHang")).intValue() : 20);

        try {
            entity.setCauHinhJson(objectMapper.writeValueAsString(matBang));
        } catch (Exception e) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.matBangKhongHopLe", e.getMessage()));
        }

        MatBangKho daLuu = matBangKhoRepository.save(entity);
        // Chỉ ghi tóm tắt (kích thước lưới, số khu, số vật, số mục đổi), không ghi cả JSON mặt bằng
        int soMucDoi = soMucDoi(matBangCu, matBang);
        Map<String, Object> tomTatMoi = tomTatMatBang(matBang);
        Map<String, Object> tomTatCu = matBangCu == null ? null : tomTatMatBang(matBangCu);
        if (tomTatCu == null || soMucDoi > 0 || !tomTatCu.equals(tomTatMoi)) {
            Map<String, Object> moi = new LinkedHashMap<>(tomTatMoi);
            moi.put("soMucDoi", soMucDoi);
            ghiNhatKy(NhatKyNghiepVu.dong(ITable.mat_bang_kho, daLuu.getId(), IHanhDong.luu_mat_bang)
                    .ma(kho.getMaKho()).kho(khoId)
                    .cu(tomTatCu)
                    .moi(moi));
        }
        return matBang;
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    private static Map<String, Object> anhKhuVuc(KhuVucKho k) {
        return NhatKyNghiepVu.anh(
                "maKhuVuc", k.getMaKhuVuc(),
                "tenKhuVuc", k.getTenKhuVuc(),
                "loaiKhu", k.getLoaiKhu(),
                "ghiChu", k.getGhiChu());
    }

    private static Map<String, Object> anhViTri(ViTriKho v) {
        return NhatKyNghiepVu.anh(
                "maViTri", v.getMaViTri(),
                "khuVuc", v.getKhuVucKho() == null ? null : v.getKhuVucKho().getTenKhuVuc(),
                "sucChua", v.getSucChuaToiDa(),
                "trangThai", v.getTrangThai());
    }

    private Map<String, Object> docMatBang(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    /** soCot, soHang, soKhuVuc (vật loại khuVuc), soVat (mọi vật khác: cửa, lối đi…). */
    static Map<String, Object> tomTatMatBang(Map<String, Object> mb) {
        int soKhu = 0;
        int soVat = 0;
        for (Map.Entry<String, Object> e : mb.entrySet()) {
            Object v = e.getValue();
            int n = v instanceof Collection<?> c ? c.size() : (v instanceof Map<?, ?> m ? m.size() : 0);
            if ("khuVuc".equals(e.getKey())) soKhu += n;
            else soVat += n;
        }
        return NhatKyNghiepVu.anh("soCot", mb.get("soCot"), "soHang", mb.get("soHang"), "soKhuVuc", soKhu, "soVat", soVat);
    }

    /** Số vật thêm / bớt / đổi: so từng phần tử của các danh sách theo vị trí, của các bảng theo khóa. */
    static int soMucDoi(Map<String, Object> cu, Map<String, Object> moi) {
        Map<String, Object> a0 = cu == null ? Map.of() : cu;
        Map<String, Object> b0 = moi == null ? Map.of() : moi;
        Set<String> khoa = new HashSet<>(a0.keySet());
        khoa.addAll(b0.keySet());
        int dem = 0;
        for (String k : khoa) {
            Object a = a0.get(k);
            Object b = b0.get(k);
            if (a instanceof List<?> || b instanceof List<?>) {
                List<?> x = a instanceof List<?> l1 ? l1 : List.of();
                List<?> y = b instanceof List<?> l2 ? l2 : List.of();
                int n = Math.max(x.size(), y.size());
                for (int i = 0; i < n; i++) {
                    Object u = i < x.size() ? x.get(i) : null;
                    Object w = i < y.size() ? y.get(i) : null;
                    if (!Objects.equals(u, w)) dem++;
                }
            } else if (a instanceof Map<?, ?> || b instanceof Map<?, ?>) {
                Map<?, ?> x = a instanceof Map<?, ?> m1 ? m1 : Map.of();
                Map<?, ?> y = b instanceof Map<?, ?> m2 ? m2 : Map.of();
                Set<Object> ks = new HashSet<>(x.keySet());
                ks.addAll(y.keySet());
                for (Object kk : ks) {
                    if (!Objects.equals(x.get(kk), y.get(kk))) dem++;
                }
            }
        }
        return dem;
    }
}

