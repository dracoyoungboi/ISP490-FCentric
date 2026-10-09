package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterLogicType;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.request.PhieuXuatKhoCreating;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.request.XacNhanXuatKhoRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PhieuXuatKhoViewDto;
import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.dto.response.customize.XacNhanXuatKhoResponse;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoResponse;
import io.swagger.v3.oas.annotations.Operation;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhieuXuatKhoDto;
import com.dev.backend.dto.response.entities.TonKhoTheoLoDto;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.PhieuXuatKhoMapper;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/phieu-xuat-kho")
public class PhieuXuatKhoController {

    @Autowired
    private PhieuXuatKhoService phieuXuatKhoService;

    @Autowired
    private PhieuXuatKhoMapper phieuXuatKhoMapper;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            permissions = {IPermissionType.tao_phieu_xuat},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public Map<String, Object> create(@RequestBody PhieuXuatKhoCreating request) {
        PhieuXuatKho phieu = phieuXuatKhoService.createFromSO(request);
        return Map.of(
                "id", phieu.getId(),
                "soPhieuXuat", phieu.getSoPhieuXuat()
        );
    }

    @GetMapping("/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ChiTietPhieuNhapKhoResponse getDetail(@PathVariable Integer id) {
        return phieuXuatKhoService.getDetail(id);
    }

    @PostMapping("/{id}/xac-nhan-xuat-kho")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Xác nhận xuất kho & điều phối giao vận chi tiết (SRS 6.3.2)")
    public ResponseEntity<ResponseData<XacNhanXuatKhoResponse>> xacNhanXuatKho(
            @PathVariable Integer id,
            @RequestBody(required = false) XacNhanXuatKhoRequest request
    ) {
        Integer staffId = SecurityContextHolder.getUser().getId();
        XacNhanXuatKhoResponse response = phieuXuatKhoService.xacNhanXuatKho(id, request, staffId);
        return ResponseEntity.ok(
                ResponseData.<XacNhanXuatKhoResponse>builder()
                        .status(HttpStatus.OK.value())
                        .message("Xác nhận xuất kho và cập nhật vận đơn thành công")
                        .data(response)
                        .build()
        );
    }

    @PutMapping("/{id}/complete")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> complete(@PathVariable Integer id) {
        Integer staffId = SecurityContextHolder.getUser().getId();
        phieuXuatKhoService.complete(id, staffId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Xác nhận xuất kho thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @PutMapping("/{id}/cancel")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.huy_phieu_xuat},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> cancel(@PathVariable Integer id) {
        phieuXuatKhoService.cancel(id);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Hủy phiếu xuất thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @PostMapping("/{phieuXuatKhoId}/pick-lo")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> pickLoHang(
            @PathVariable Integer phieuXuatKhoId,
            @RequestBody PickLoHangRequest request
    ) {
        phieuXuatKhoService.pickLoHang(phieuXuatKhoId, request);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Pick lô thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @GetMapping("/{phieuXuatKhoId}/available-lots")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<TonKhoTheoLoDto>>> getAvailableLots(
            @PathVariable Integer phieuXuatKhoId,
            @RequestParam Integer bienTheSanPhamId
    ) {
        List<TonKhoTheoLoDto> data = phieuXuatKhoService.getAvailableLots(
                phieuXuatKhoId,
                bienTheSanPhamId
        );
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoTheoLoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(data)
                        .message("OK")
                        .build()
        );
    }

    @GetMapping("/{phieuXuatKhoId}/picked-lots/{chiTietPhieuXuatKhoId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public List<PickedLotDto> getPickedLots(
            @PathVariable Integer phieuXuatKhoId,
            @PathVariable Integer chiTietPhieuXuatKhoId
    ) {
        return phieuXuatKhoService.getPickedLots(
                phieuXuatKhoId,
                chiTietPhieuXuatKhoId
        );
    }

    @GetMapping("/{id}/view")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            }
    )
    public ResponseEntity<ResponseData<PhieuXuatKhoViewDto>> view(
            @PathVariable Integer id
    ) {

        return ResponseEntity.ok(
                ResponseData.<PhieuXuatKhoViewDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(phieuXuatKhoService.viewForSales(id))
                        .message("Success")
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<PhieuXuatKhoDto>>> filter(@RequestBody BaseFilterRequest request) {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        List<Integer> khoIds = null; // Admin truyền null để lấy tất cả

        if (!isAdmin) {
            // Lấy danh sách ID kho user quản lý
            khoIds = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndActive(currentUser.getId())
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();

            // Nếu không có quyền ở kho nào, trả về list rỗng luôn để tiết kiệm query
            if (khoIds.isEmpty()) {
                return ResponseEntity.ok(
                        ResponseData.<Page<PhieuXuatKhoDto>>builder()
                                .status(HttpStatus.OK.value())
                                .data(Page.empty())
                                .message("Bạn chưa được giao phụ trách kho nào.")
                                .build()
                );
            }
        }

        String keyword = null;
        Integer trangThai = null;
        String tenKho = null;

        // Bóc tách filter từ JSON của Frontend gửi lên
        if (request.getFilters() != null) {
            for (FilterCriteria f : request.getFilters()) {
                if ("soPhieuXuat".equals(f.getFieldName()) || "donBanHang.soDonHang".equals(f.getFieldName())) {
                    keyword = f.getValue() != null ? f.getValue().toString().trim() : null;
                    if (keyword != null && keyword.isEmpty()) keyword = null;
                } else if ("trangThai".equals(f.getFieldName())) {
                    String ttVal = f.getValue() != null ? f.getValue().toString() : "";
                    trangThai = !ttVal.isEmpty() ? Integer.valueOf(ttVal) : null;
                } else if ("kho.tenKho".equals(f.getFieldName())) {
                    tenKho = f.getValue() != null ? f.getValue().toString().trim() : null;
                    if (tenKho != null && tenKho.isEmpty()) tenKho = null;
                }
            }
        }

        // Tự động nhận diện cấu hình Sort từ Frontend (Mặc định: ngayTao DESC)
        Sort sort = Sort.by(Sort.Direction.DESC, "ngayTao");
        if (request.getSorts() != null && !request.getSorts().isEmpty()) {
            String sortField = request.getSorts().get(0).getFieldName();
            Sort.Direction sortDir = "ASC".equalsIgnoreCase(String.valueOf(request.getSorts().get(0).getDirection()))
                    ? Sort.Direction.ASC : Sort.Direction.DESC;
            sort = Sort.by(sortDir, sortField);
        }

        Pageable pageable = PageRequest.of(request.getPage(), request.getSize(), sort);

        // Truyền khoIds (List<Integer>) thay vì khoId (Integer)
        Page<PhieuXuatKho> pageEntity = phieuXuatKhoService.getDanhSachThucXuatCustom(khoIds, keyword, trangThai, tenKho, pageable);
        Page<PhieuXuatKhoDto> pageDto = pageEntity.map(phieuXuatKhoMapper::toDto);

        return ResponseEntity.ok(
                ResponseData.<Page<PhieuXuatKhoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(pageDto)
                        .message("Lấy danh sách thành công")
                        .build()
        );
    }

    @PostMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho
            },
            inWarehouse = true
    )
    public ResponseEntity<ResponseData<PhieuXuatKhoDto>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<PhieuXuatKhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                phieuXuatKhoMapper.toDto(phieuXuatKhoService.getOne(id).orElseThrow(
                                        () -> new CommonException("Không tìm thấy phiếu xuất kho id: " + id)
                                ))
                        )
                        .build()
        );
    }
}