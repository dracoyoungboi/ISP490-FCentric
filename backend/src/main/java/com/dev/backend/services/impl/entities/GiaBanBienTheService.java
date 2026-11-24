package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.LocGiaBanRequest;
import com.dev.backend.dto.response.customize.TrangGiaBanDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.utils.GioiHanSoThapPhan;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Giá bán của biến thể: danh sách SKU của màn "Tem mã vạch" (phân trang theo sản phẩm, chỉ SKU đang hoạt động, không có
 * tồn — BA bỏ tồn khỏi màn này; giá bán chỉ để xem — là giá in trên tem — kèm giá cũ nếu vừa đổi), số SKU cần xử lý giá
 * cho Danh sách sản phẩm, và phần kiểm / ghi lịch sử giá mà form Sửa sản phẩm dùng
 * ({@link #kiemTraGiaBan}, {@link #ghiLichSuDoiGia}). Giá bán chỉ đổi ở form Sửa sản phẩm.
 */
@Service
public class GiaBanBienTheService {

    /** Số sản phẩm mỗi trang được chọn (mỗi sản phẩm kéo theo đủ biến thể nên không cho 100). */
    public static final List<Integer> SO_SAN_PHAM_MOI_TRANG = List.of(10, 20, 50);
    static final int SO_SAN_PHAM_MAC_DINH = 20;
    /** Giới hạn của cột gia_ban DECIMAL(15,2). */
    static final BigDecimal GIA_BAN_TOI_DA = new BigDecimal("9999999999999.99");

    public static final String TAB_TAT_CA = "tat-ca";
    /** Đổi giá bán trong {@link #SO_NGAY_DOI_GIA_GAN_DAY} ngày qua: tem đang dán còn giá cũ, cần in lại. */
    public static final String TAB_DOI_GIA = "doi-gia";
    public static final String TAB_CHUA_GIA = "chua-gia";
    public static final String TAB_THIEU_MA = "thieu-ma";
    private static final Set<String> CAC_TAB = Set.of(TAB_TAT_CA, TAB_DOI_GIA, TAB_CHUA_GIA, TAB_THIEU_MA);
    /** Cửa sổ "đổi giá gần đây": SKU tự rời tab sau số ngày này (không lưu "đã in" vì không thêm bảng). */
    public static final int SO_NGAY_DOI_GIA_GAN_DAY = 7;

    public static final String LY_DO_SUA_SAN_PHAM = "Sửa sản phẩm";

    @Autowired
    private GiaBanBienTheRepository giaBanRepository;
    @Autowired
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Autowired
    private AnhQuanAoRepository anhQuanAoRepository;
    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;
    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    // ==================== Danh sách (màn Tem mã vạch) ====================

    @Transactional(readOnly = true)
    public TrangGiaBanDto loc(LocGiaBanRequest yeuCau) {
        LocGiaBanRequest req = yeuCau != null ? yeuCau : new LocGiaBanRequest();
        int trang = req.getPage() != null && req.getPage() > 0 ? req.getPage() : 0;
        int soDong = req.getSize() != null && SO_SAN_PHAM_MOI_TRANG.contains(req.getSize()) ? req.getSize() : SO_SAN_PHAM_MAC_DINH;
        String tuKhoa = tuKhoaLike(req.getTuKhoa());
        String tab = chuanHoaTab(req.getTrangThai());
        Instant tuLuc = tuLucDoiGia();

        Page<Integer> trangId = giaBanRepository.trangSanPhamId(tuKhoa, tab, tuLuc, PageRequest.of(trang, soDong));
        List<Integer> sanPhamIds = trangId.getContent();
        // Số đếm 4 tab chỉ phụ thuộc từ khóa: đổi tab / đổi trang thì giao diện giữ số cũ và gửi kemDem = false
        TrangGiaBanDto.DemTheoTab dem = Boolean.FALSE.equals(req.getKemDem()) ? null : demTheoTab(tuKhoa, tuLuc);
        long tongSku = trangId.getTotalElements() == 0 ? 0
                : dem != null ? soCuaTab(dem, tab) : giaBanRepository.demSku(tuKhoa, tab, tuLuc);

        return TrangGiaBanDto.builder()
                .content(sanPhamIds.isEmpty() ? List.of() : dungNhom(sanPhamIds, tuKhoa, tab, tuLuc))
                .page(trang)
                .size(soDong)
                .tongSanPham(trangId.getTotalElements())
                .tongSku(tongSku)
                .demTheoTab(dem)
                .build();
    }

    private static long soCuaTab(TrangGiaBanDto.DemTheoTab dem, String tab) {
        return switch (tab) {
            case TAB_DOI_GIA -> dem.getDoiGia();
            case TAB_CHUA_GIA -> dem.getChuaGia();
            case TAB_THIEU_MA -> dem.getThieuMa();
            default -> dem.getTatCa();
        };
    }

    private List<TrangGiaBanDto.NhomGiaBan> dungNhom(List<Integer> sanPhamIds, String tuKhoa, String tab, Instant tuLuc) {
        List<BienTheSanPham> dsBienThe = giaBanRepository.bienTheKhopLoc(sanPhamIds, tuKhoa, tab, tuLuc);
        List<Integer> bienTheIds = dsBienThe.stream().map(BienTheSanPham::getId).toList();
        Map<Integer, DoiGia> doiGia = doiGiaGanDay(bienTheIds);
        Map<Integer, Integer> tongPhanLoai = new HashMap<>();
        for (Object[] dong : giaBanRepository.demPhanLoai(sanPhamIds)) {
            tongPhanLoai.put(((Number) dong[0]).intValue(), ((Number) dong[1]).intValue());
        }
        Set<Integer> khopTen = tuKhoa == null ? new HashSet<>(sanPhamIds) : new HashSet<>(giaBanRepository.sanPhamKhopTen(sanPhamIds, tuKhoa));
        Map<Integer, String> anhSanPham = anhDaiDien(sanPhamIds);

        // Truy vấn đã xếp thứ tự phân loại; gom theo sản phẩm vẫn giữ thứ tự đó
        Map<Integer, List<BienTheSanPham>> theoSanPham = new HashMap<>();
        for (BienTheSanPham bt : dsBienThe) {
            theoSanPham.computeIfAbsent(bt.getSanPham().getId(), k -> new ArrayList<>()).add(bt);
        }
        List<TrangGiaBanDto.NhomGiaBan> nhom = new ArrayList<>(sanPhamIds.size());
        for (Integer sanPhamId : sanPhamIds) {
            List<BienTheSanPham> ds = theoSanPham.get(sanPhamId);
            // Biến thể vừa đổi trạng thái / giá giữa hai truy vấn: bỏ qua thay vì trả nhóm rỗng
            if (ds == null || ds.isEmpty()) continue;
            String anh = anhSanPham.get(sanPhamId);
            if (anh == null) {
                anh = ds.stream().map(HienThiBienThe::anh).filter(Objects::nonNull).findFirst().orElse(null);
            }
            nhom.add(TrangGiaBanDto.NhomGiaBan.builder()
                    .sanPhamId(sanPhamId)
                    .tenSanPham(ds.get(0).getSanPham().getTenSanPham())
                    .maSanPham(ds.get(0).getSanPham().getMaSanPham())
                    .anh(anh)
                    .tongPhanLoai(Math.max(ds.size(), tongPhanLoai.getOrDefault(sanPhamId, 0)))
                    .khopTen(khopTen.contains(sanPhamId))
                    .bienThe(ds.stream().map(bt -> TrangGiaBanDto.BienTheGiaBan.builder()
                            .id(bt.getId())
                            .maSku(bt.getMaSku())
                            .maVachSku(bt.getMaVachSku())
                            .mauSac(TrangGiaBanDto.MauSac.builder()
                                    .ten(HienThiBienThe.tenMau(bt))
                                    .maHex(HienThiBienThe.maMauHex(bt))
                                    .build())
                            .kichCo(HienThiBienThe.kichCo(bt))
                            .trangThai(bt.getTrangThai())
                            .giaBan(bt.getGiaBan())
                            .giaBanCu(doiGia.containsKey(bt.getId()) ? doiGia.get(bt.getId()).giaCu() : null)
                            .ngayDoiGia(doiGia.containsKey(bt.getId()) ? doiGia.get(bt.getId()).luc() : null)
                            .build()).toList())
                    .build());
        }
        return nhom;
    }

    private TrangGiaBanDto.DemTheoTab demTheoTab(String tuKhoa, Instant tuLuc) {
        return TrangGiaBanDto.DemTheoTab.builder()
                .tatCa(giaBanRepository.demSku(tuKhoa, TAB_TAT_CA, tuLuc))
                .doiGia(giaBanRepository.demSku(tuKhoa, TAB_DOI_GIA, tuLuc))
                .chuaGia(giaBanRepository.demSku(tuKhoa, TAB_CHUA_GIA, tuLuc))
                .thieuMa(giaBanRepository.demSku(tuKhoa, TAB_THIEU_MA, tuLuc))
                .build();
    }

    /** Mốc "đổi giá gần đây". */
    static Instant tuLucDoiGia() {
        return Instant.now().minus(Duration.ofDays(SO_NGAY_DOI_GIA_GAN_DAY));
    }

    /** Giá trước lần đổi giá bán gần nhất và lúc đổi. */
    public record DoiGia(BigDecimal giaCu, Instant luc) {
    }

    /**
     * Lần đổi giá bán gần nhất (có giá cũ) trong {@link #SO_NGAY_DOI_GIA_GAN_DAY} ngày qua của từng biến thể, đọc từ lịch
     * sử thay đổi (không thêm bảng); biến thể không đổi giá gần đây thì không có trong kết quả.
     */
    public Map<Integer, DoiGia> doiGiaGanDay(Collection<Integer> bienTheIds) {
        if (bienTheIds == null || bienTheIds.isEmpty()) return Map.of();
        Map<Integer, DoiGia> ketQua = new HashMap<>();
        // Truy vấn đã xếp mới nhất trước: giữ dòng đầu của mỗi biến thể
        for (Object[] dong : giaBanRepository.doiGiaGanDay(bienTheIds, tuLucDoiGia())) {
            if (dong == null || dong[0] == null) continue;
            BigDecimal giaCu = docGiaBan((String) dong[1]);
            if (giaCu == null) continue;
            ketQua.putIfAbsent(((Number) dong[0]).intValue(), new DoiGia(giaCu, (Instant) dong[2]));
        }
        return ketQua;
    }

    /** Đọc giá do {@link #jsonGiaBan} ghi ({"giaBan":2000000}); sai dạng hoặc null thì null. */
    static BigDecimal docGiaBan(String json) {
        if (json == null) return null;
        int dau = json.indexOf(':');
        int cuoi = json.lastIndexOf('}');
        if (dau < 0 || cuoi <= dau) return null;
        String so = json.substring(dau + 1, cuoi).trim();
        try {
            return "null".equals(so) ? null : new BigDecimal(so);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Số SKU đang hoạt động chưa có giá bán / bán thấp hơn giá vốn trên toàn hệ thống: thanh "Cần xử lý giá" ở Danh sách
     * sản phẩm (chỉ quản trị viên, người đổi được giá).
     */
    @Transactional(readOnly = true)
    public TrangGiaBanDto.CanXuLyGia demCanXuLy() {
        Object[] dong = dongDau(giaBanRepository.demCanXuLy());
        return TrangGiaBanDto.CanXuLyGia.builder().chuaCoGia(so(dong, 0)).duoiGiaVon(so(dong, 1)).build();
    }

    /** Ảnh chính của từng sản phẩm (truy vấn đã xếp ảnh chính lên trước, giữ ảnh gặp đầu tiên). */
    private Map<Integer, String> anhDaiDien(Collection<Integer> sanPhamIds) {
        Map<Integer, String> ketQua = new HashMap<>();
        for (AnhQuanAo anh : anhQuanAoRepository.findActiveByQuanAoIds(sanPhamIds)) {
            if (anh.getQuanAo() == null || anh.getTepTin() == null || anh.getTepTin().getDuongDan() == null) continue;
            ketQua.putIfAbsent(anh.getQuanAo().getId(), PublicAssetUrl.toHttps(anh.getTepTin().getDuongDan()));
        }
        return ketQua;
    }

    /** Từ khóa cho LIKE … ESCAPE '!': bỏ khoảng trắng hai đầu, trống thì null, thoát ! % _ để gõ chữ nào khớp chữ đó. */
    static String tuKhoaLike(String tuKhoa) {
        if (tuKhoa == null || tuKhoa.isBlank()) return null;
        return tuKhoa.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    static String chuanHoaTab(String tab) {
        if (tab == null || tab.isBlank()) return TAB_TAT_CA;
        String gon = tab.trim();
        if (!CAC_TAB.contains(gon)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.giaBanTrangThaiLocKhongHopLe", gon));
        }
        return gon;
    }

    private static Object[] dongDau(List<Object[]> ds) {
        return ds == null || ds.isEmpty() || ds.get(0) == null ? new Object[0] : ds.get(0);
    }

    private static long so(Object[] dong, int viTri) {
        return dong.length > viTri && dong[viTri] instanceof Number n ? n.longValue() : 0L;
    }

    // ==================== Đổi giá ở form Sửa sản phẩm ====================

    /**
     * Chỉ quản trị viên được đổi giá bán (PUT /update đã khóa ở controller, kiểm thêm ở đây phòng khi mở quyền sửa
     * sản phẩm cho vai trò khác). Gọi nội bộ (không qua HTTP) thì được.
     */
    public static boolean duocDoiGiaBan() {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        return nguoiDung == null || (nguoiDung.getVaiTro() != null && nguoiDung.getVaiTro().contains(IRoleType.quan_tri_vien));
    }

    /**
     * Giá bán gửi lên: bắt buộc, không vượt giới hạn số thập phân, làm tròn 2 chữ số lẻ như cột gia_ban, phải lớn hơn 0.
     * Trả giá đã làm tròn để lưu.
     */
    public static BigDecimal kiemTraGiaBan(BigDecimal gia) {
        if (gia == null) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.giaBanNhapGia"));
        }
        GioiHanSoThapPhan.kiemTra(gia, ThongDiep.of("sanPhamMuaHang.truongGiaBan"));
        BigDecimal lamTron = gia.setScale(2, RoundingMode.HALF_UP);
        if (lamTron.signum() <= 0) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.giaBanLonHon0"));
        }
        if (lamTron.compareTo(GIA_BAN_TOI_DA) > 0) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.giaBanVuotGioiHan"));
        }
        return lamTron;
    }

    /** Giá mới khác giá đang lưu (so theo giá trị: 2000000 và 2000000.00 là một). */
    public static boolean laGiaDoi(BigDecimal giaCu, BigDecimal giaMoi) {
        return giaCu == null ? giaMoi != null : giaMoi != null && giaCu.compareTo(giaMoi) != 0;
    }

    /** Một dòng lịch sử đổi giá bán, ghi trong giao dịch của thao tác đổi giá (lỗi thì cả lần đổi giá hoàn tác). */
    public void ghiLichSuDoiGia(Integer bienTheId, BigDecimal giaCu, BigDecimal giaMoi, String lyDo,
                                NguoiDung nguoiThucHien, Instant luc) {
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.bien_the_san_pham)
                .idThamChieu(bienTheId)
                // Mã SKU: ngăn lịch sử sản phẩm gộp đổi giá mọi biến thể, cần biết dòng nào của SKU nào
                .maDoiTuong(maSku(bienTheId))
                .hanhDong(IHanhDong.doi_gia_ban)
                .giaTriCu(jsonGiaBan(giaCu))
                .giaTriMoi(jsonGiaBan(giaMoi))
                .nguoiThucHien(nguoiThucHien)
                .ngayThucHien(luc)
                .ghiChu(lyDo)
                .build());
    }

    /** Mã SKU của biến thể (thường đã nạp trong giao dịch nên không thêm câu truy vấn); không có thì trống. */
    private String maSku(Integer bienTheId) {
        if (bienTheId == null || bienTheSanPhamRepository == null) return null;
        return bienTheSanPhamRepository.findById(bienTheId).map(BienTheSanPham::getMaSku).orElse(null);
    }

    /** {"giaBan":2000000} — số viết gọn, không số mũ, không đuôi .00. */
    static String jsonGiaBan(BigDecimal gia) {
        return "{\"giaBan\":" + (gia == null ? "null" : gia.stripTrailingZeros().toPlainString()) + "}";
    }

    /** Người đang gọi API (cột nguoi_thuc_hien_id bắt buộc). */
    public NguoiDung nguoiDangThucHien() {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth == null || auth.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("sanPhamMuaHang.giaBanKhongXacDinhNguoiDoi"));
        }
        return nguoiDungRepository.findById(auth.getId()).orElseThrow(
                () -> new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("sanPhamMuaHang.giaBanKhongXacDinhNguoiDoi")));
    }
}
