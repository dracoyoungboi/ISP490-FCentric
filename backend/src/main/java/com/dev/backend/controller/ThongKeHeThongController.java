package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.mapper.TonKhoTheoLoMapper;
import com.dev.backend.services.impl.kiemke.KiemKeTheoMaService;
import com.dev.backend.services.impl.multitable.BaoCaoTonKhoService;
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
    private TonKhoTheoLoMapper tonKhoTheoLoMapper;
    @Autowired
    private BaoCaoTonKhoService baoCaoTonKhoService;
    @Autowired
    private KiemKeTheoMaService kiemKeTheoMaService;

    /**
     * Phần đang kiểm kê theo (kho, mã hàng) để màn tồn hiện nhãn "Đang kiểm kê N" (số tồn giữ nguyên). Theo kho (Báo cáo
     * tồn kho: cùng phạm vi kho như /ton-kho-tong-quan) hoặc theo một mã (ngăn tồn của sản phẩm, mọi kho).
     */
    @GetMapping("/dang-kiem-ke")
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
    public ResponseEntity<ResponseData<List<KiemKeTheoMaService.DongDangKiem>>> dangKiemKe(
            @RequestParam(required = false) Integer khoId, @RequestParam(required = false) Integer bienTheId) {
        if (bienTheId == null) baoCaoTonKhoService.kiemTraKhoXem(khoId);
        return ResponseEntity.ok(ResponseData.<List<KiemKeTheoMaService.DongDangKiem>>builder()
                .status(200).data(kiemKeTheoMaService.dangKiem(khoId, bienTheId)).message("Success").build());
    }

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
        baoCaoTonKhoService.kiemTraKhoXem(khoId);
        return thongKeHeThongService.tonKhoTongHop(khoId, keyword);
    }

    /**
     * Tệp Excel (.xlsx) của Báo cáo tồn kho: cùng kho, từ khóa với /ton-kho-tong-quan, kèm tab tình trạng đang xem
     * (tinhTrang = het-hang | thieu-hang | binh-thuong | du-hang, trống = tất cả). Cần quyền Xuất báo cáo ở kho làm việc.
     */
    @GetMapping("/ton-kho-tong-quan/xuat-excel")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang
            },
            permissions = {IPermissionType.xuat_bao_cao},
            inWarehouse = true
    )
    public ResponseEntity<byte[]> xuatExcelTonKho(@RequestParam(required = false) Integer khoId,
                                                  @RequestParam(required = false) String keyword,
                                                  @RequestParam(required = false) String tinhTrang) {
        return baoCaoTonKhoService.xuatExcel(khoId, keyword, tinhTrang).phanHoi();
    }

}
