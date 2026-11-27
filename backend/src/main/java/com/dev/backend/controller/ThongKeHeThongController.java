package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.TonKhoKhongGiaVon;
import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.LoTrongKhoDto;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.mapper.TonKhoTheoLoMapper;
import com.dev.backend.services.impl.kiemke.KiemKeTheoMaService;
import com.dev.backend.services.impl.multitable.BaoCaoTonKhoService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import com.dev.backend.utils.XemGiaVon;
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
        return anGiaVon(thongKeHeThongService.findTonKhoChiTietByKho(SecurityContextHolder.getKhoId()));
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
        return anGiaVon(thongKeHeThongService.findTonKhoChiTietByBienThe(bienTheId));
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
        return anGiaVon(thongKeHeThongService.findTonKhoChiTietByBienTheAndKho(bienTheId, khoId));
    }

    /**
     * Người không được xem giá vốn (nhân viên bán hàng, SRS 2.4.1): bỏ giá vốn, giá trị tồn của dòng và giá vốn từng lô
     * trước khi gửi (máy chủ không gửi, không chỉ ẩn trên giao diện).
     */
    private static ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> anGiaVon(
            ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> phanHoi) {
        ResponseData<List<TonKhoChiTietDTO>> body = phanHoi.getBody();
        if (XemGiaVon.nguoiDangNhapDuocXem() || body == null || body.getData() == null) return phanHoi;
        for (TonKhoChiTietDTO d : body.getData()) {
            d.setGiaVon(null);
            d.setGiaTriTonKho(null);
            if (d.getDanhSachLoHang() != null) d.getDanhSachLoHang().forEach(lo -> lo.setGiaVonLo(null));
        }
        return phanHoi;
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
        List<TonKhoProjection> ds = thongKeHeThongService.getTonKhoTongHop(khoId, keyword);
        // Giá trị tồn tính theo giá vốn lô: người không được xem giá vốn (nhân viên bán hàng, SRS 2.4.1) không nhận số này
        if (!XemGiaVon.nguoiDangNhapDuocXem()) {
            ds = ds.stream().<TonKhoProjection>map(TonKhoKhongGiaVon::new).toList();
        }
        return ResponseEntity.ok(ResponseData.<List<TonKhoProjection>>builder()
                .status(200).data(ds).message("Success").build());
    }

    /**
     * Các lô đang tồn của một mã ở một kho (bấm mở một dòng của Báo cáo tồn kho): mã lô, kệ đang chứa, ngày nhập,
     * nhà cung cấp, tồn, giá vốn (null với người không được xem giá vốn), phần đang giữ và đang kiểm kê. Chặn kho như
     * /ton-kho-tong-quan.
     */
    @GetMapping("/ton-kho-tong-quan/lo")
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
    public ResponseEntity<ResponseData<List<LoTrongKhoDto>>> loCuaMa(@RequestParam Integer khoId, @RequestParam Integer bienTheId) {
        return ResponseEntity.ok(ResponseData.<List<LoTrongKhoDto>>builder()
                .status(200).data(baoCaoTonKhoService.loCuaMa(khoId, bienTheId)).message("Success").build());
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
