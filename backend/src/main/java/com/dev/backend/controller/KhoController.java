package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterLogicType;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.request.KhoCreating;
import com.dev.backend.dto.request.KhoTrangThaiUpdating;
import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.dto.response.KhoTomTatResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.impl.entities.KhoService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/kho")
public class KhoController {
    @Autowired
    private KhoService khoService;

    @Autowired
    private KhoMapper khoMapper;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private JwtService jwtService;


    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}
    )
    public ResponseEntity<ResponseData<KhoDto>> getById(@PathVariable Integer id) {
        Optional<Kho> findingKho = khoService.getOne(id);
        if (findingKho.isEmpty()) {
            throw new CommonException("Không tìm thấy kho id: " + id);
        }
        KhoDto dto = khoMapper.toDto(findingKho.get());
        ganSoLuongTon(List.of(dto));
        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message("Success")
                        .build()
        );
    }

    /**
     * Số liệu tóm tắt cho popup Chi tiết kho: tồn, khả dụng, giá trị theo giá vốn lô, số mã hàng
     * (hết / sắp hết) và số người được phân quyền. Quản lý kho chỉ xem được kho mình được phân quyền
     * (kiểm tra theo id trên đường dẫn, không theo kho làm việc).
     */
    @GetMapping("/{id}/tom-tat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}
    )
    public ResponseEntity<ResponseData<KhoTomTatResponse>> tomTat(@PathVariable Integer id) {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        boolean laQuanTriVien = nguoiDung != null && nguoiDung.getVaiTro() != null
                && nguoiDung.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!laQuanTriVien && (nguoiDung == null || nguoiDung.getPhanQuyenNguoiDungKhos() == null
                || !jwtService.inWorkspace(id, nguoiDung))) {
            throw new CommonException("Bạn không phụ trách kho này nên không xem được số liệu tồn kho", HttpStatus.FORBIDDEN, null);
        }
        return ResponseEntity.ok(
                ResponseData.<KhoTomTatResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoService.tomTat(id))
                        .message("Success")
                        .build()
        );
    }

    /** Ngừng hoạt động (0) / cho phép hoạt động lại (1). Kho Trung Chuyển (kho ảo) luôn hoạt động. */
    @PutMapping("/{id}/trang-thai")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<KhoDto>> doiTrangThai(@PathVariable Integer id,
                                                           @Valid @RequestBody KhoTrangThaiUpdating updating) {
        KhoDto dto = khoMapper.toDto(khoService.doiTrangThai(id, updating.getTrangThai()));
        ganSoLuongTon(List.of(dto));
        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message(Integer.valueOf(1).equals(dto.getTrangThai())
                                ? "Đã cho phép kho hoạt động lại"
                                : "Đã ngừng hoạt động kho")
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(
            roles = {IRoleType.all}
    )
    public ResponseEntity<ResponseData<Page<KhoDto>>> filter(@RequestBody BaseFilterRequest filter) {
        Page<KhoDto> page = khoMapper.toDtoPage(khoService.filter(filter));
        ganSoLuongTon(page.getContent());
        return ResponseEntity.ok(
                ResponseData.<Page<KhoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(page)
                        .message("Success")
                        .build()
        );
    }

    /** Điền tổng tồn cho các kho trong trang bằng một truy vấn gộp (kho chưa có lô nào = 0). */
    private void ganSoLuongTon(List<KhoDto> dsKho) {
        if (dsKho == null || dsKho.isEmpty()) return;
        List<Integer> khoIds = dsKho.stream().map(KhoDto::getId).toList();
        Map<Integer, BigDecimal> tongTheoKho = new HashMap<>();
        for (Object[] dong : tonKhoTheoLoRepository.sumSoLuongTonTheoKho(khoIds)) {
            tongTheoKho.put(((Number) dong[0]).intValue(), dong[1] == null ? BigDecimal.ZERO : new BigDecimal(dong[1].toString()));
        }
        dsKho.forEach(kho -> kho.setSoLuongTon(tongTheoKho.getOrDefault(kho.getId(), BigDecimal.ZERO)));
    }

    @GetMapping("/all")
    public ResponseEntity<ResponseData<List<KhoDto>>> all() {
        return ResponseEntity.ok(
                ResponseData.<List<KhoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDtoList(khoService.getAll()))
                        .message("Success")
                        .build()
        );
    }

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<KhoDto>> create(@RequestBody KhoCreating creating) {
        return khoService.create(creating);
    }

    @PutMapping("/update")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<KhoDto>> update(@RequestBody KhoUpdating updating) {
        return khoService.update(updating);
    }

    @DeleteMapping("soft-delete/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<String>> softDelete(@PathVariable Integer id) {
        // "Xóa" kho chỉ là ngừng hoạt động: tồn kho và lịch sử giữ nguyên, cho phép hoạt động lại được.
        // Giữ đường dẫn cũ cho nơi khác còn gọi; giao diện dùng PUT /{id}/trang-thai.
        khoService.doiTrangThai(id, 0);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()
        );
    }

    @PostMapping("/mine")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<KhoDto>>> getMyWarehouses(@RequestBody BaseFilterRequest filter) {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin) {
            List<Integer> assignedWarehouseIds = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndActive(currentUser.getId())
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();
            if (assignedWarehouseIds.isEmpty()) {
                return ResponseEntity.ok(
                        ResponseData.<Page<KhoDto>>builder()
                                .status(HttpStatus.OK.value())
                                .data(Page.empty())
                                .message("Bạn chưa được giao phụ trách kho nào.")
                                .build()
                );
            }
            if (filter.getFilters() == null) {
                filter.setFilters(new ArrayList<>());
            }

            filter.getFilters().add(FilterCriteria.builder()
                    .fieldName("id")
                    .operation(FilterOperation.IN)
                    .value(assignedWarehouseIds)
                    .logicType(FilterLogicType.AND)
                    .build());
        }
        return ResponseEntity.ok(
                ResponseData.<Page<KhoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDtoPage(khoService.filter(filter)))
                        .message("Lấy danh sách kho phụ trách thành công")
                        .build()
        );
    }
}
