package com.dev.backend.services.impl.entities;

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
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.KhuVucKhoRepository;
import com.dev.backend.repository.MatBangKhoRepository;
import com.dev.backend.repository.TonKhoViTriRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import com.dev.backend.services.ViTriKhoService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

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
    ObjectMapper objectMapper;

    // ── Khu vực ──

    @Override
    @Transactional(readOnly = true)
    public List<KhuVucKhoDto> dsKhuVuc(Integer khoId) {
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
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy kho ID: " + khoId));

        String ma = request.getMaKhuVuc() != null ? request.getMaKhuVuc().trim().toUpperCase() : "";
        if (ma.isBlank()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Mã khu vực không được để trống");
        }
        if (khuVucKhoRepository.existsByKho_IdAndMaKhuVuc(khoId, ma)) {
            throw new CommonException(HttpStatus.CONFLICT, "Mã khu vực `" + ma + "` đã tồn tại trong kho này");
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
        KhuVucKho khuVuc = khuVucKhoRepository.findById(khuVucId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy khu vực ID: " + khuVucId));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Khu vực không thuộc kho chỉ định");
        }

        if (request.getTenKhuVuc() != null && !request.getTenKhuVuc().isBlank()) {
            khuVuc.setTenKhuVuc(request.getTenKhuVuc().trim());
        }
        if (request.getLoaiKhu() != null && !request.getLoaiKhu().isBlank()) {
            khuVuc.setLoaiKhu(request.getLoaiKhu());
        }
        khuVuc.setGhiChu(request.getGhiChu());

        KhuVucKho saved = khuVucKhoRepository.save(khuVuc);
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
        KhuVucKho khuVuc = khuVucKhoRepository.findById(khuVucId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy khu vực ID: " + khuVucId));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Khu vực không thuộc kho chỉ định");
        }

        long count = viTriKhoRepository.countByKhuVucKho_Id(khuVucId);
        if (count > 0) {
            throw new CommonException(HttpStatus.CONFLICT, "Khu vực đang chứa " + count + " vị trí kệ, không thể xóa");
        }

        khuVucKhoRepository.delete(khuVuc);
    }

    // ── Vị trí kệ ──

    @Override
    @Transactional(readOnly = true)
    public List<ViTriKhoDto> dsViTri(Integer khoId) {
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
                .trangThai(v.getTrangThai())
                .build()
        ).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ViTriKhoDto> dsViTriKhaDung(Integer khoId) {
        // Lấy danh sách vị trí HOAT_DONG và còn sức chứa để hiện ở dropdown khi khóa lô
        return dsViTri(khoId).stream()
                .filter(v -> "HOAT_DONG".equalsIgnoreCase(v.getTrangThai()))
                .filter(v -> v.getDangChua() < v.getSucChua())
                .toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<ViTriKhoDto> taoViTri(Integer khoId, ViTriKhoRequest request) {
        if (request.getKhuVucId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Vui lòng chọn khu vực kho");
        }
        KhuVucKho khuVuc = khuVucKhoRepository.findById(request.getKhuVucId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy khu vực ID: " + request.getKhuVucId()));

        if (!khuVuc.getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Khu vực không thuộc kho chỉ định");
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
                throw new CommonException(HttpStatus.BAD_REQUEST, "Mã vị trí kệ không được để trống");
            }
            if (viTriKhoRepository.existsByKho_IdAndMaViTri(khoId, ma)) {
                throw new CommonException(HttpStatus.CONFLICT, "Mã vị trí `" + ma + "` đã tồn tại trong kho này");
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
        ViTriKho viTri = viTriKhoRepository.findById(viTriId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy vị trí ID: " + viTriId));

        if (!viTri.getKhuVucKho().getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Vị trí không thuộc kho chỉ định");
        }

        if (request.getKhuVucId() != null && !request.getKhuVucId().equals(viTri.getKhuVucKho().getId())) {
            KhuVucKho khuMoi = khuVucKhoRepository.findById(request.getKhuVucId())
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy khu vực mới"));
            if (!khuMoi.getKho().getId().equals(khoId)) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Khu vực mới không cùng kho");
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
        int dangChua = tonKhoViTriRepository.sumDangChuaByViTriId(saved.getId());

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
                .trangThai(saved.getTrangThai())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaViTri(Integer khoId, Integer viTriId) {
        ViTriKho viTri = viTriKhoRepository.findById(viTriId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy vị trí ID: " + viTriId));

        if (!viTri.getKhuVucKho().getKho().getId().equals(khoId)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Vị trí không thuộc kho chỉ định");
        }

        int dangChua = tonKhoViTriRepository.sumDangChuaByViTriId(viTriId);
        if (dangChua > 0) {
            throw new CommonException(HttpStatus.CONFLICT, "Kệ đang chứa " + dangChua + " sản phẩm, không thể xóa!");
        }

        viTriKhoRepository.delete(viTri);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LoTrenKeDto> loTrenKe(Integer khoId, Integer viTriId) {
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
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy kho ID: " + khoId));

        MatBangKho entity = matBangKhoRepository.findByKho_Id(khoId)
                .orElse(MatBangKho.builder().kho(kho).build());

        entity.setSoCot(matBang.get("soCot") != null ? ((Number) matBang.get("soCot")).intValue() : 20);
        entity.setSoHang(matBang.get("soHang") != null ? ((Number) matBang.get("soHang")).intValue() : 20);

        try {
            entity.setCauHinhJson(objectMapper.writeValueAsString(matBang));
        } catch (Exception e) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Cấu trúc mặt bằng không hợp lệ: " + e.getMessage());
        }

        matBangKhoRepository.save(entity);
        return matBang;
    }
}

