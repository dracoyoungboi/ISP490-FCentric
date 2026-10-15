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
import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.entities.KhoService;
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


    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}
    )
    public ResponseEntity<ResponseData<KhoDto>> getById(@PathVariable Integer id) {
        Optional<Kho> findingKho = khoService.getOne(id);
        if (findingKho.isEmpty()) {
            throw new CommonException("Không tìm thấy kho id: " + id);
        }
        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDto(findingKho.get()))
                        .message("Success")
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
        Optional<Kho> findingKho = khoService.getOne(id);
        if (findingKho.isEmpty()) {
            throw new CommonException("Không tìm thấy kho id: " + id);
        }
        Kho kho = findingKho.get();
        kho.setTrangThai(0);
        khoService.update(kho.getId(), kho);
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
