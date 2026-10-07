// src/main/java/com/dev/backend/services/impl/entities/KhachHangService.java
package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.KhachHangDetailDto;
import com.dev.backend.dto.response.customize.LichSuMuaHangDto;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class KhachHangService extends BaseServiceImpl<KhachHang, Integer> {

    private final KhachHangRepository repository;
    private final KhachHangMapper mapper;
    private final EntityManager entityManager;
    private final DonBanHangRepository donBanHangRepository; // Thêm repo đơn hàng để lấy lịch sử

    @Autowired
    public KhachHangService(KhachHangRepository repository,
                            KhachHangMapper mapper,
                            EntityManager entityManager,
                            DonBanHangRepository donBanHangRepository) {
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
        this.donBanHangRepository = donBanHangRepository;
    }

    private final KhachHangRepository khachHangRepository = (KhachHangRepository) getRepository();

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    // Function Customer Details (Cập nhật để trả về Full Lịch Sử Mua Hàng)
    @Transactional(readOnly = true)
    public KhachHangDetailDto getKhachHangDetail(Integer id) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy khách hàng với ID: " + id));

        // Lấy lịch sử mua hàng của khách
        List<DonBanHang> donBanHangs = donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(id);

        // Map sang DTO hiển thị cho bảng Lịch sử
        List<LichSuMuaHangDto> history = donBanHangs.stream().map(don -> LichSuMuaHangDto.builder()
                .maDonHang(don.getSoDonHang())
                .ngay(don.getNgayDatHang())
                .kenh(don.getKenhBanHang() != null ? don.getKenhBanHang().getMaKenh() : "POS") // Đã đổi getKenhBan() thành getKenhBanHang()
                .giaTri(don.getTongCong())
                .build()
        ).collect(Collectors.toList());

        // Map thông tin trả về UI
        return KhachHangDetailDto.builder()
                .id(entity.getId())
                .maKhachHang(entity.getMaKhachHang())
                .tenKhachHang(entity.getTenKhachHang())
                .soDienThoai(entity.getSoDienThoai())
                .email(entity.getEmail())
                .diaChi(entity.getDiaChi())
                .lichSuMuaHang(history)
                .tongSoDonHang(history.size())
                .build();
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> create(KhachHangCreating creating) {
        KhachHang khachHang = khachHangRepository.findByMaKhachHangOrEmailOrSoDienThoai(
                        creating.getMaKhachHang(), creating.getEmail(), creating.getSoDienThoai())
                .orElse(null);

        if(khachHang != null){
            throw new CommonException("Thông tin khách hàng (Mã, Email hoặc SĐT) đã tồn tại");
        }

        KhachHang newKhachHang = KhachHang.builder()
                .maKhachHang(creating.getMaKhachHang())
                .tenKhachHang(creating.getTenKhachHang())
                .nguoiLienHe(creating.getNguoiLienHe())
                .soDienThoai(creating.getSoDienThoai()) // Đã xóa 1 dòng gán SĐT thừa
                .email(creating.getEmail())
                .diaChi(creating.getDiaChi())
                // Đã xóa loại khách hàng vì mặc định là Khách lẻ
                .trangThai(1)
                .build();

        create(newKhachHang);
        return ResponseEntity.ok(ResponseData.<String>builder().status(200).data("Success").message("Success").build());
    }

    // Function Edit Customer
    @Transactional
    public KhachHangDto update(Integer id, KhachHangUpdating updating) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy khách hàng với ID: " + id));

        mapper.partialUpdate(updating, entity);
        entity = repository.save(entity);
        return mapper.toDto(entity);
    }

    @Transactional(readOnly = true)
    public List<KhachHangDto> getAllActiveForSales() {
        return repository.findAll().stream()
                .filter(kh -> kh.getTrangThai() != null && kh.getTrangThai() == 1)
                .map(mapper::toDto)
                .toList();
    }
}