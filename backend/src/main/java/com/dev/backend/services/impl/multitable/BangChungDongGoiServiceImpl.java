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
import com.dev.backend.services.impl.entities.TepTinService;
import com.dev.backend.services.multitable.BangChungDongGoiService;
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
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024; // 10MB
    private static final long MAX_VIDEO_SIZE = 100L * 1024 * 1024; // 100MB

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
        kiemTraKho(don.getKhoXuat());

        List<BangChungDongGoi> list = bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(donBanHangId, 1);
        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean yeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;
        boolean daDu = kiemTraDaDuBangChungInternal(yeuCauVideo, list);

        List<BangChungDongGoiDto> dtoList = list.stream().map(this::toDto).collect(Collectors.toList());

        String huongDan = yeuCauVideo
                ? "Đơn hàng giá trị từ 1.000.000đ trở lên: Bắt buộc quay 1 video ngắn (15-30 giây) từ lúc cho đồ vào đến khi niêm phong."
                : "Đơn hàng giá trị dưới 1.000.000đ: Bắt buộc tải lên 2 ảnh (Ảnh 1: Hàng đã cho vào hộp/túi; Ảnh 2: Hộp đã dán băng keo niêm phong kèm tem ĐVVC).";

        return ThongTinBangChungDonDto.builder()
                .donBanHangId(don.getId())
                .soDonHang(don.getSoDonHang())
                .tongTienDonHang(tongTien)
                .yeuCauVideo(yeuCauVideo)
                .loaiYeuCau(yeuCauVideo ? "VIDEO_15_30S" : "ANH_2_BUOC")
                .huongDan(huongDan)
                .daDuBangChung(daDu)
                .soLuongHienCo(list.size())
                .soLuongYeuCau(yeuCauVideo ? 1 : 2)
                .danhSachBangChung(dtoList)
                .build();
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

        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean donYeuCauVideo = tongTien.compareTo(NGUONG_TIEN_VIDEO) >= 0;

        // Phân định quy chuẩn ảnh vs video
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String loaiTep;

        if (donYeuCauVideo) {
            if (!LoaiBangChungDongGoi.VIDEO_DONG_GOI.name().equals(loaiBangChung)) {
                throw new CommonException("Đơn hàng từ 1.000.000đ trở lên bắt buộc phải quay Video đóng gói (15-30s)!", HttpStatus.BAD_REQUEST, null);
            }
            if (!contentType.startsWith("video/") && !isAllowedVideoExtension(file.getOriginalFilename())) {
                throw new CommonException("Định dạng tệp không phải video hợp lệ (MP4, WebM, MOV)!", HttpStatus.BAD_REQUEST, null);
            }
            if (file.getSize() > MAX_VIDEO_SIZE) {
                throw new CommonException("Dung lượng video vượt quá 100MB cho phép!", HttpStatus.BAD_REQUEST, null);
            }
            if (thoiLuongGiay == null || thoiLuongGiay < 15 || thoiLuongGiay > 30) {
                throw new CommonException("Thời lượng video đóng gói phải từ 15 đến 30 giây (Nhận được: "
                        + (thoiLuongGiay != null ? thoiLuongGiay + "s" : "chưa xác định") + ")!", HttpStatus.BAD_REQUEST, null);
            }
            loaiTep = FileType.VIDEO.toString();
        } else {
            if (LoaiBangChungDongGoi.VIDEO_DONG_GOI.name().equals(loaiBangChung)) {
                throw new CommonException("Đơn hàng dưới 1.000.000đ chỉ yêu cầu tải 2 ảnh đóng gói!", HttpStatus.BAD_REQUEST, null);
            }
            if (!contentType.startsWith("image/") && !isAllowedImageExtension(file.getOriginalFilename())) {
                throw new CommonException("Định dạng tệp không phải hình ảnh hợp lệ (JPEG, PNG, WebP)!", HttpStatus.BAD_REQUEST, null);
            }
            if (file.getSize() > MAX_IMAGE_SIZE) {
                throw new CommonException("Dung lượng ảnh vượt quá 10MB cho phép!", HttpStatus.BAD_REQUEST, null);
            }
            loaiTep = FileType.IMAGE.toString();
        }

        // 1. Tách biệt I/O MinIO ngoài transaction DB (chống nghẽn connection pool theo hunt-springboot)
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "proof";
        String ext = getFileExtension(originalFilename);
        String objectName = "packing-proofs/" + donBanHangId + "/" + UUID.randomUUID() + (ext.isEmpty() ? "" : "." + ext);
        String minioUrl;
        try {
            minioUrl = minioService.upload(file, objectName);
        } catch (Exception e) {
            log.error("Lỗi khi tải tệp lên MinIO: {}", e.getMessage(), e);
            throw new CommonException("Không thể lưu trữ tệp lên hệ thống MinIO: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }

        // 2. Mở Transaction lưu DB
        return luuBangChungVaoDb(don, file, objectName, minioUrl, loaiBangChung, loaiTep, thoiLuongGiay, ext);
    }

    @Transactional(rollbackFor = Exception.class)
    protected BangChungDongGoiDto luuBangChungVaoDb(DonBanHang don, MultipartFile file, String objectName,
                                                    String minioUrl, String loaiBangChung, String loaiTep,
                                                    Integer thoiLuongGiay, String ext) {
        // Nếu đã có bằng chứng cùng loại đang hoạt động: xóa cũ thay mới
        Optional<BangChungDongGoi> cuOpt = bangChungDongGoiRepository
                .findByDonBanHangIdAndLoaiBangChungAndTrangThai(don.getId(), loaiBangChung, 1);
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
        Instant expiry = now.plus(30, ChronoUnit.DAYS);

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
        }

        // Nếu phiếu xuất đã xuất kho hoặc đã đóng gói xong thì không cho xóa
        if (bc.getPhieuXuatKho() != null) {
            Integer ttPhieu = bc.getPhieuXuatKho().getTrangThai();
            if (Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(ttPhieu)
                    || Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(ttPhieu)) {
                throw new CommonException("Phiếu xuất đã hoàn tất đóng gói, không thể xóa bằng chứng!", HttpStatus.BAD_REQUEST, null);
            }
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
                    && b.getThoiLuongGiay() != null && b.getThoiLuongGiay() >= 15 && b.getThoiLuongGiay() <= 30);
        } else {
            boolean coAnhHang = list.stream().anyMatch(b -> LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name().equals(b.getLoaiBangChung()));
            boolean coAnhNiemPhong = list.stream().anyMatch(b -> LoaiBangChungDongGoi.ANH_NIEM_PHONG_TEM_VC.name().equals(b.getLoaiBangChung()));
            return coAnhHang && coAnhNiemPhong;
        }
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

        String urlPublic = b.getDuongDanMinio();
        if (urlPublic != null) {
            urlPublic = PublicAssetUrl.toHttps(urlPublic);
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
                .duongDanMinio(b.getDuongDanMinio())
                .urlPublic(urlPublic)
                .nguoiTaoId(b.getNguoiTao() != null ? b.getNguoiTao().getId() : null)
                .tenNguoiTao(b.getNguoiTao() != null ? b.getNguoiTao().getHoTen() : null)
                .ngayTao(b.getNgayTao())
                .ngayHetHan(b.getNgayHetHan())
                .trangThai(b.getTrangThai())
                .ghiChu(b.getGhiChu())
                .build();
    }

    private static String getFileExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return (dot >= 0 && dot < filename.length() - 1) ? filename.substring(dot + 1).toLowerCase() : "";
    }

    private static boolean isAllowedImageExtension(String filename) {
        String ext = getFileExtension(filename);
        return ext.equals("jpg") || ext.equals("jpeg") || ext.equals("png") || ext.equals("webp");
    }

    private static boolean isAllowedVideoExtension(String filename) {
        String ext = getFileExtension(filename);
        return ext.equals("mp4") || ext.equals("webm") || ext.equals("mov");
    }
}
