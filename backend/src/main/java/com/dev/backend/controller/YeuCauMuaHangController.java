package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.YeuCauMuaHangMapper;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/yeu-cau-mua-hang")
public class YeuCauMuaHangController {

    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;
    @Autowired
    private YeuCauMuaHangMapper yeuCauMuaHangMapper;

    // Xem chi tiết yêu cầu nhập hàng (kèm lý do từ chối / ngày duyệt từ lịch sử).
    // Bắt buộc đăng nhập: dữ liệu có email, SĐT người tạo và quản lý kho.
    // SRS 4.4 "Purchase Request": quản lý kho, nhân viên kho; nhân viên mua hàng chỉ xem
    @GetMapping("/get-by-id/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<YeuCauMuaHangDto>> getById(@PathVariable Integer id) {
        com.dev.backend.entities.YeuCauMuaHang yeuCau = yeuCauMuaHangService.getOne(id).orElseThrow(
                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.yeuCauMuaKhongTimThay", id)));
        YeuCauMuaHangDto dto = locDonMua(yeuCauMuaHangService.boSungThongTinDuyet(yeuCauMuaHangMapper.toDto(yeuCau)));
        // Hạn báo giá của từng đơn kèm theo, và hạn nếu gửi ngay (màn Gửi yêu cầu báo giá)
        yeuCauMuaHangService.boSungHanBaoGia(dto, yeuCau);
        return ResponseEntity.ok(
                ResponseData.<YeuCauMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(dto)
                        .build()
        );
    }

    // Đơn mua kèm theo: quản lý kho / nhân viên kho chỉ thấy đơn của kho mình (cùng luật xem đơn mua)
    private YeuCauMuaHangDto locDonMua(YeuCauMuaHangDto dto) {
        com.dev.backend.services.impl.entities.DonMuaHangService.locDonMuaTheoPhamVi(dto,
                com.dev.backend.config.SecurityContextHolder.getUser());
        return dto;
    }

    // Filter yêu cầu nhập hàng theo các trường của entity (bắt buộc đăng nhập)
    @PostMapping("/filter")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<Page<YeuCauMuaHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        Page<com.dev.backend.entities.YeuCauMuaHang> trangGoc = yeuCauMuaHangService.filter(filter);
        Page<YeuCauMuaHangDto> trang = yeuCauMuaHangMapper.toDtoPage(trangGoc).map(this::locDonMua);
        // Hạn báo giá của các đơn kèm theo: danh sách yêu cầu báo giá hiện Hết hạn theo giờ
        for (int i = 0; i < trang.getContent().size() && i < trangGoc.getContent().size(); i++) {
            yeuCauMuaHangService.boSungHanBaoGia(trang.getContent().get(i), trangGoc.getContent().get(i));
        }
        return ResponseEntity.ok(
                ResponseData.<Page<YeuCauMuaHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(trang)
                        .message("Success")
                        .build()
        );
    }
}