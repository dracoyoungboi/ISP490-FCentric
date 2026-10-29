package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.TonKhoTheoLoMapper;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.impl.entities.TonKhoTheoLoService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/thong-ke-he-thong")
public class ThongKeHeThongController {

    @Autowired
    private ThongKeHeThongService thongKeHeThongService;

    @Autowired
    private TonKhoTheoLoService tonKhoTheoLoService;
    @Autowired
    private TonKhoTheoLoMapper tonKhoTheoLoMapper;
    @Autowired
    private JwtService jwtService;

    @GetMapping("/ton-kho")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang
            },
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> tonKho(
    ) {
        return thongKeHeThongService.findTonKhoChiTietByKho(SecurityContextHolder.getKhoId());
    }


    @GetMapping("/ton-kho-bien-the/{bienTheId}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> tonKhoBienThe(@PathVariable Integer bienTheId) {
        return thongKeHeThongService.findTonKhoChiTietByBienThe(bienTheId);
    }

    @GetMapping("/san-pham/ban-chay/{top}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<SanPhamQuanAoDto>>> sanPhamBanChay(@PathVariable Integer top) {
        return tonKhoTheoLoService.sanPhamBanChay(top);
    }

    //sau khi lấy được danh sách sản phẩm ở trong khoID thì xem được danh sách biến thể của từng sản phẩm
    //sau đó gọi api này để lấy danh sách tồn kho chi tiết của biến thể đó trong kho
    @GetMapping("/ton-kho-bien-the/{khoId}/{bienTheId}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> tonKhoBienThe(@PathVariable Integer khoId, @PathVariable Integer bienTheId) {
        System.out.println("đi qua đây");
        return thongKeHeThongService.findTonKhoChiTietByBienTheAndKho(bienTheId, khoId);
    }

    //api của màn hình BCTK
    @GetMapping("/ton-kho-tong-quan")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<TonKhoProjection>>> tonKhoTongHop(@RequestParam(required = false) Integer khoId, @RequestParam(required = false) String keyword) {
        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();
        if(authInfo.getVaiTro().contains(IRoleType.nhan_vien_kho)){
            if(khoId == null) throw new CommonException("Phải có trường khoId");
            if(!jwtService.inWorkspace(khoId,authInfo)){
                throw new CommonException("Bạn không quản lý kho này");
            }
        }
        return thongKeHeThongService.tonKhoTongHop(khoId, keyword);
    }

}
