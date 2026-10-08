package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.ApplicationRequestObj;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.CassoResponse;
import com.dev.backend.dto.response.GiaoDichDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.TransactionCasso;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.DonMuaHangMapper;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.CassoService;
import com.dev.backend.services.EmailService;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

@Service
public class DonMuaHangService extends BaseServiceImpl<DonMuaHang, Integer> {
    @Autowired
    private EntityManager entityManager;
    @Autowired
    private NhaCungCapService nhaCungCapService;
    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private KhoService khoService;
    @Autowired
    private ChiTietDonMuaHangService chiTietDonMuaHangService;
    @Autowired
    private BienTheSanPhamService bienTheSanPhamService;

    @Autowired
    private DonMuaHangMapper donMuaHangMapper;
    @Autowired
    private EmailService emailService;
    @Autowired
    private CalcService calcService;
    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;

    @Autowired
    private CassoService cassoService;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public DonMuaHangService(DonMuaHangRepository repository) {
        super(repository);
    }

    private final DonMuaHangRepository donMuaHangRepository = (DonMuaHangRepository) getRepository();

    @Transactional
    public ResponseEntity<ResponseData<DonMuaHangDto>> create(DonMuaHangCreating creating) {


        Kho khoNhap = khoService.getOne(SecurityContextHolder.getKhoId()).orElseThrow(
                () -> new CommonException("Không tìm thấy kho id: " + SecurityContextHolder.getKhoId())
        );


        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();

        NguoiDung nguoiTao = nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy người dùng id :" + authInfo.getId())
        );

        DonMuaHang donMuaHang = DonMuaHang.builder()
                .khoNhap(khoNhap)
                .ngayDatHang(creating.getNgayDatHang())
                .ngayGiaoDuKien(creating.getNgayGiaoDuKien())
                .trangThai(1)
                .tongTien(BigDecimal.ZERO)
                .ghiChu(creating.getGhiChu())
                .nguoiTao(nguoiTao)
                .nguoiDuyet(nguoiTao.getVaiTro().equals(IRoleType.quan_tri_vien) ? nguoiTao : null)
                .build();

        donMuaHang = create(donMuaHang);

        BigDecimal tongTien = BigDecimal.ZERO;
        BigDecimal tongSoLuong = BigDecimal.ZERO;

        List<ChiTietDonMuaHang> chiTietDonMuaHangs = new ArrayList<>();

        for (ChiTietDonMuaHangCreating ctdmhCreating : creating.getChiTietDonMuaHangs()) {
            BienTheSanPham bienTheSanPham = bienTheSanPhamService.getOne(ctdmhCreating.getBienTheSanPhamId()).orElseThrow(
                    () -> new CommonException("Không tìm thấy biến thể sản phẩm id: " + ctdmhCreating.getBienTheSanPhamId())
            );
            ChiTietDonMuaHang chiTietDonMuaHang = ChiTietDonMuaHang.builder()
                    .donMuaHang(donMuaHang)
                    .bienTheSanPham(bienTheSanPham)
                    .soLuongDat(ctdmhCreating.getSoLuongDat())
                    .soLuongDaNhan(ctdmhCreating.getSoLuongDaNhan())
                    .donGia(ctdmhCreating.getDonGia())
                    .ghiChu(ctdmhCreating.getGhiChu())
                    .build();
            chiTietDonMuaHangs.add(chiTietDonMuaHang);
            chiTietDonMuaHang = chiTietDonMuaHangService.create(chiTietDonMuaHang);
            tongSoLuong = tongSoLuong.add(chiTietDonMuaHang.getSoLuongDat());
            tongTien = tongTien.add(chiTietDonMuaHang.getThanhTien());
        }
        donMuaHang.setTongTien(tongTien);
        donMuaHang.setChiTietDonMuaHangs(chiTietDonMuaHangs);
        update(donMuaHang.getId(), donMuaHang);
        donMuaHang = getOne(donMuaHang.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn mua hàng : " + creating.getNgayDatHang())
        );

        for (ChiTietDonMuaHang chiTietDonMuaHang : donMuaHang.getChiTietDonMuaHangs()) {
            for (ApplicationRequestObj appReq : GlobalCache.APPLICATION_REQUEST_OBJS) {
                appReq.getBienTheSanPhamIds().removeIf(
                        (tempId) -> tempId.equals(chiTietDonMuaHang.getBienTheSanPham().getId())
                );
            }
        }

        return ResponseEntity.ok(
                ResponseData.<DonMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangMapper.toDto(donMuaHang))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> getOtpForSupplier(OtpDonMuaHangGetting getting) {
        //kiểm tra đơn mua hàng có tồn tại hay k
        DonMuaHang donMuaHang = getOne(getting.getDonMuaHangId()).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn mua hàng id: " + getting.getDonMuaHangId())
        );
        //kiểm tra mail NCC có giống email trong hệ thống hay k
        if (!getting.getEmail().equals(donMuaHang.getNhaCungCap().getEmail())) {
            throw new CommonException("Email nhà cung cấp không hợp lệ email: " + getting.getEmail());
        }
        // kiểm tra trạng thái đơn hàng(đã duyệt và gửi mail)
        if (donMuaHang.getTrangThai() != 2) {
            throw new CommonException("Đơn mua hàng không tồn tại id: " + getting.getDonMuaHangId());
        }

        for (OtpScheduleObj otpScheduleObj : GlobalCache.OTP_SCHEDULE_OBJS) {
            if (otpScheduleObj.getEmail().equals(getting.getEmail())) {
                throw new CommonException("Otp chưa hết hạn chờ 5p để gửi lại otp");
            }
        }

        OtpScheduleObj otpScheduleObj = OtpScheduleObj.builder()
                .email(getting.getEmail())
                .otp(calcService.getRandomActiveCode(6L))
                .type(OtpType.SUPPLIER_MAIL_SIGN_KEY)
                .build();
        GlobalCache.OTP_SCHEDULE_OBJS.add(otpScheduleObj);

        //khai báo params truyền qua mail
        HashMap<String, Object> params = new HashMap<>();

        params.put("userName", donMuaHang.getNhaCungCap().getTenNhaCungCap());
        params.put("otp", otpScheduleObj.getOtp());

        emailService.sendHtmlEmailFromTemplate(getting.getEmail(), "Truy cập phiếu chi tiết", "supplier_otp.html", params);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }


    @Transactional
    public ResponseEntity<ResponseData<DonMuaHangDto>> confirmOtpForSupplier(OtpDonMuaHangConfirming confirming) {
        //tìm otp bên trong danh sách otp lưu ở bộ nhớ đệm
        for (OtpScheduleObj otpScheduleObj : GlobalCache.OTP_SCHEDULE_OBJS) {
            if (otpScheduleObj.getEmail().equals(confirming.getEmail()) && otpScheduleObj.getOtp().equals(confirming.getOtp())) {
                //tìm đơn hàng có tồn tại trong DB ko
                DonMuaHang donMuaHang = getOne(confirming.getDonMuaHangId()).orElseThrow(
                        () -> new CommonException("Không tìm thấy đơn mua hàng id: " + confirming.getDonMuaHangId())
                );
                if (!donMuaHang.getNhaCungCap().getEmail().equals(confirming.getEmail())) {
                    throw new CommonException("Đơn mua hàng không hợp lệ");
                }
                return ResponseEntity.ok(
                        ResponseData.<DonMuaHangDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(donMuaHangMapper.toDto(donMuaHang))
                                .message("Success")
                                .error(null)
                                .build()
                );
            }
        }
        throw new CommonException("Otp hoặc email nhà cung cấp không hợp lệ");
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> baoGiaDonMuaHang(DonMuaHangBaoGia baoGia) {
        //tìm xem đơn hàng có tồn tại hay ko
        DonMuaHang donMuaHang = getOne(baoGia.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn mua hàng id: " + baoGia.getId())
        );
        if (donMuaHang.getChiTietDonMuaHangs().size() != baoGia.getChiTietDonMuaHangBaoGias().size()) {
            throw new CommonException("Đơn báo giá không hợp lệ");
        }

        //độ dài chi tiết đơn mua hàng để duyệt qua danh sách của nó
        int l = donMuaHang.getChiTietDonMuaHangs().size();
        List<ChiTietDonMuaHang> chiTietDonMuaHangs = donMuaHang.getChiTietDonMuaHangs();
        List<ChiTietDonMuaHangBaoGia> chiTietDonMuaHangBaoGias = baoGia.getChiTietDonMuaHangBaoGias();

        // Tính toán tổng tiền để so sánh
        BigDecimal tongTienTinhToan = BigDecimal.ZERO;
        for (int i = 0; i < l; i++) {
            //xét giá cho từng mặt hàng
            chiTietDonMuaHangs.get(i).setDonGia(chiTietDonMuaHangBaoGias.get(i).getDonGia());
            // so sánh thành tiền
            //tính toán tổng tiền
            BigDecimal thanhTienTinToan = chiTietDonMuaHangs.get(i).getSoLuongDat().multiply(baoGia.getChiTietDonMuaHangBaoGias().get(i).getDonGia());
            chiTietDonMuaHangs.get(i).setThanhTien(thanhTienTinToan);
            chiTietDonMuaHangService.update(chiTietDonMuaHangs.get(i).getId(), chiTietDonMuaHangs.get(i));
            tongTienTinhToan = tongTienTinhToan.add(thanhTienTinToan);
        }
        donMuaHang.setTongTien(tongTienTinhToan);
        donMuaHang.setTrangThai(2);
        update(donMuaHang.getId(), donMuaHang);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );

    }

    //lấy giao dịch thanh toán(QR code)
    @Transactional
    public ResponseEntity<ResponseData<GiaoDichDto>> layGiaoDich(Integer id) {


        DonMuaHang donMuaHang = getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn hàng id: " + id)
        );

        if (donMuaHang.getTrangThai() <= 2) {
            throw new CommonException("Nhà cung cấp chưa xác nhận gửi hàng");
        }

        if (donMuaHang.getTrangThai() == 4) {
            System.out.println("Đi qua đây");
            throw new CommonException("Báo giá đã bị từ chôi");
        }


        if (donMuaHang.getTrangThai() == 5) {
            throw new CommonException("Đơn hàng đã được thành toán");
        }

        return ResponseEntity.ok(
                ResponseData.<GiaoDichDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                GiaoDichDto.builder()
                                        .soDonMua(donMuaHang.getSoDonMua())
                                        .maGiaoDich("tran" + donMuaHang.getSoDonMua())
                                        .nganHang(donMuaHang.getNhaCungCap().getNganHang())
                                        .soNganHang(donMuaHang.getNhaCungCap().getSoNganHang())
                                        .tenNhaCungCap(donMuaHang.getNhaCungCap().getTenNhaCungCap())
                                        .tenKho(donMuaHang.getKhoNhap().getTenKho())
                                        .tongTien(donMuaHang.getTongTien()).build()
                        )
                        .message("Success")
                        .error(null)
                        .build()
        );

    }

    @Transactional
    public ResponseEntity<ResponseData<String>> kiemTraThanhToan(Integer id) {
        // logic kiểm tranh thanh toán
        boolean isSuccess = false;
        {
            DonMuaHang donMuaHang = getOne(id).orElseThrow(
                    () -> new CommonException("Không tìm thấy đơn mua hàng id: " + id)
            );
            String tranCode = "tran" + donMuaHang.getSoDonMua();
            BigDecimal tongTien = donMuaHang.getTongTien();
            // lấy ngày tháng hiện tại dạng string 2026-03-09
            LocalDate now = LocalDate.now();
            String ngayThang = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            System.out.println(ngayThang);
            CassoResponse cassoResponse = cassoService.getListTransactionCasso(ngayThang, 1, 20, null);

            for (TransactionCasso tran : cassoResponse.getData().getRecords()) {
                if (tran.getDescription().contains(tranCode) && Math.abs(Math.abs(tran.getAmount()) - Double.parseDouble(donMuaHang.getTongTien().toString())) < 0.1) {
                    isSuccess = true;
                    changeStatus(donMuaHang.getId(), 5);
                    break;
                }
            }
        }
        if (!isSuccess) {
            throw new CommonException("Chưa thanh toán");
        }
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Succsess")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> guiYeuCauBaoGiaDenNhaCungCap(YeuCauDenNhaCungCapCreating yeuCau) {
        // lấy thông tin người dùng đang đăng nhập
        NguoiDungAuthInfo nguoiDungAuthInfo = SecurityContextHolder.getUser();
        NguoiDung nguoiDung = nguoiDungService.getOne(nguoiDungAuthInfo.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy người tạo: id"+ nguoiDungAuthInfo.getId())
        );
        //lấy yêu cầu
        YeuCauMuaHang yeuCauMuaHang = yeuCauMuaHangService.getOne(yeuCau.getYeuCauMuaHangId()).orElseThrow(
                () -> new CommonException("Không tìm thấy yêu cầu id: " + yeuCau.getYeuCauMuaHangId())
        );
        //kiểm tra xem yêu cầu đã dc duyệt hay chưa
        if(yeuCauMuaHang.getTrangThai() != 2){
            throw new CommonException("Đơn mua hàng chưa được duyệt");
        }
        if (yeuCau.getNhaCungCapIds() == null || yeuCau.getNhaCungCapIds().isEmpty()) {
            throw new CommonException("Vui lòng chọn ít nhất một nhà cung cấp");
        }

        Instant now = Instant.now();
        //duyệt qua danh sách ID nhà cung cấp
        for (Integer nhaCungCapId : yeuCau.getNhaCungCapIds()) {
            NhaCungCap nhaCungCap = nhaCungCapService.getOne(nhaCungCapId).orElseThrow(
                    () -> new CommonException("Không tìm thấy nhà cung cấp id: " + nhaCungCapId)
            );
            //tạo đơn báo giá cho từng nhà cung cấp
            DonMuaHang donMuaHang = DonMuaHang.builder()
                    .yeuCauMuaHang(yeuCauMuaHang)
                    .soDonMua(calcService.getRandomProductCode("PO"))
                    .nhaCungCap(nhaCungCap)
                    .khoNhap(yeuCauMuaHang.getKhoNhap())
                    .trangThai(2)
                    .nguoiTao(nguoiDung)
                    .ngayDatHang(now)
                    .ngayGiaoDuKien(yeuCauMuaHang.getNgayGiaoDuKien())
                    .build();

            //lưu đơn mua hàng
            donMuaHang = create(donMuaHang);

            /*
            lấy danh sách sản phẩm từ Yêu cầu gốc sang Đơn mua hàng mới
            lấy thoong tin yêu cầu gốc mà NVK gửi cho QLK duyệt
            số lượng, sản phẩm, kho, ngày giao dự kiến
             */
            List<ChiTietDonMuaHang> chiTietDonMuaHangs = new ArrayList<>();
            for (ChiTietYeuCauMuaHang chiTietYeuCauMuaHang : yeuCauMuaHang.getChiTietYeuCauMuaHangs()) {
                //chuyển đổi từ thông tin của Yêu cầu sang thông tin của Đơn hàng
                ChiTietDonMuaHang chiTietDonMuaHang = fromChiTietYeuCauToChiTietBaoGia(donMuaHang, chiTietYeuCauMuaHang);
                chiTietDonMuaHang = chiTietDonMuaHangService.create(chiTietDonMuaHang);
                chiTietDonMuaHangs.add(chiTietDonMuaHang);
            }

            //truyền chi tiết danh sách đơn mua hàng vào đơn mua hàng
            donMuaHang.setChiTietDonMuaHangs(chiTietDonMuaHangs);
            //gửi Email thông báo cho nhà cung cấp để họ vào báo giá
            guiMailYeuCauBaoGiaChoNhaCungCap(donMuaHang);
        }
        // Giữ NGUYÊN mã yêu cầu (PR...) — không ghi đè bằng mã RFQ ngẫu nhiên
        // nữa; yêu cầu cũ chưa có mã thì bổ sung mã PR. Cập nhật trạng thái
        // một lần sau khi đã gửi cho mọi nhà cung cấp.
        yeuCauMuaHangService.damBaoCoMa(yeuCauMuaHang);
        //trạng thái đã gửi báo giá
        yeuCauMuaHang.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
        yeuCauMuaHangService.update(yeuCauMuaHang.getId(), yeuCauMuaHang);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    //hàm hỗ trợ chi tiết yêu cầu đến chi tiết báo giá
    private ChiTietDonMuaHang fromChiTietYeuCauToChiTietBaoGia(DonMuaHang donMuaHang,ChiTietYeuCauMuaHang chiTietYeuCauMuaHang){
        return ChiTietDonMuaHang.builder()
                .bienTheSanPham(chiTietYeuCauMuaHang.getBienTheSanPham())
                .donMuaHang(donMuaHang)
                .donGia(BigDecimal.ZERO)
                .soLuongDat(chiTietYeuCauMuaHang.getSoLuongDat())
                .soLuongDaNhan(BigDecimal.ZERO )
                .thanhTien(BigDecimal.ZERO)
                .build();
    }

    private void guiMailYeuCauBaoGiaChoNhaCungCap(DonMuaHang donMuaHang){
        //l
        NhaCungCap nhaCungCap = donMuaHang.getNhaCungCap();
        Date now = new Date();
        HashMap<String, Object> params = new HashMap<>();
        params.put("ngay", now.getDate());
        params.put("thang", now.getMonth() + 1);
        params.put("nam", now.getYear() + 1900);
        params.put("soDonMua", donMuaHang.getSoDonMua());

        String trangThaiText = " Quản lý đã duyệt và gửi mail";
        BigDecimal tongSoLuong = BigDecimal.ZERO;
        // tính tổng số lượng
        for (ChiTietDonMuaHang chiTietDonMuaHang : donMuaHang.getChiTietDonMuaHangs()) {
            tongSoLuong = tongSoLuong.add(chiTietDonMuaHang.getSoLuongDat());
        }
        params.put("trangThaiText", trangThaiText);
        params.put("tenKho", donMuaHang.getKhoNhap().getTenKho());
        params.put("diaChiKho", donMuaHang.getKhoNhap().getDiaChi());
        params.put("tenNhaCungCap", nhaCungCap.getTenNhaCungCap());
        params.put("maNhaCungCap", nhaCungCap.getMaNhaCungCap());
        params.put("nguoiLienHe", nhaCungCap.getNguoiLienHe());
        params.put("soDienThoai", nhaCungCap.getSoDienThoai());
        params.put("email", nhaCungCap.getEmail());
        params.put("tongSoMatHang", donMuaHang.getChiTietDonMuaHangs().size());
        params.put("tongSoLuong", tongSoLuong);
        params.put("tongTien", donMuaHang.getTongTien());
        params.put("ghiChu", donMuaHang.getGhiChu());
        params.put("ngayDatHang", donMuaHang.getNgayDatHang());
        params.put("ngayGiaoDuKien", donMuaHang.getNgayGiaoDuKien());
        params.put("hanPheDuyet", donMuaHang.getNgayGiaoDuKien());
        params.put("loginHref", ConstantVariables.SUPPLIER_MAIL_LOGIN_HREF);

        emailService.sendHtmlEmailFromTemplate(
                nhaCungCap.getEmail(),
                "Phiếu xác nhận nhập hàng",
                "don_mua.html",
                params
        );
    }
}
