package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.KenhCauHinhDongBoRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.LazadaConfigUpdating;
import com.dev.backend.dto.request.LazadaOAuthCallbackRequest;
import com.dev.backend.dto.request.LazadaTestConnectionRequest;
import com.dev.backend.dto.response.customize.LazadaTestConnectionResponse;
import com.dev.backend.dto.response.entities.LazadaConfigResponse;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.DongBoNgayService;
import com.dev.backend.services.impl.entities.KenhCauHinhDongBoService;
import com.dev.backend.services.impl.entities.KenhThongKeDonService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;

import java.util.List;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/kenh-ban-hang")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangController {

    KenhBanHangService kenhBanHangService;
    KenhBanHangDongBoService kenhBanHangDongBoService;
    KenhCauHinhDongBoService kenhCauHinhDongBoService;
    KenhThongKeDonService kenhThongKeDonService;
    DongBoNgayService dongBoNgayService;

    @GetMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Shopify (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> getShopifyConfig() {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message("Lấy cấu hình kênh bán Shopify thành công")
                        .build()
        );
    }

    @PutMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cập nhật cấu hình kênh bán Shopify (Mã hóa AES-256-GCM token trước khi lưu DB)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> updateShopifyConfig(
            @Valid @RequestBody ShopifyConfigUpdating request) {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.updateShopifyConfig(request))
                        .message("Cập nhật cấu hình Shopify thành công")
                        .build()
        );
    }

    @PostMapping("/shopify/test-connection")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới Shopify Admin API với token")
    public ResponseEntity<ResponseData<ShopifyTestConnectionResponse>> testShopifyConnection(
            @RequestBody ShopifyTestConnectionRequest request) {
        ShopifyTestConnectionResponse res = kenhBanHangService.testShopifyConnection(request);
        return ResponseEntity.ok(
                ResponseData.<ShopifyTestConnectionResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(res.isConnected() ? "Kết nối Shopify thành công" : "Kiểm tra kết nối thất bại")
                        .build()
        );
    }

    @PostMapping("/shopify/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Shopify bằng Refresh Token")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> refreshShopifyOAuthToken() {
        boolean success = kenhBanHangService.refreshShopifyAccessToken();
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message(success ? "Làm mới Access Token OAuth 2.0 thành công" : "Không thể làm mới token")
                        .build()
        );
    }

    // ── Lazada Open Platform Endpoints ──

    @GetMapping("/lazada")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Lazada (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> getLazadaConfig() {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaConfig())
                        .message("Lấy cấu hình kênh bán Lazada thành công")
                        .build()
        );
    }

    @PutMapping("/lazada")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cập nhật cấu hình kênh bán Lazada (Mã hóa AES-256-GCM credential trước khi lưu DB)")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> updateLazadaConfig(
            @Valid @RequestBody LazadaConfigUpdating request) {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.updateLazadaConfig(request))
                        .message("Cập nhật cấu hình Lazada thành công")
                        .build()
        );
    }

    @PostMapping("/lazada/test-connection")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới Lazada Open Platform API")
    public ResponseEntity<ResponseData<LazadaTestConnectionResponse>> testLazadaConnection(
            @RequestBody LazadaTestConnectionRequest request) {
        LazadaTestConnectionResponse res = kenhBanHangService.testLazadaConnection(request);
        return ResponseEntity.ok(
                ResponseData.<LazadaTestConnectionResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(res.isConnected() ? "Kết nối Lazada thành công" : "Kiểm tra kết nối thất bại")
                        .build()
        );
    }

    @GetMapping("/lazada/auth-url")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Sinh URL ủy quyền Seller Authorization để đăng nhập Lazada Seller Center")
    public ResponseEntity<ResponseData<String>> getLazadaAuthUrl(@RequestParam(required = false) String redirectUri) {
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaAuthUrl(redirectUri))
                        .message("Sinh URL ủy quyền Lazada thành công")
                        .build()
        );
    }

    @PostMapping("/lazada/exchange-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Đổi mã authorization code lấy Access Token và Refresh Token từ Lazada")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> exchangeLazadaToken(
            @Valid @RequestBody LazadaOAuthCallbackRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.exchangeLazadaToken(request))
                        .message("Ủy quyền gian hàng Lazada thành công")
                        .build()
        );
    }

    @PostMapping("/lazada/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Lazada bằng Refresh Token")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> refreshLazadaOAuthToken() {
        boolean success = kenhBanHangService.refreshLazadaAccessToken();
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaConfig())
                        .message(success ? "Làm mới Access Token Lazada thành công" : "Không thể làm mới token")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/tai-san-pham")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tải toàn bộ danh mục sản phẩm từ kênh bán hàng về FCentric")
    public ResponseEntity<ResponseData<TaiSanPhamResultDto>> taiSanPhamTuKenh(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<TaiSanPhamResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.taiSanPhamTuKenh(maKenh))
                        .message("Tải sản phẩm từ kênh thành công")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/tu-dong-lien-ket")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tự động ghép nối SKU trùng nhau giữa FCentric và kênh bán")
    public ResponseEntity<ResponseData<TuDongLienKetResultDto>> tuDongLienKet(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<TuDongLienKetResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.tuDongLienKet(maKenh))
                        .message("Tự động liên kết SKU thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/lien-ket")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách liên kết sản phẩm của kênh bán hàng phân trang")
    public ResponseEntity<ResponseData<Page<LienKetSanPhamDto>>> filterLienKet(
            @PathVariable String maKenh,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String trangThai,
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<LienKetSanPhamDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterLienKet(maKenh, search, trangThai, pageable))
                        .message("Lấy danh sách liên kết thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/lien-ket/theo-san-pham")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Danh sách liên kết của kênh phân trang theo sản phẩm (mỗi phần tử là một sản phẩm kèm đủ SKU)")
    public ResponseEntity<ResponseData<Page<NhomLienKetDto>>> filterLienKetTheoSanPham(
            @PathVariable String maKenh,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String trangThai,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<NhomLienKetDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterLienKetTheoSanPham(maKenh, search, trangThai, pageable))
                        .message("Lấy danh sách liên kết thành công")
                        .build()
        );
    }

    @PutMapping("/lien-ket/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Cập nhật ghép nối thủ công hoặc hủy ghép nối cho 1 liên kết")
    public ResponseEntity<ResponseData<LienKetSanPhamDto>> capNhatLienKet(
            @PathVariable Integer id,
            @RequestBody CapNhatLienKetRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LienKetSanPhamDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.capNhatLienKet(id, request))
                        .message("Cập nhật liên kết thành công")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/day-ton")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Đẩy tồn kho khả dụng lên kênh bán hàng theo chính sách tồn kho")
    public ResponseEntity<ResponseData<DayTonResultDto>> dayTonKho(
            @PathVariable String maKenh,
            @RequestBody(required = false) DayTonKenhRequest request) {
        if (request == null) {
            request = new DayTonKenhRequest();
        }
        return ResponseEntity.ok(
                ResponseData.<DayTonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.dayTonKhoLenKenh(maKenh, request))
                        .message("Đẩy tồn kho lên kênh bán thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chỉ số KPI tổng quan đồng bộ của kênh")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> getTongQuan(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getTongQuan(maKenh))
                        .message("Lấy thông tin tổng quan đồng bộ thành công")
                        .build()
        );
    }

    @GetMapping("/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chỉ số KPI tổng quan đồng bộ toàn hệ thống")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> getTongQuanHeThong() {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getTongQuan("SHOPIFY"))
                        .message("Lấy thông tin tổng quan hệ thống thành công")
                        .build()
        );
    }

    @GetMapping("/bien-the/tim-kiem")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tìm kiếm biến thể FCentric phục vụ ghép nối SKU")
    public ResponseEntity<ResponseData<java.util.List<BienTheOptionDto>>> timBienThe(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(
                ResponseData.<java.util.List<BienTheOptionDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.timBienThe(q, limit))
                        .message("Tìm kiếm biến thể thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/locations")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách vị trí kho từ kênh bán hàng")
    public ResponseEntity<ResponseData<List<ShopifyLocationDto>>> getLocations(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<List<ShopifyLocationDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getLocations(maKenh))
                        .message("Lấy danh sách vị trí kho thành công")
                        .build()
        );
    }

    @PutMapping("/{maKenh}/cai-dat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lưu cấu hình kết nối đồng bộ kho và quy tắc tồn")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> luuCaiDat(
            @PathVariable String maKenh,
            @Valid @RequestBody KenhBanHangCaiDatRequest request) {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.luuCaiDat(maKenh, request))
                        .message("Lưu cấu hình kênh bán hàng thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/cau-hinh-dong-bo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy cấu hình đồng bộ của kênh (tự đẩy tồn, tự lấy đơn, quy tắc tồn)")
    public ResponseEntity<ResponseData<KenhCauHinhDongBoDto>> layCauHinhDongBo(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<KenhCauHinhDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhCauHinhDongBoService.layCauHinh(maKenh))
                        .message("Lấy cấu hình đồng bộ thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/thong-ke-don")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Số liệu đơn hàng của kênh theo ngày (tối đa 92 ngày) và số đơn theo trạng thái")
    public ResponseEntity<ResponseData<KenhThongKeDonDto>> thongKeDon(
            @PathVariable String maKenh,
            @RequestParam(required = false) String tu,
            @RequestParam(required = false) String den) {
        return ResponseEntity.ok(
                ResponseData.<KenhThongKeDonDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhThongKeDonService.thongKe(maKenh, tu, den))
                        .message("Lấy số liệu đơn hàng của kênh thành công")
                        .build()
        );
    }

    @PutMapping("/{maKenh}/cau-hinh-dong-bo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lưu cấu hình đồng bộ của kênh; trường để trống giữ nguyên giá trị cũ")
    public ResponseEntity<ResponseData<KenhCauHinhDongBoDto>> luuCauHinhDongBo(
            @PathVariable String maKenh,
            @Valid @RequestBody KenhCauHinhDongBoRequest request) {
        return ResponseEntity.ok(
                ResponseData.<KenhCauHinhDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhCauHinhDongBoService.luuCauHinh(maKenh, request))
                        .message("Lưu cấu hình đồng bộ thành công")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/nhat-ky")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách sự kiện nhật ký đồng bộ phân trang")
    public ResponseEntity<ResponseData<Page<NhatKyDongBoDto>>> filterNhatKy(
            @PathVariable String maKenh,
            @RequestParam(required = false) String loai,
            @RequestParam(required = false) String trangThai,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<NhatKyDongBoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterNhatKy(maKenh, loai, trangThai, search, pageable))
                        .message("Lấy nhật ký đồng bộ thành công")
                        .build()
        );
    }

    @GetMapping("/nhat-ky/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chi tiết sự kiện nhật ký đồng bộ")
    public ResponseEntity<ResponseData<NhatKyDongBoDto>> getNhatKyDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<NhatKyDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getNhatKyDetail(id))
                        .message("Lấy chi tiết sự kiện nhật ký thành công")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/lay-don")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Chủ động lấy đơn hàng mới từ sàn theo khoảng thời gian")
    public ResponseEntity<ResponseData<LayDonResultDto>> layDonHang(
            @PathVariable String maKenh,
            @RequestBody(required = false) LayDonHangKenhRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LayDonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.layDonHang(maKenh, request))
                        .message("Lấy đơn hàng từ sàn thành công")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/dong-bo-ngay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Bắt đầu đồng bộ tay chạy nền (đẩy tồn theo quy tắc đã lưu rồi lấy đơn 24 giờ qua); đang chạy thì trả đợt đang chạy")
    public ResponseEntity<ResponseData<DongBoNgayDto>> batDauDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.batDau(maKenh))
                        .message("Đã bắt đầu đồng bộ")
                        .build()
        );
    }

    @GetMapping("/{maKenh}/dong-bo-ngay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tiến độ đợt đồng bộ tay gần nhất của kênh (null nếu chưa có đợt nào từ khi máy chủ khởi động)")
    public ResponseEntity<ResponseData<DongBoNgayDto>> layDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.hienTai(maKenh))
                        .message("Lấy tiến độ đồng bộ thành công")
                        .build()
        );
    }

    @PostMapping("/{maKenh}/dong-bo-ngay/dung")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Dừng đợt đồng bộ tay đang chạy sau SKU đang đẩy (bỏ bước lấy đơn)")
    public ResponseEntity<ResponseData<DongBoNgayDto>> dungDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.dung(maKenh))
                        .message("Đã yêu cầu dừng đồng bộ")
                        .build()
        );
    }

    @PostMapping("/dong-bo-tat-ca")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Chạy đợt đồng bộ tồn kho và đơn hàng cho toàn bộ các gian hàng active")
    public ResponseEntity<ResponseData<DayTonResultDto>> dongBoTatCa() {
        return ResponseEntity.ok(
                ResponseData.<DayTonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.dongBoTatCa())
                        .message("Chạy đợt đồng bộ toàn bộ gian hàng thành công")
                        .build()
        );
    }

    @PostMapping("/lien-ket/{id}/thu-lai")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Thử lại đẩy tồn cho một liên kết bị lỗi")
    public ResponseEntity<ResponseData<LienKetSanPhamDto>> thuLai(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<LienKetSanPhamDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.thuLai(id))
                        .message("Thử lại đồng bộ SKU thành công")
                        .build()
        );
    }
}
