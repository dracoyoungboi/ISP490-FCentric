package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.BienBanTraHangService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BienBanTraHangServiceImpl implements BienBanTraHangService {

    BienBanTraHangNccRepository bienBanTraHangNccRepository;
    ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    PhieuNhapKhoRepository phieuNhapKhoRepository;
    NguoiDungRepository nguoiDungRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    LoHangRepository loHangRepository;

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId) {
        Optional<BienBanTraHangNcc> opt = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId);
        return opt.map(this::toDto).orElse(null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId) {
        PhieuNhapKho phieu = phieuNhapKhoRepository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập kho ID: " + phieuNhapKhoId));

        if (phieu.getNhaCungCap() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu nhập không có thông tin Nhà cung cấp để lập biên bản trả hàng");
        }

        NguoiDung nguoiTao = nguoiDungRepository.findById(nguoiTaoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người tạo ID: " + nguoiTaoId));

        // Nếu đã có biên bản RTV cho phiếu này thì cập nhật
        BienBanTraHangNcc bienBan = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId)
                .orElse(null);

        if (bienBan == null) {
            String maBb = sinhMaBienBan();
            bienBan = BienBanTraHangNcc.builder()
                    .maBienBan(maBb)
                    .phieuNhapKho(phieu)
                    .nhaCungCap(phieu.getNhaCungCap())
                    .nguoiTao(nguoiTao)
                    .build();
        }

        bienBan.setPhuongAnXuLy(request.getPhuongAn() != null ? request.getPhuongAn() : "DOI_HANG_MOI");
        bienBan.setGhiChu(request.getGhiChu());
        bienBan.setTrangThai("CHO_TRA_HANG");

        // Xóa chi tiết cũ nếu cập nhật
        if (bienBan.getId() != null) {
            List<ChiTietTraHangNcc> oldItems = chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId());
            chiTietTraHangNccRepository.deleteAll(oldItems);
        }

        BienBanTraHangNcc savedHeader = bienBanTraHangNccRepository.save(bienBan);

        int tongLoi = 0;
        List<ChiTietTraHangNcc> chiTietList = new ArrayList<>();

        if (request.getItems() != null) {
            for (PhatHanhBienBanRequest.ItemLoiRequest it : request.getItems()) {
                if (it.getSoLuong() == null || it.getSoLuong() <= 0) continue;
                BienTheSanPham bt = bienTheSanPhamRepository.findById(it.getBienTheSanPhamId())
                        .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biến thể ID: " + it.getBienTheSanPhamId()));

                LoHang lo = null;
                if (it.getMaLo() != null && !it.getMaLo().isBlank()) {
                    lo = loHangRepository.findFirstByMaLo(it.getMaLo().trim()).orElse(null);
                }

                ChiTietTraHangNcc ct = ChiTietTraHangNcc.builder()
                        .bienBanTraHangNcc(savedHeader)
                        .bienTheSanPham(bt)
                        .loHang(lo)
                        .maLo(it.getMaLo())
                        .soLuongLoi(it.getSoLuong())
                        .lyDoLoi(it.getLyDo() != null ? it.getLyDo() : "KHAC")
                        .anhBangChungUrl(it.getAnhBangChungUrl())
                        .ghiChu(it.getGhiChu())
                        .build();

                chiTietList.add(ct);
                tongLoi += it.getSoLuong();
            }
        }

        chiTietTraHangNccRepository.saveAll(chiTietList);
        savedHeader.setTongSoLuongLoi(tongLoi);
        bienBanTraHangNccRepository.save(savedHeader);

        log.info("[RTV-ISSUED] Đã phát hành biên bản trả hàng NCC `{}` cho phiếu nhập `{}` với {} sản phẩm lỗi",
                savedHeader.getMaBienBan(), phieu.getSoPhieuNhap(), tongLoi);

        return toDto(savedHeader);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BienBanTraHangDto> dsTheoNhaCungCap(Integer nhaCungCapId) {
        return bienBanTraHangNccRepository.findByNhaCungCap_IdOrderByNgayTaoDesc(nhaCungCapId)
                .stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto chiTiet(Integer id) {
        BienBanTraHangNcc b = bienBanTraHangNccRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biên bản trả hàng ID: " + id));
        return toDto(b);
    }

    private String sinhMaBienBan() {
        String ngay = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = bienBanTraHangNccRepository.count() + 1;
        return String.format("RTV-%s-%03d", ngay, count % 1000);
    }

    private BienBanTraHangDto toDto(BienBanTraHangNcc b) {
        List<ChiTietTraHangNcc> chiTiets = chiTietTraHangNccRepository.findDetailByBienBanId(b.getId());
        List<BienBanTraHangDto.ChiTietItemDto> items = chiTiets.stream().map(c -> {
            BienTheSanPham bt = c.getBienTheSanPham();
            return BienBanTraHangDto.ChiTietItemDto.builder()
                    .id(c.getId())
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .maLo(c.getMaLo())
                    .lyDo(c.getLyDoLoi())
                    .soLuong(c.getSoLuongLoi())
                    .anhBangChungUrl(c.getAnhBangChungUrl())
                    .ghiChu(c.getGhiChu())
                    .build();
        }).toList();

        return BienBanTraHangDto.builder()
                .id(b.getId())
                .soBienBan(b.getMaBienBan())
                .phieuNhapKhoId(b.getPhieuNhapKho().getId())
                .soPhieuNhap(b.getPhieuNhapKho().getSoPhieuNhap())
                .nhaCungCapId(b.getNhaCungCap().getId())
                .tenNhaCungCap(b.getNhaCungCap().getTenNhaCungCap())
                .phuongAn(b.getPhuongAnXuLy())
                .ghiChu(b.getGhiChu())
                .ngayLap(b.getNgayTao())
                .tongSoLuongLoi(b.getTongSoLuongLoi())
                .trangThai(b.getTrangThai())
                .items(items)
                .build();
    }
}

