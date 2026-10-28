package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.enums.LoaiBangChungDongGoi;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.response.customize.BangChungDongGoiDto;
import com.dev.backend.dto.response.customize.ThongTinBangChungDonDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BangChungDongGoiRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.DonBanHangService;
import com.dev.backend.services.impl.entities.TepTinService;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.utils.KiemTraTepTai;
import com.dev.backend.utils.PublicAssetUrl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class BangChungDongGoiServiceImpl implements BangChungDongGoiService {

    public static final BigDecimal NGUONG_TIEN_VIDEO = new BigDecimal("1000000.00");
    /** Thời lượng video đóng gói cho phép (giây, gồm cả hai đầu). Frontend nhận qua ThongTinBangChungDonDto / PhienDongGoiDto. */
    public static final int THOI_LUONG_VIDEO_TOI_THIEU = 15;
    public static final int THOI_LUONG_VIDEO_TOI_DA = 180;
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024; // 10MB
    /** 100MB — GioiHanTaiBangChungFilter dùng mốc này để chặn sớm yêu cầu quá lớn trước khi đọc multipart. */
    public static final long MAX_VIDEO_SIZE = 100L * 1024 * 1024;
    /** Số ngày lưu tệp bằng chứng (PackingProofCleanupJob dọn theo cùng mốc). */
    private static final int SO_NGAY_LUU = 30;

    @Autowired
    private BangChungDongGoiRepository bangChungDongGoiRepository;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private TepTinService tepTinService;

    @Autowired
    private MinioService minioService;

    @Override
    @Transactional(readOnly = true)
    public ThongTinBangChungDonDto layThongTinBangChung(Integer donBanHangId) {
        DonBanHang don = donBanHangRepository.findById(donBanHangId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đơn bán hàng id: " + donBanHangId, HttpStatus.NOT_FOUND, null));
        // Chỉ đọc: cùng phạm vi với chi tiết đơn bán (kho được phân công / đơn mình tạo), không theo kho đang chọn
        if (!DonBanHangService.trongPhamVi(don, SecurityContextHolder.getUser())) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " không thuộc phạm vi của bạn.", HttpStatus.FORBIDDEN, null);
        }

        List<BangChungDongGoi> list = bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(donBanHangId, 1);
        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean yeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;
        boolean daDu = kiemTraDaDuBangChungInternal(yeuCauVideo, list);

        List<BangChungDongGoiDto> dtoList = list.stream().map(this::toDto).collect(Collectors.toList());

        String huongDan = yeuCauVideo
                ? "Đơn hàng giá trị từ 1.000.000đ trở lên: Bắt buộc quay 1 video dài " + khoangVideoNgan() + ", từ lúc cho đồ vào đến khi niêm phong."
                : "Đơn hàng giá trị dưới 1.000.000đ: Bắt buộc tải lên 2 ảnh (Ảnh 1: Hàng đã cho vào hộp/túi; Ảnh 2: Hộp đã dán băng keo niêm phong kèm tem ĐVVC).";

        return ThongTinBangChungDonDto.builder()
                .donBanHangId(don.getId())
                .soDonHang(don.getSoDonHang())
                .tongTienDonHang(tongTien)
                .yeuCauVideo(yeuCauVideo)
                .loaiYeuCau(yeuCauVideo ? "VIDEO_15_30S" : "ANH_2_BUOC")
                .thoiLuongVideoToiThieu(THOI_LUONG_VIDEO_TOI_THIEU)
                .thoiLuongVideoToiDa(THOI_LUONG_VIDEO_TOI_DA)
                .huongDan(huongDan)
                .daDuBangChung(daDu)
                .soLuongHienCo(list.size())
                .soLuongYeuCau(yeuCauVideo ? 1 : 2)
                .danhSachBangChung(dtoList)
                .ngayTuXoa(list.isEmpty() ? ngayTuXoa(donBanHangId) : null)
                .build();
    }

    /**
     * Ngày hết hạn muộn nhất của các tệp đã gắn với phiếu xuất đóng gói xong (Chờ xuất / Đã xuất) mà nay không còn lưu và
     * đã quá hạn — tức việc dọn sau hạn lưu đã xóa. Tệp bị thay hoặc xóa tay lúc đang đóng gói có hạn sớm hơn tệp cuối
     * nên không làm sai ngày. Không có thì null (đơn chưa từng có bằng chứng).
     */
    private Instant ngayTuXoa(Integer donBanHangId) {
        Instant now = Instant.now();
        return bangChungDongGoiRepository.findByDonBanHangIdAndTrangThai(donBanHangId, 0).stream()
                .filter(b -> b.getPhieuXuatKho() != null && phieuDaDongGoiXong(b.getPhieuXuatKho()))
                // Bản ghi cũ thiếu hạn: việc dọn chọn theo ngày tạo + 30 ngày, tính cùng cách
                .map(b -> b.getNgayHetHan() != null ? b.getNgayHetHan()
                        : b.getNgayTao() != null ? b.getNgayTao().plus(SO_NGAY_LUU, ChronoUnit.DAYS) : null)
                .filter(h -> h != null && !h.isAfter(now))
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    private static boolean phieuDaDongGoiXong(PhieuXuatKho phieu) {
        return phieuDaDongGoiXong(phieu.getTrangThai());
    }

    private static boolean phieuDaDongGoiXong(Integer ttPhieu) {
        return Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(ttPhieu) || Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(ttPhieu);
    }

    private void kiemTraConSuaBangChung(DonBanHang don) {
        kiemTraConSuaBangChung(don.getSoDonHang(), don.getTrangThai(), () -> phieuXuatKhoRepository.findByDonBanHangId(don.getId())
                .stream().map(PhieuXuatKho::getTrangThai).toList());
    }

    /**
     * Bằng chứng chỉ được thêm, thay, xóa khi đơn còn ở bước nhặt / đóng gói: Chờ nhặt hàng, Chờ đóng gói, hoặc Đã xuất
     * một phần mà còn phiếu xuất nháp đang đóng gói. Qua bước đóng gói thì bằng chứng là bản gốc lúc đóng gói, chỉ xem.
     * `trangThaiPhieu`: trạng thái các phiếu xuất của đơn, chỉ đọc khi đơn Đã xuất một phần.
     */
    private static void kiemTraConSuaBangChung(String soDon, Integer tt, java.util.function.Supplier<List<Integer>> trangThaiPhieu) {
        boolean dangDongGoi = Integer.valueOf(ITrangThaiDonBanHang.CHO_NHAT_HANG).equals(tt)
                || Integer.valueOf(ITrangThaiDonBanHang.CHO_DONG_GOI).equals(tt)
                || (Integer.valueOf(ITrangThaiDonBanHang.DANG_XUAT_KHO).equals(tt)
                && trangThaiPhieu.get().contains(ITrangThaiPhieuXuat.NHAP));
        if (!dangDongGoi) {
            String lyDo = Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(tt) ? " đã bị hủy" : " không còn ở bước đóng gói";
            throw new CommonException("Đơn hàng " + soDon + lyDo
                    + ", bằng chứng chỉ được xem, không thêm, thay hay xóa được!", HttpStatus.CONFLICT, null);
        }
    }

    /** Tệp cũ cùng loại đã dùng để hoàn tất một phiếu xuất (Chờ xuất / Đã xuất, `ttPhieu`): không cho thay bằng tệp mới. */
    private static void kiemTraThayDuoc(BangChungDongGoi cu, Integer ttPhieu) {
        if (cu != null && phieuDaDongGoiXong(ttPhieu)) {
            String so = cu.getPhieuXuatKho() != null && cu.getPhieuXuatKho().getSoPhieuXuat() != null
                    ? " " + cu.getPhieuXuatKho().getSoPhieuXuat() : "";
            throw new CommonException("Bằng chứng này đã dùng để hoàn tất đóng gói phiếu xuất" + so + ", không thay được!",
                    HttpStatus.CONFLICT, null);
        }
    }

    @Override
    public BangChungDongGoiDto uploadBangChung(Integer donBanHangId, MultipartFile file, String loaiBangChung, Integer thoiLuongGiay) {
        if (file == null || file.isEmpty()) {
            throw new CommonException("Tệp tải lên không được để trống!", HttpStatus.BAD_REQUEST, null);
        }
        if (loaiBangChung == null || loaiBangChung.trim().isEmpty()) {
            throw new CommonException("Loại bằng chứng không được để trống!", HttpStatus.BAD_REQUEST, null);
        }

        loaiBangChung = loaiBangChung.trim().toUpperCase();
        try {
            LoaiBangChungDongGoi.valueOf(loaiBangChung);
        } catch (IllegalArgumentException e) {
            throw new CommonException("Loại bằng chứng [" + loaiBangChung + "] không hợp lệ!", HttpStatus.BAD_REQUEST, null);
        }

        DonBanHang don = donBanHangRepository.findById(donBanHangId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đơn bán hàng id: " + donBanHangId, HttpStatus.NOT_FOUND, null));
        kiemTraKho(don.getKhoXuat());

        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            throw new CommonException("Đơn hàng " + don.getSoDonHang() + " đã bị hủy, không thể tải bằng chứng!", HttpStatus.CONFLICT, null);
        }
        kiemTraConSuaBangChung(don);
        // Chặn trước khi tải lên MinIO (không để tệp mồ côi); lúc lưu kiểm lại vì tải video có thể mất cả phút
        BangChungDongGoi cuTruoc = bangChungDongGoiRepository
                .findByDonBanHangIdAndLoaiBangChungAndTrangThai(donBanHangId, loaiBangChung, 1).orElse(null);
        kiemTraThayDuoc(cuTruoc, cuTruoc != null && cuTruoc.getPhieuXuatKho() != null ? cuTruoc.getPhieuXuatKho().getTrangThai() : null);

        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean donYeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;

        // Phân định quy chuẩn ảnh vs video — theo byte đầu tệp, không theo Content-Type / tên tệp client gửi
        Optional<KiemTraTepTai.LoaiTep> loaiNoiDung = KiemTraTepTai.nhanDang(file);
        String loaiTep;

        if (donYeuCauVideo) {
            if (!LoaiBangChungDongGoi.VIDEO_DONG_GOI.name().equals(loaiBangChung)) {
                throw new CommonException("Đơn hàng từ 1.000.000đ trở lên bắt buộc phải quay video đóng gói (" + moTaKhoangVideo() + ")!", HttpStatus.BAD_REQUEST, null);
            }
            if (loaiNoiDung.filter(KiemTraTepTai.VIDEO::contains).isEmpty()) {
                throw new CommonException("Định dạng tệp không phải video hợp lệ (MP4, WebM, MOV)!", HttpStatus.BAD_REQUEST, null);
            }
            if (file.getSize() > MAX_VIDEO_SIZE) {
                throw new CommonException("Dung lượng video vượt quá 100MB cho phép!", HttpStatus.BAD_REQUEST, null);
            }
            if (!thoiLuongVideoHopLe(thoiLuongGiay)) {
                throw new CommonException("Thời lượng video đóng gói phải " + moTaKhoangVideo() + " (Nhận được: "
                        + (thoiLuongGiay != null ? thoiLuongGiay + " giây" : "chưa xác định") + ")!", HttpStatus.BAD_REQUEST, null);
            }
            loaiTep = FileType.VIDEO.toString();
        } else {
            if (LoaiBangChungDongGoi.VIDEO_DONG_GOI.name().equals(loaiBangChung)) {
                throw new CommonException("Đơn hàng dưới 1.000.000đ chỉ yêu cầu tải 2 ảnh đóng gói!", HttpStatus.BAD_REQUEST, null);
            }
            if (loaiNoiDung.filter(KiemTraTepTai.ANH_CHUP::contains).isEmpty()) {
                throw new CommonException("Định dạng tệp không phải hình ảnh hợp lệ (JPEG, PNG, WebP)!", HttpStatus.BAD_REQUEST, null);
            }
            if (file.getSize() > MAX_IMAGE_SIZE) {
                throw new CommonException("Dung lượng ảnh vượt quá 10MB cho phép!", HttpStatus.BAD_REQUEST, null);
            }
            loaiTep = FileType.IMAGE.toString();
        }

        // 1. Tách biệt I/O MinIO ngoài transaction DB (chống nghẽn connection pool theo hunt-springboot)
        // Đuôi lấy từ loại nội dung thật (đã kiểm ở trên), không từ tên tệp
        String ext = loaiNoiDung.get().duoi;
        String objectName = "packing-proofs/" + donBanHangId + "/" + UUID.randomUUID() + "." + ext;
        String minioUrl;
        try {
            minioService.upload(file, objectName);
            minioUrl = minioService.getPublicUrl(objectName);
        } catch (Exception e) {
            log.error("Lỗi khi tải tệp lên MinIO: {}", e.getMessage(), e);
            throw new CommonException("Không thể lưu trữ tệp lên hệ thống MinIO: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }

        // 2. Mở Transaction lưu DB. Bị chặn lúc lưu (đơn vừa đóng gói xong trong lúc tải) hoặc lỗi CSDL thì xóa tệp vừa tải
        try {
            return luuBangChungVaoDb(don, file, objectName, minioUrl, loaiBangChung, loaiTep, thoiLuongGiay, ext);
        } catch (RuntimeException e) {
            try {
                minioService.delete(objectName);
            } catch (Exception ex) {
                log.warn("Không xóa được tệp vừa tải lên MinIO {} sau khi lưu bị chặn: {}", objectName, ex.getMessage());
            }
            throw e;
        }
    }

    @Transactional(rollbackFor = Exception.class)
    protected BangChungDongGoiDto luuBangChungVaoDb(DonBanHang don, MultipartFile file, String objectName,
                                                    String minioUrl, String loaiBangChung, String loaiTep,
                                                    Integer thoiLuongGiay, String ext) {
        // Kiểm lại theo trạng thái mới nhất trong CSDL: trong lúc tải tệp, đơn có thể đã được đóng gói xong (không dùng
        // findById — open-in-view trả lại thực thể đã nạp đầu request)
        kiemTraConSuaBangChung(don.getSoDonHang(), bangChungDongGoiRepository.docTrangThaiDon(don.getId()),
                () -> bangChungDongGoiRepository.docTrangThaiPhieuCuaDon(don.getId()));

        // Nếu đã có bằng chứng cùng loại đang hoạt động: xóa cũ thay mới
        Optional<BangChungDongGoi> cuOpt = bangChungDongGoiRepository
                .findByDonBanHangIdAndLoaiBangChungAndTrangThai(don.getId(), loaiBangChung, 1);
        cuOpt.ifPresent(cu -> kiemTraThayDuoc(cu, bangChungDongGoiRepository.docTrangThaiPhieuCuaBangChung(cu.getId())));
        if (cuOpt.isPresent()) {
            BangChungDongGoi cu = cuOpt.get();
            try {
                if (cu.getTepTin() != null) {
                    minioService.delete(cu.getTepTin().getTenLuuTru());
                    tepTinService.hardDeleteNoMessage(cu.getTepTin().getId());
                }
            } catch (Exception ex) {
                log.warn("Không thể xóa tệp cũ trên MinIO khi upload đè: {}", ex.getMessage());
            }
            cu.setTrangThai(0);
            bangChungDongGoiRepository.save(cu);
        }

        TepTin tepTin = tepTinService.create(TepTin.builder()
                .tenTepGoc(file.getOriginalFilename())
                .tenTaiLen(file.getOriginalFilename())
                .tenLuuTru(objectName)
                .duongDan(minioUrl)
                .loaiTepTin(loaiTep)
                .duoiTep(ext)
                .kichCo((int) file.getSize())
                .ngayTao(Instant.now())
                .build());

        // Lấy phiếu xuất kho nháp gần nhất của đơn (nếu có)
        PhieuXuatKho phieu = phieuXuatKhoRepository.findByDonBanHangId(don.getId()).stream()
                .filter(p -> Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(p.getTrangThai()))
                .max(Comparator.comparing(PhieuXuatKho::getId))
                .orElse(null);

        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        NguoiDung nguoiTao = (auth != null && auth.getId() != null)
                ? nguoiDungRepository.findById(auth.getId()).orElse(null)
                : null;

        Instant now = Instant.now();
        Instant expiry = now.plus(SO_NGAY_LUU, ChronoUnit.DAYS);

        BangChungDongGoi bc = BangChungDongGoi.builder()
                .donBanHang(don)
                .phieuXuatKho(phieu)
                .danhSachNhatHang(don.getDanhSachNhatHang())
                .tepTin(tepTin)
                .loaiBangChung(loaiBangChung)
                .loaiTep(loaiTep)
                .thoiLuongGiay(thoiLuongGiay)
                .kichThuocBytes(file.getSize())
                .duongDanMinio(minioUrl)
                .nguoiTao(nguoiTao)
                .ngayTao(now)
                .ngayHetHan(expiry)
                .trangThai(1)
                .build();

        BangChungDongGoi saved = bangChungDongGoiRepository.save(bc);
        return toDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaBangChung(Integer bangChungId) {
        BangChungDongGoi bc = bangChungDongGoiRepository.findById(bangChungId)
                .orElseThrow(() -> new CommonException("Không tìm thấy bằng chứng đóng gói id: " + bangChungId, HttpStatus.NOT_FOUND, null));

        if (bc.getDonBanHang() != null) {
            kiemTraKho(bc.getDonBanHang().getKhoXuat());
            kiemTraConSuaBangChung(bc.getDonBanHang());
        }

        // Nếu phiếu xuất đã xuất kho hoặc đã đóng gói xong thì không cho xóa
        if (bc.getPhieuXuatKho() != null && phieuDaDongGoiXong(bc.getPhieuXuatKho())) {
            throw new CommonException("Phiếu xuất đã hoàn tất đóng gói, không thể xóa bằng chứng!", HttpStatus.CONFLICT, null);
        }

        try {
            if (bc.getTepTin() != null) {
                minioService.delete(bc.getTepTin().getTenLuuTru());
                tepTinService.hardDeleteNoMessage(bc.getTepTin().getId());
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi xóa tệp MinIO id {}: {}", bangChungId, ex.getMessage());
        }

        bc.setTrangThai(0);
        bangChungDongGoiRepository.save(bc);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean kiemTraDaDuBangChung(DonBanHang don) {
        if (don == null) return false;
        List<BangChungDongGoi> list = bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(don.getId(), 1);
        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean yeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;
        return kiemTraDaDuBangChungInternal(yeuCauVideo, list);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Integer, Boolean> kiemTraDaDuBangChungTheoDanhSachDon(Collection<Integer> donBanHangIds) {
        if (donBanHangIds == null || donBanHangIds.isEmpty()) return Collections.emptyMap();
        List<BangChungDongGoi> allProofs = bangChungDongGoiRepository.findByDonBanHangIdInAndTrangThai(donBanHangIds, 1);
        Map<Integer, List<BangChungDongGoi>> proofMap = allProofs.stream()
                .filter(p -> p.getDonBanHang() != null)
                .collect(Collectors.groupingBy(p -> p.getDonBanHang().getId()));

        Map<Integer, Boolean> result = new HashMap<>();
        List<DonBanHang> dons = donBanHangRepository.findAllById(donBanHangIds);
        for (DonBanHang don : dons) {
            List<BangChungDongGoi> proofs = proofMap.getOrDefault(don.getId(), Collections.emptyList());
            BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
            boolean yeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;
            result.put(don.getId(), kiemTraDaDuBangChungInternal(yeuCauVideo, proofs));
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Integer, Integer> demSoLuongBangChungTheoDanhSachDon(Collection<Integer> donBanHangIds) {
        if (donBanHangIds == null || donBanHangIds.isEmpty()) return Collections.emptyMap();
        List<BangChungDongGoi> allProofs = bangChungDongGoiRepository.findByDonBanHangIdInAndTrangThai(donBanHangIds, 1);
        Map<Integer, List<BangChungDongGoi>> proofMap = allProofs.stream()
                .filter(p -> p.getDonBanHang() != null)
                .collect(Collectors.groupingBy(p -> p.getDonBanHang().getId()));

        Map<Integer, Integer> result = new HashMap<>();
        for (Integer id : donBanHangIds) {
            result.put(id, proofMap.getOrDefault(id, Collections.emptyList()).size());
        }
        return result;
    }

    private boolean kiemTraDaDuBangChungInternal(boolean yeuCauVideo, List<BangChungDongGoi> list) {
        if (list == null || list.isEmpty()) return false;
        if (yeuCauVideo) {
            return list.stream().anyMatch(b -> LoaiBangChungDongGoi.VIDEO_DONG_GOI.name().equals(b.getLoaiBangChung())
                    && thoiLuongVideoHopLe(b.getThoiLuongGiay()));
        } else {
            boolean coAnhHang = list.stream().anyMatch(b -> LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name().equals(b.getLoaiBangChung()));
            boolean coAnhNiemPhong = list.stream().anyMatch(b -> LoaiBangChungDongGoi.ANH_NIEM_PHONG_TEM_VC.name().equals(b.getLoaiBangChung()));
            return coAnhHang && coAnhNiemPhong;
        }
    }

    public static boolean thoiLuongVideoHopLe(Integer giay) {
        return giay != null && giay >= THOI_LUONG_VIDEO_TOI_THIEU && giay <= THOI_LUONG_VIDEO_TOI_DA;
    }

    /** "từ 15 giây đến 3 phút": dựng từ hai hằng để câu hướng dẫn / câu lỗi luôn khớp điều kiện kiểm. */
    public static String moTaKhoangVideo() {
        return "từ " + chuThoiLuong(THOI_LUONG_VIDEO_TOI_THIEU) + " đến " + chuThoiLuong(THOI_LUONG_VIDEO_TOI_DA);
    }

    /** "15 giây – 3 phút" (dạng ngắn, dùng trong câu hướng dẫn). */
    public static String khoangVideoNgan() {
        return chuThoiLuong(THOI_LUONG_VIDEO_TOI_THIEU) + " – " + chuThoiLuong(THOI_LUONG_VIDEO_TOI_DA);
    }

    /** 15 → "15 giây", 180 → "3 phút", 150 → "2 phút 30 giây". */
    static String chuThoiLuong(int giay) {
        int phut = giay / 60;
        int du = giay % 60;
        if (phut == 0) return giay + " giây";
        return du == 0 ? phut + " phút" : phut + " phút " + du + " giây";
    }

    private void kiemTraKho(Kho kho) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }
        boolean isAdmin = user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer khoLamViec = SecurityContextHolder.getKhoId();
        if (!isAdmin && (kho == null || khoLamViec == null || !khoLamViec.equals(kho.getId()))) {
            throw new CommonException("Đơn hàng thuộc kho khác với kho đang làm việc", HttpStatus.FORBIDDEN, null);
        }
    }

    private BangChungDongGoiDto toDto(BangChungDongGoi b) {
        String tenLoai = b.getLoaiBangChung();
        try {
            tenLoai = LoaiBangChungDongGoi.valueOf(b.getLoaiBangChung()).getMoTa();
        } catch (Exception ignored) {}

        String rawUrl = b.getDuongDanMinio();
        String urlPublic = rawUrl;
        if (rawUrl != null) {
            // Tương thích ngược: Nếu bản ghi cũ chỉ lưu objectName ("packing-proofs/..."), sinh URL đầy đủ
            if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
                rawUrl = minioService.getPublicUrl(rawUrl);
            }
            urlPublic = PublicAssetUrl.toHttps(rawUrl);
        }

        return BangChungDongGoiDto.builder()
                .id(b.getId())
                .donBanHangId(b.getDonBanHang() != null ? b.getDonBanHang().getId() : null)
                .phieuXuatKhoId(b.getPhieuXuatKho() != null ? b.getPhieuXuatKho().getId() : null)
                .pickListId(b.getDanhSachNhatHang() != null ? b.getDanhSachNhatHang().getId() : null)
                .tepTinId(b.getTepTin() != null ? b.getTepTin().getId() : null)
                .loaiBangChung(b.getLoaiBangChung())
                .tenLoaiBangChung(tenLoai)
                .loaiTep(b.getLoaiTep())
                .thoiLuongGiay(b.getThoiLuongGiay())
                .kichThuocBytes(b.getKichThuocBytes())
                .duongDanMinio(urlPublic)
                .urlPublic(urlPublic)
                .nguoiTaoId(b.getNguoiTao() != null ? b.getNguoiTao().getId() : null)
                .tenNguoiTao(b.getNguoiTao() != null ? b.getNguoiTao().getHoTen() : null)
                .ngayTao(b.getNgayTao())
                .ngayHetHan(b.getNgayHetHan())
                .trangThai(b.getTrangThai())
                .ghiChu(b.getGhiChu())
                .build();
    }
}
