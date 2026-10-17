package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.MaVachNhaCungCap;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.MaVachNhaCungCapService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MaVachNhaCungCapServiceImpl implements MaVachNhaCungCapService {

    MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    NhaCungCapRepository nhaCungCapRepository;
    PhieuNhapKhoRepository phieuNhapKhoRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<MaVachNhaCungCapDto> timKiem(String q, Integer nhaCungCapId, Pageable pageable) {
        String queryStr = (q != null && !q.isBlank()) ? q.trim() : null;
        return maVachNhaCungCapRepository.searchMappings(nhaCungCapId, queryStr, pageable).map(this::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public TraCuuMaVachResponse traCuu(String maVach, Integer nhaCungCapId) {
        if (maVach == null || maVach.isBlank()) {
            return TraCuuMaVachResponse.builder()
                    .timThay(false)
                    .loaiMa("LA")
                    .canMapNhanh(true)
                    .build();
        }

        String code = maVach.trim();

        // 1. Kiểm tra mã nội bộ FCentric (SKU hoặc Barcode)
        Optional<BienTheSanPham> optBt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(code);
        if (optBt.isPresent()) {
            BienTheSanPham bt = optBt.get();
            return TraCuuMaVachResponse.builder()
                    .timThay(true)
                    .loaiMa("FCENTRIC")
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .barcode(code)
                    .canMapNhanh(false)
                    .build();
        }

        // 2. Kiểm tra mã NCC theo nhà cung cấp (hoặc tra cứu chung)
        Optional<MaVachNhaCungCap> optMap = (nhaCungCapId != null && nhaCungCapId > 0)
                ? maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id(code, nhaCungCapId)
                : maVachNhaCungCapRepository.findFirstByBarcodeNcc(code);

        if (optMap.isPresent()) {
            MaVachNhaCungCap map = optMap.get();
            BienTheSanPham bt = map.getBienTheSanPham();
            return TraCuuMaVachResponse.builder()
                    .timThay(true)
                    .loaiMa("NCC")
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .barcode(code)
                    .canMapNhanh(false)
                    .build();
        }

        // 3. Mã lạ chưa từng xuất hiện
        return TraCuuMaVachResponse.builder()
                .timThay(false)
                .loaiMa("LA")
                .barcode(code)
                .canMapNhanh(true)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaVachNhaCungCapDto lienKet(MaVachLienKetRequest request) {
        if (request.getMaVach() == null || request.getMaVach().isBlank()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Mã vạch không được để trống");
        }
        if (request.getNhaCungCapId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Nhà cung cấp không được để trống");
        }
        if (request.getBienTheSanPhamId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Biến thể sản phẩm không được để trống");
        }

        String maVach = request.getMaVach().trim();
        NhaCungCap ncc = nhaCungCapRepository.findById(request.getNhaCungCapId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp ID: " + request.getNhaCungCapId()));

        BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biến thể ID: " + request.getBienTheSanPhamId()));

        PhieuNhapKho phieu = null;
        if (request.getPhieuNhapKhoId() != null) {
            phieu = phieuNhapKhoRepository.findById(request.getPhieuNhapKhoId()).orElse(null);
        }

        // Kiểm tra xem đã có mapping cho mã này của NCC này chưa
        MaVachNhaCungCap entity = maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id(maVach, ncc.getId())
                .orElse(MaVachNhaCungCap.builder()
                        .nhaCungCap(ncc)
                        .barcodeNcc(maVach)
                        .build());

        entity.setBienTheSanPham(bt);
        entity.setMaSanPhamNcc(request.getMaHangNcc());
        entity.setPhieuNhapKho(phieu);
        entity.setGhiChu(request.getGhiChu());

        MaVachNhaCungCap saved = maVachNhaCungCapRepository.save(entity);
        log.info("[BARCODE-MAP] Đã liên kết mã vạch NCC `{}` với SKU `{}` (NCC ID: {})", maVach, bt.getMaSku(), ncc.getId());
        return toDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void huyLienKet(Integer id) {
        MaVachNhaCungCap entity = maVachNhaCungCapRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy liên kết ID: " + id));
        maVachNhaCungCapRepository.delete(entity);
        log.info("[BARCODE-MAP] Đã gỡ liên kết mã vạch NCC ID `{}` (Barcode: {})", id, entity.getBarcodeNcc());
    }

    private MaVachNhaCungCapDto toDto(MaVachNhaCungCap m) {
        return MaVachNhaCungCapDto.builder()
                .id(m.getId())
                .maVach(m.getBarcodeNcc())
                .maHangNcc(m.getMaSanPhamNcc())
                .nhaCungCapId(m.getNhaCungCap().getId())
                .tenNhaCungCap(m.getNhaCungCap().getTenNhaCungCap())
                .bienTheSanPhamId(m.getBienTheSanPham().getId())
                .tenBienThe(m.getBienTheSanPham().getSanPham() != null ? m.getBienTheSanPham().getSanPham().getTenSanPham() : m.getBienTheSanPham().getMaSku())
                .sku(m.getBienTheSanPham().getMaSku())
                .ngayLienKet(m.getNgayTao())
                .phieuNhapKhoId(m.getPhieuNhapKho() != null ? m.getPhieuNhapKho().getId() : null)
                .soPhieuNhap(m.getPhieuNhapKho() != null ? m.getPhieuNhapKho().getSoPhieuNhap() : null)
                .build();
    }
}

