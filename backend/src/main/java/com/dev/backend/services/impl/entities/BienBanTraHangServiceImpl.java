package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.utils.KhoDangChon;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BienBanTraHangServiceImpl implements BienBanTraHangService {

    BienBanTraHangNccRepository bienBanTraHangNccRepository;
    ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    PhieuNhapKhoRepository phieuNhapKhoRepository;
    NguoiDungRepository nguoiDungRepository;
    ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;

    /** Phương án xử lý hàng lỗi (khớp PHUONG_AN_TRA_HANG ở frontend). */
    static final Set<String> PHUONG_AN_HOP_LE = Set.of("DOI_HANG", "TRU_CONG_NO", "TRA_TAI_XE");
    /** Lô khóa trước khi có bảng chi tiết lỗi chỉ có tổng số lỗi. */
    static final String LY_DO_CHUA_GHI = "Chưa ghi lý do";
    static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId) {
        phieuNhapKhoRepository.findById(phieuNhapKhoId)
                .ifPresent(phieu -> KhoDangChon.kiemTraXem(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap()));
        Optional<BienBanTraHangNcc> opt = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId)
                .filter(BienBanTraHangNcc::dangHieuLuc);
        return opt.map(this::toDto).orElse(null);
    }

    /**
     * Lập (hoặc lập lại) biên bản trả hàng của phiếu nhập đang kiểm đếm.
     * Dòng biên bản lấy từ hàng không đạt đã lưu theo lô (chi_tiet_loi_lo_hang), không lấy từ request:
     * máy nào mở cũng ra cùng một biên bản, và số trên biên bản luôn khớp số kiểm đếm.
     * Phiếu không còn hàng lỗi mà đã có biên bản (lô lỗi bị xóa): hủy biên bản, trả null.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId) {
        // Khóa dòng phiếu trước (cùng thứ tự với khóa lô / nhập kho): biên bản lập từ đúng số lô đang có, không chen giữa lúc nhập kho
        PhieuNhapKho phieu = phieuNhapKhoRepository.khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập kho ID: " + phieuNhapKhoId));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getTrangThai() == null || phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Chỉ lập biên bản trả hàng khi phiếu nhập đang kiểm đếm (Nháp)");
        }
        if (phieu.getNhaCungCap() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu nhập không có thông tin Nhà cung cấp để lập biên bản trả hàng");
        }

        String phuongAn = request != null && request.getPhuongAn() != null && !request.getPhuongAn().isBlank()
                ? request.getPhuongAn().trim() : "DOI_HANG";
        // Biên bản lập trước khi đổi tên phương án vẫn mang mã cũ: lập lại / hủy không bị từ chối
        if ("DOI_HANG_MOI".equals(phuongAn)) phuongAn = "DOI_HANG";
        if (!PHUONG_AN_HOP_LE.contains(phuongAn)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Phương án xử lý không hợp lệ. Chọn Đổi hàng, Trừ công nợ hoặc Trả tài xế.");
        }
        String ghiChu = request != null && request.getGhiChu() != null && !request.getGhiChu().isBlank()
                ? request.getGhiChu().trim() : null;

        // Kể cả biên bản đã hủy của phiếu: lập lại thì dùng lại đúng số đó (một phiếu một số biên bản)
        BienBanTraHangNcc bienBan = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId).orElse(null);
        // Lập lại biên bản đang hiệu lực: lô khóa bằng bản cũ (chưa có chi tiết lỗi) giữ lý do đã ghi trên biên bản
        List<ChiTietTraHangNcc> dongBienBanHieuLuc = bienBan != null && bienBan.getId() != null && bienBan.dangHieuLuc()
                ? chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId()) : List.of();
        List<ChiTietTraHangNcc> dongMoi = dongTuHangLoiDaLuu(phieuNhapKhoId, dongBienBanHieuLuc);

        if (dongMoi.isEmpty()) {
            if (bienBan == null || !bienBan.dangHieuLuc()) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu nhập không có hàng không đạt nên không cần lập biên bản trả hàng");
            }
            // Hủy, không xóa: số biên bản đã cấp không được cấp lại cho biên bản khác
            bienBan.setTrangThai(BienBanTraHangNcc.DA_HUY);
            bienBanTraHangNccRepository.save(bienBan);
            log.info("[RTV-HUY] Hủy biên bản `{}` của phiếu nhập `{}` vì không còn hàng lỗi", bienBan.getMaBienBan(), phieu.getSoPhieuNhap());
            return null;
        }

        if (bienBan == null) {
            NguoiDung nguoiTao = nguoiDungRepository.findById(nguoiTaoId)
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người tạo ID: " + nguoiTaoId));
            bienBan = BienBanTraHangNcc.builder()
                    .maBienBan(sinhMaBienBan())
                    .phieuNhapKho(phieu)
                    .nhaCungCap(phieu.getNhaCungCap())
                    .nguoiTao(nguoiTao)
                    .build();
        } else {
            // Lập lại: thay toàn bộ dòng cũ bằng số kiểm đếm hiện tại, giữ số biên bản
            chiTietTraHangNccRepository.deleteAll(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId()));
        }

        bienBan.setPhuongAnXuLy(phuongAn);
        bienBan.setGhiChu(ghiChu);
        bienBan.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
        bienBan.setTongSoLuongLoi(dongMoi.stream().mapToInt(ChiTietTraHangNcc::getSoLuongLoi).sum());
        BienBanTraHangNcc savedHeader;
        try {
            savedHeader = bienBanTraHangNccRepository.saveAndFlush(bienBan);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // Hai biên bản lập cùng lúc được cùng số: biên bản sau lập lại sẽ nhận số kế tiếp
            throw new CommonException(HttpStatus.CONFLICT,
                    "Số biên bản " + bienBan.getMaBienBan() + " vừa được cấp cho biên bản khác lập cùng lúc. Bấm lập biên bản lại.");
        }
        for (ChiTietTraHangNcc dong : dongMoi) {
            dong.setBienBanTraHangNcc(savedHeader);
        }
        chiTietTraHangNccRepository.saveAll(dongMoi);

        log.info("[RTV-ISSUED] Đã phát hành biên bản trả hàng NCC `{}` cho phiếu nhập `{}` với {} sản phẩm lỗi",
                savedHeader.getMaBienBan(), phieu.getSoPhieuNhap(), savedHeader.getTongSoLuongLoi());

        return toDto(savedHeader);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean khopHangLoiHienTai(BienBanTraHangNcc bienBan) {
        List<ChiTietTraHangNcc> dongBienBan = chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId());
        List<ChiTietTraHangNcc> dongHienTai = dongTuHangLoiDaLuu(bienBan.getPhieuNhapKho().getId(),
                bienBan.dangHieuLuc() ? dongBienBan : List.of());
        return demTheoLoVaLyDo(dongBienBan).equals(demTheoLoVaLyDo(dongHienTai));
    }

    /**
     * Số lượng theo (lô, lý do). Dòng mất lô (lô đã bị xóa) có khóa "null|…" nên không bao giờ khớp dòng hiện tại.
     * Lý do so không phân biệt hoa thường / khoảng trắng thừa, giống cách khóa lô gộp lý do ("Rách vải" = "rách  vải").
     */
    private static Map<String, Integer> demTheoLoVaLyDo(List<ChiTietTraHangNcc> dong) {
        Map<String, Integer> dem = new HashMap<>();
        for (ChiTietTraHangNcc c : dong) {
            String lyDo = c.getLyDoLoi() == null ? "" : c.getLyDoLoi().trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
            String khoa = (c.getLoHang() != null ? c.getLoHang().getId() : null) + "|" + lyDo;
            dem.merge(khoa, c.getSoLuongLoi() != null ? c.getSoLuongLoi() : 0, Integer::sum);
        }
        return dem;
    }

    /**
     * Một dòng biên bản cho mỗi (lô, lý do) của các lô đã khóa trong phiếu.
     * {@code dongBienBanHieuLuc}: dòng của biên bản đang hiệu lực của phiếu (rỗng nếu chưa có / đã hủy), xem {@link #dongBienBanCuCuaLo}.
     */
    private List<ChiTietTraHangNcc> dongTuHangLoiDaLuu(Integer phieuNhapKhoId, List<ChiTietTraHangNcc> dongBienBanHieuLuc) {
        List<LoHang> loCoLoi = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapKhoId).stream()
                .map(ChiTietPhieuNhapKho::getLoHang)
                .filter(lo -> lo.getSoLuongLoi() != null && lo.getSoLuongLoi() > 0)
                .sorted(Comparator.comparing(LoHang::getId))
                .toList();
        if (loCoLoi.isEmpty()) return List.of();

        Map<Integer, List<ChiTietLoiLoHang>> chiTietTheoLo = new HashMap<>();
        for (ChiTietLoiLoHang c : chiTietLoiLoHangRepository.findByLoHangIds(loCoLoi.stream().map(LoHang::getId).toList())) {
            chiTietTheoLo.computeIfAbsent(c.getLoHang().getId(), k -> new ArrayList<>()).add(c);
        }

        Map<Integer, List<ChiTietTraHangNcc>> dongCuTheoLo = dongBienBanTheoLo(dongBienBanHieuLuc, loCoLoi);
        List<ChiTietTraHangNcc> ketQua = new ArrayList<>();
        for (LoHang lo : loCoLoi) {
            List<ChiTietLoiLoHang> chiTiet = chiTietTheoLo.getOrDefault(lo.getId(), List.of());
            if (chiTiet.isEmpty()) {
                List<ChiTietTraHangNcc> dongCu = dongBienBanCuCuaLo(dongCuTheoLo.getOrDefault(lo.getId(), List.of()), lo);
                if (!dongCu.isEmpty()) {
                    for (ChiTietTraHangNcc c : dongCu) {
                        // Dòng mới (dòng cũ bị xóa khi lập lại), chỉ chép lý do / số / ghi chú / ảnh của dòng cũ
                        ketQua.add(ChiTietTraHangNcc.builder()
                                .bienTheSanPham(lo.getBienTheSanPham())
                                .loHang(lo)
                                .maLo(lo.getMaLo())
                                .lyDoLoi(c.getLyDoLoi())
                                .soLuongLoi(c.getSoLuongLoi())
                                .ghiChu(c.getGhiChu())
                                .anhBangChungUrl(c.getAnhBangChungUrl())
                                .build());
                    }
                    continue;
                }
            }
            int daCoLyDo = 0;
            for (ChiTietLoiLoHang c : chiTiet) {
                ketQua.add(ChiTietTraHangNcc.builder()
                        .bienTheSanPham(lo.getBienTheSanPham())
                        .loHang(lo)
                        .maLo(lo.getMaLo())
                        .lyDoLoi(c.getLyDo())
                        .soLuongLoi(c.getSoLuong())
                        .ghiChu(c.getGhiChu())
                        .build());
                daCoLyDo += c.getSoLuong();
            }
            // Lô khóa trước khi lưu lý do: phần lỗi chưa có lý do vẫn vào biên bản để tổng khớp kiểm đếm
            int conThieu = lo.getSoLuongLoi() - daCoLyDo;
            if (conThieu > 0) {
                ketQua.add(ChiTietTraHangNcc.builder()
                        .bienTheSanPham(lo.getBienTheSanPham())
                        .loHang(lo)
                        .maLo(lo.getMaLo())
                        .lyDoLoi(LY_DO_CHUA_GHI)
                        .soLuongLoi(conThieu)
                        .build());
            }
        }
        return ketQua;
    }

    /**
     * Lô khóa bằng bản cũ (chưa có dòng chi_tiet_loi_lo_hang) mà biên bản đang hiệu lực cũng lập bằng bản cũ (dòng mang lý do
     * người kiểm nhập): dùng lại các dòng biên bản của đúng lô đó khi tổng số của chúng bằng số lỗi của lô. Không thì trả rỗng
     * (lô vào dòng "Chưa ghi lý do" như trước). Nhờ vậy biên bản cũ không bị coi là lệch, lập lại cũng không mất lý do.
     * {@code cuaLo}: dòng biên bản đã gán cho lô này ({@link #dongBienBanTheoLo}).
     */
    private static List<ChiTietTraHangNcc> dongBienBanCuCuaLo(List<ChiTietTraHangNcc> cuaLo, LoHang lo) {
        int tong = cuaLo.stream().mapToInt(d -> d.getSoLuongLoi() != null ? d.getSoLuongLoi() : 0).sum();
        return !cuaLo.isEmpty() && tong == lo.getSoLuongLoi() ? cuaLo : List.of();
    }

    /**
     * Gán mỗi dòng biên bản đang hiệu lực cho nhiều nhất một lô có lỗi của phiếu (khóa: id lô). Bản cũ gắn lô cho dòng
     * bằng mã lô trên toàn hệ thống (findFirstByMaLo, không theo biến thể): lô của dòng có thể null, hoặc là lô của biến
     * thể khác trùng mã lô. Nên dòng thuộc lô cùng biến thể + cùng mã lô trước; không có lô như vậy mới theo lô đã gắn
     * (và lô đó không thuộc biến thể khác với dòng).
     */
    private static Map<Integer, List<ChiTietTraHangNcc>> dongBienBanTheoLo(List<ChiTietTraHangNcc> dongBienBanHieuLuc, List<LoHang> loCoLoi) {
        Map<Integer, List<ChiTietTraHangNcc>> theoLo = new HashMap<>();
        for (ChiTietTraHangNcc d : dongBienBanHieuLuc) {
            LoHang loCuaDong = loCoLoi.stream().filter(lo -> cungBienTheVaMaLo(d, lo)).findFirst()
                    .orElseGet(() -> loCoLoi.stream().filter(lo -> daGanLo(d, lo)).findFirst().orElse(null));
            if (loCuaDong != null) {
                theoLo.computeIfAbsent(loCuaDong.getId(), k -> new ArrayList<>()).add(d);
            }
        }
        return theoLo;
    }

    /** Dòng cùng biến thể với lô và cùng mã lô (không phân biệt hoa thường / khoảng trắng thừa). */
    private static boolean cungBienTheVaMaLo(ChiTietTraHangNcc d, LoHang lo) {
        String maLo = chuanHoaMaLo(d.getMaLo());
        return !maLo.isEmpty() && maLo.equals(chuanHoaMaLo(lo.getMaLo()))
                && d.getBienTheSanPham() != null && lo.getBienTheSanPham() != null
                && Objects.equals(d.getBienTheSanPham().getId(), lo.getBienTheSanPham().getId());
    }

    /** Dòng đã gắn đúng lô này (theo id) và lô không thuộc biến thể khác với biến thể của dòng. */
    private static boolean daGanLo(ChiTietTraHangNcc d, LoHang lo) {
        return d.getLoHang() != null && lo.getId().equals(d.getLoHang().getId())
                && (d.getBienTheSanPham() == null || lo.getBienTheSanPham() == null
                        || Objects.equals(d.getBienTheSanPham().getId(), lo.getBienTheSanPham().getId()));
    }

    private static String chuanHoaMaLo(String maLo) {
        return maLo == null ? "" : maLo.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BienBanTraHangDto> dsTheoNhaCungCap(Integer nhaCungCapId) {
        // Chỉ biên bản của phiếu thuộc kho người dùng được phân quyền (quản trị viên xem tất cả)
        return bienBanTraHangNccRepository.findByNhaCungCap_IdOrderByNgayTaoDesc(nhaCungCapId)
                .stream()
                .filter(BienBanTraHangNcc::dangHieuLuc)
                .filter(b -> KhoDangChon.duocXem(b.getPhieuNhapKho().getKho()))
                .map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto chiTiet(Integer id) {
        BienBanTraHangNcc b = bienBanTraHangNccRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biên bản trả hàng ID: " + id));
        KhoDangChon.kiemTraXem(b.getPhieuNhapKho().getKho(), "Biên bản trả hàng " + b.getMaBienBan());
        return toDto(b);
    }

    /**
     * Số biên bản RTV-yyyyMMdd-NNN theo ngày Việt Nam: lấy số thứ tự lớn nhất đã cấp trong ngày + 1.
     * Biên bản hủy vẫn giữ dòng (trạng thái DA_HUY) nên số lớn nhất không bao giờ lùi: số đã cấp không cấp lại.
     */
    private String sinhMaBienBan() {
        String tienTo = "RTV-" + LocalDate.now(MUI_GIO_VN).format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        int lonNhat = 0;
        for (String ma : bienBanTraHangNccRepository.findMaBienBanTheoTienTo(tienTo)) {
            try {
                lonNhat = Math.max(lonNhat, Integer.parseInt(ma.substring(tienTo.length())));
            } catch (NumberFormatException | IndexOutOfBoundsException ignored) {
                // số biên bản nhập tay khác mẫu: bỏ qua
            }
        }
        return String.format("%s%03d", tienTo, lonNhat + 1);
    }

    private BienBanTraHangDto toDto(BienBanTraHangNcc b) {
        List<ChiTietTraHangNcc> chiTiets = chiTietTraHangNccRepository.findDetailByBienBanId(b.getId());
        List<BienBanTraHangDto.ChiTietItemDto> items = chiTiets.stream().map(c -> {
            BienTheSanPham bt = c.getBienTheSanPham();
            return BienBanTraHangDto.ChiTietItemDto.builder()
                    .id(c.getId())
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .maLo(c.getMaLo())
                    .mauSac(bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null)
                    .kichCo(bt.getSize() != null ? bt.getSize().getTenSize() : null)
                    .lyDo(c.getLyDoLoi())
                    .soLuong(c.getSoLuongLoi())
                    .anhBangChungUrl(c.getAnhBangChungUrl())
                    .ghiChu(c.getGhiChu())
                    .build();
        }).toList();

        return BienBanTraHangDto.builder()
                .id(b.getId())
                .soBienBan(b.getMaBienBan())
                .phieuNhapKhoId(b.getPhieuNhapKho().getId())
                .soPhieuNhap(b.getPhieuNhapKho().getSoPhieuNhap())
                .nhaCungCapId(b.getNhaCungCap().getId())
                .tenNhaCungCap(b.getNhaCungCap().getTenNhaCungCap())
                .phuongAn(b.getPhuongAnXuLy())
                .ghiChu(b.getGhiChu())
                .ngayLap(b.getNgayTao())
                .tongSoLuongLoi(b.getTongSoLuongLoi())
                .trangThai(b.getTrangThai())
                .items(items)
                .build();
    }
}

