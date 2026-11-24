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
import java.time.Instant;
import java.util.*;

/**
 * Giá bán của biến thể: danh sách SKU của màn "Tem mã vạch" (phân trang theo sản phẩm, giá bán chỉ để xem — là giá in
 * trên tem), số SKU cần xử lý giá cho Danh sách sản phẩm, và phần kiểm / ghi lịch sử giá mà form Sửa sản phẩm dùng
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
    public static final String TAB_HOAT_DONG = "hoat-dong";
    public static final String TAB_NGUNG_HOAT_DONG = "ngung-hoat-dong";
    private static final Set<String> CAC_TAB = Set.of(TAB_TAT_CA, TAB_HOAT_DONG, TAB_NGUNG_HOAT_DONG);

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

        Page<Integer> trangId = giaBanRepository.trangSanPhamId(tuKhoa, tab, PageRequest.of(trang, soDong));
        List<Integer> sanPhamIds = trangId.getContent();
        long tongSku = trangId.getTotalElements() == 0 ? 0 : giaBanRepository.demSku(tuKhoa, tab);

        return TrangGiaBanDto.builder()
                .content(sanPhamIds.isEmpty() ? List.of() : dungNhom(sanPhamIds, tuKhoa, tab))
                .page(trang)
                .size(soDong)
                .tongSanPham(trangId.getTotalElements())
                .tongSku(tongSku)
                .demTheoTab(demTheoTab(tuKhoa))
                .build();
    }

    private List<TrangGiaBanDto.NhomGiaBan> dungNhom(List<Integer> sanPhamIds, String tuKhoa, String tab) {
        List<BienTheSanPham> dsBienThe = giaBanRepository.bienTheKhopLoc(sanPhamIds, tuKhoa, tab);
        List<Integer> bienTheIds = dsBienThe.stream().map(BienTheSanPham::getId).toList();
        Map<Integer, BigDecimal> ton = tonKho(bienTheIds);
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
                            .tonKho(ton.getOrDefault(bt.getId(), BigDecimal.ZERO))
                            .build()).toList())
                    .build());
        }
        return nhom;
    }

    private TrangGiaBanDto.DemTheoTab demTheoTab(String tuKhoa) {
        Object[] dong = dongDau(giaBanRepository.demTheoTab(tuKhoa));
        long tatCa = so(dong, 0);
        long hoatDong = so(dong, 1);
        return TrangGiaBanDto.DemTheoTab.builder()
                .tatCa(tatCa)
                .hoatDong(hoatDong)
                .ngungHoatDong(Math.max(0, tatCa - hoatDong))
                .build();
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

    /** Tổng tồn mọi kho của các biến thể; biến thể không có dòng tồn nào hiểu là 0. */
    public Map<Integer, BigDecimal> tonKho(Collection<Integer> bienTheIds) {
        if (bienTheIds == null || bienTheIds.isEmpty()) return Map.of();
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        for (Object[] dong : giaBanRepository.tonKho(bienTheIds)) {
            if (dong == null || dong[0] == null || dong[1] == null) continue;
            BigDecimal soLuong = dong[1] instanceof BigDecimal bd ? bd : new BigDecimal(dong[1].toString());
            ketQua.put(((Number) dong[0]).intValue(), soLuong);
        }
        return ketQua;
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
