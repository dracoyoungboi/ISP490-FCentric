package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.entities.ChiTietPhieuChuyenKe;
import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuGiaoDichKho;
import com.dev.backend.entities.PhieuChuyenKe;
import com.dev.backend.entities.PhieuChuyenKho;
import com.dev.backend.entities.PhieuDieuChinhKho;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.entities.ViTriKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.LichSuGiaoDichKhoMapper;
import com.dev.backend.repository.ChiTietPhieuChuyenKeRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.LichSuGiaoDichKhoRepository;
import com.dev.backend.repository.PhieuChuyenKeRepository;
import com.dev.backend.repository.PhieuDieuChinhKhoRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

@Service
@RequiredArgsConstructor
public class LichSuGiaoDichKhoService {

    private final LichSuGiaoDichKhoRepository repository;
    private final LichSuGiaoDichKhoMapper mapper;
    private final ViTriKhoRepository viTriKhoRepository;
    private final ChiTietPhieuChuyenKeRepository chiTietPhieuChuyenKeRepository;
    private final PhieuNhapKhoRepository phieuNhapKhoRepository;
    private final PhieuXuatKhoRepository phieuXuatKhoRepository;
    private final PhieuDieuChinhKhoRepository phieuDieuChinhKhoRepository;
    private final PhieuChuyenKeRepository phieuChuyenKeRepository;
    private final DonBanHangRepository donBanHangRepository;

    /**
     * Lấy danh sách lịch sử giao dịch theo phân quyền:
     *  - quan_tri_vien  → xem tất cả
     *  - quan_ly_kho    → chỉ xem kho mình được phân quyền (phan_quyen_nguoi_dung_kho, trangThai=1)
     *  - nhan_vien_kho  → chỉ xem kho mình được phân công (phan_quyen_nguoi_dung_kho, trangThai=1)
     */
    @Transactional(readOnly = true)
    public List<LichSuGiaoDichKhoDto> getAll() {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();

        boolean isAdmin    = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        boolean isQuanLy   = currentUser.getVaiTro().contains(IRoleType.quan_ly_kho);
        boolean isNhanVien = currentUser.getVaiTro().contains(IRoleType.nhan_vien_kho);

        List<LichSuGiaoDichKho> result;

        if (isAdmin) {
            result = repository.findAllWithDetails();

        } else if (isQuanLy) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByQuanLyId(currentUser.getId());

        } else if (isNhanVien) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByNhanVienId(currentUser.getId());

        } else {
            throw new CommonException(ThongDiep.of("chungTuKho.khongCoQuyenTruyCap"));
        }

        return result.stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LichSuGiaoDichKhoDto getChiTiet(Integer id) {
        LichSuGiaoDichKho entity = repository.findByIdWithDetails(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("chungTuKho.lichSuKhongTimThay", id)));
        LichSuGiaoDichKhoDto dto = mapper.toDto(entity);
        // Dòng chuyển kệ: thêm khu, dãy, hàng, tầng của hai kệ. Mã kệ giữ như sổ ghi lúc chuyển.
        if (dto.getKeNguon() != null && dto.getKeDich() != null) {
            ChiTietPhieuChuyenKe dong = timDongPhieu(entity);
            if (dong != null) {
                // Lấy đúng hai kệ của dòng phiếu: kệ có đổi mã sau đó vẫn ra vị trí đúng
                dto.setKeNguon(keCo(dto.getKeNguon().getMa(), dong.getKeNguon()));
                dto.setKeDich(keCo(dto.getKeDich().getMa(), dong.getKeDich()));
            } else if (dto.getKhoId() != null) {
                // Không thấy dòng phiếu (dữ liệu cũ, lệch): tra theo mã kệ trong kho của dòng sổ
                dto.setKeNguon(theoMa(dto.getKhoId(), dto.getKeNguon()));
                dto.setKeDich(theoMa(dto.getKhoId(), dto.getKeDich()));
            }
        }
        boSungChungTu(entity, dto);
        return dto;
    }

    // ── Chứng từ của dòng sổ ─────────────────────────────────────────────────────────────────────────────────────────
    // Câu ghi chú do các nơi ghi sổ tự ghi (lưu tiếng Việt trong CSDL). Đổi câu ở nơi ghi thì THÊM mẫu mới ở đây, giữ mẫu
    // cũ cho dòng đã ghi. Câu khớp mẫu thì mọi thông tin của nó đã có ở các trường riêng → giao diện không hiện lại ghi chú.

    /** PhieuNhapKhoService, nhập theo đơn mua. Bản cũ không kèm kệ. */
    private static final Pattern NHAP_NCC = Pattern.compile("^Nhập kho từ phiếu: (\\S+)(?: \\(Kệ: (.+)\\))?$");
    /** PhieuNhapKhoService, phiếu nhập không có đơn mua. */
    private static final Pattern NHAP_TRA_VE = Pattern.compile("^Nhập hoàn trả \\(Return\\) từ phiếu: (\\S+)$");
    /** TraHangTaiQuayTransaction: phiếu nhập (phiếu trả hàng, đơn gốc). */
    private static final Pattern KHACH_TRA = Pattern.compile("^Nhập hàng bán trả lại POS: (\\S+) \\((.+?), đơn (.+)\\)$");
    /** PhieuChuyenKhoService.nhapTuTrungChuyen: hai dòng (trung chuyển xuất, kho nhận nhập), cùng câu, cuối câu là phiếu nhập. */
    private static final Pattern NHAN_DU = Pattern.compile("^Nhận đủ hàng của phiếu chuyển (\\S+) \\((\\S+)\\)$");
    private static final Pattern NHAN_PHAN_DAT = Pattern.compile("^Nhận phần đạt của phiếu chuyển (\\S+) \\(có chênh lệch\\) \\((\\S+)\\)$");
    private static final Pattern HOAN_TRA_CHUYEN = Pattern.compile("^Nhập hoàn trả: phiếu chuyển (\\S+) hủy khi đang vận chuyển \\((\\S+)\\)$");
    /** Luồng nhận chuyển kho cũ: mã trong câu là phiếu chuyển. */
    private static final Pattern NHAP_CHUYEN_CU = Pattern.compile("^Nhập chuyển kho từ yêu cầu: (\\S+)$");
    /** PhieuXuatKhoService: PX chuyển kho ghi thêm dòng nhập vào kho trung chuyển. */
    private static final Pattern DI_DUONG = Pattern.compile("^Hàng đang đi đường: (\\S+)$");
    private static final Pattern XUAT = Pattern.compile("^(Xuất chuyển kho|Xuất kho cho phiếu): (\\S+)(?: \\[Vận đơn: (.+)\\])?$");
    /** PosCheckoutTransaction. */
    private static final Pattern XUAT_POS = Pattern.compile("^Xuất kho POS: (\\S+)$");
    /** KiemKeDuyetService: đợt, mã kệ lúc chốt (có thể "null" ở dòng chưa biết kệ), phiếu điều chỉnh. */
    private static final Pattern KIEM_KE = Pattern.compile("^Kiểm kê (\\S+), kệ (.*) \\((\\S+)\\)$");
    /** PhieuChuyenKhoService: ghi giảm hàng thiếu, hỏng ở kho trung chuyển. */
    private static final Pattern CHENH_LECH = Pattern.compile("^Ghi giảm chênh lệch (\\S+) của phiếu chuyển (\\S+)$");
    /** Chữ PhieuNhapKhoService ghi khi lô chưa gắn kệ. */
    private static final String CHUA_GAN_KE = "Chưa gắn kệ";

    /**
     * Thêm chứng từ, việc làm ra dòng sổ và chứng từ liên quan. Phiếu tra theo loai_tham_chieu + id_tham_chieu (đúng cả khi
     * câu sổ đổi mẫu); câu sổ chỉ bổ sung những gì phiếu không giữ (kệ lúc nhập, mã vận đơn, phiếu trả hàng). Phiếu đã bị
     * xóa thì giữ mã đọc từ câu sổ, không có id nên giao diện hiện chữ, không mở được.
     */
    private void boSungChungTu(LichSuGiaoDichKho e, LichSuGiaoDichKhoDto dto) {
        String ghi = e.getGhiChu() == null ? "" : e.getGhiChu().trim();
        Integer id = e.getIdThamChieu();
        String loai = e.getLoaiThamChieu();
        boolean daTach = false;
        if ("phieu_nhap_kho".equals(loai)) {
            daTach = theoPhieuNhap(e, dto, ghi, id == null ? null : phieuNhapKhoRepository.findById(id).orElse(null));
        } else if ("phieu_xuat_kho".equals(loai)) {
            daTach = theoPhieuXuat(e, dto, ghi, id == null ? null : phieuXuatKhoRepository.findById(id).orElse(null));
        } else if ("phieu_dieu_chinh_kho".equals(loai)) {
            daTach = theoPhieuDieuChinh(e, dto, ghi, id == null ? null : phieuDieuChinhKhoRepository.findById(id).orElse(null));
        } else if ("phieu_chuyen_ke".equals(loai)) {
            PhieuChuyenKe mv = id == null ? null : phieuChuyenKeRepository.findById(id).orElse(null);
            if (mv != null) dto.setChungTu(chungTu("phieu_chuyen_ke", mv.getId(), mv.getMaPhieu(), mv.getKho(), null));
            else if (dto.getMaChungTu() != null) dto.setChungTu(chungTu("phieu_chuyen_ke", null, dto.getMaChungTu(), null, null));
            daTach = dto.getKeNguon() != null && dto.getKeDich() != null;
        }
        dto.setGhiChuDaTach(daTach || ghi.isEmpty());
    }

    private boolean theoPhieuNhap(LichSuGiaoDichKho e, LichSuGiaoDichKhoDto dto, String ghi, PhieuNhapKho pn) {
        String maTrongCau = null;
        String maPhieuChuyen = null;
        String nghiepVu = null;
        boolean daTach = true;
        Matcher m;
        if ((m = NHAP_NCC.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            nghiepVu = "nhap_ncc";
            if (m.group(2) != null) ganKe(dto, m.group(2).trim());
        } else if ((m = NHAP_TRA_VE.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            nghiepVu = "nhap_tra_ve";
        } else if ((m = KHACH_TRA.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            nghiepVu = "khach_tra_tai_quay";
            dto.setPhieuTraHang(m.group(2).trim());
            dto.setDonBanHang(donTheoSo(m.group(3).trim()));
        } else if ((m = NHAN_DU.matcher(ghi)).matches()) {
            maPhieuChuyen = m.group(1);
            maTrongCau = m.group(2);
            nghiepVu = "nhan_chuyen_kho";
        } else if ((m = NHAN_PHAN_DAT.matcher(ghi)).matches()) {
            maPhieuChuyen = m.group(1);
            maTrongCau = m.group(2);
            nghiepVu = "nhan_chuyen_kho_chenh_lech";
        } else if ((m = HOAN_TRA_CHUYEN.matcher(ghi)).matches()) {
            maPhieuChuyen = m.group(1);
            maTrongCau = m.group(2);
            nghiepVu = "hoan_tra_chuyen_kho";
        } else if ((m = NHAP_CHUYEN_CU.matcher(ghi)).matches()) {
            maPhieuChuyen = m.group(1);
            nghiepVu = "nhan_chuyen_kho";
        } else {
            daTach = false;
        }
        if (pn != null) {
            dto.setChungTu(chungTu("phieu_nhap", pn.getId(), pn.getSoPhieuNhap(), pn.getKho(), null));
            if (pn.getPhieuChuyenKho() != null) dto.setPhieuChuyenKho(phieuChuyen(pn.getPhieuChuyenKho()));
            // Câu "Nhập kho từ phiếu" của bản cũ: chỉ gọi là nhập từ nhà cung cấp khi phiếu có đơn mua thật
            if ("nhap_ncc".equals(nghiepVu) && pn.getDonMuaHang() == null) nghiepVu = null;
            // Bản cũ ghi "Nhập hoàn trả (Return)" cho mọi phiếu không đơn mua, kể cả phiếu nhận chuyển kho: xét theo phiếu chuyển
            if ("nhap_tra_ve".equals(nghiepVu) && pn.getPhieuChuyenKho() != null) nghiepVu = null;
            if (nghiepVu == null) {
                // Câu không theo mẫu nào: đoán theo phiếu
                if (pn.getPhieuChuyenKho() != null) {
                    nghiepVu = pn.getSoPhieuNhap() != null && pn.getSoPhieuNhap().startsWith(IChuyenKho.TIEN_TO_NHAP_HOAN_TRA)
                            ? "hoan_tra_chuyen_kho" : "nhan_chuyen_kho";
                } else if (pn.getDonMuaHang() != null) {
                    nghiepVu = "nhap_ncc";
                }
            }
        } else if (maTrongCau != null) {
            dto.setChungTu(chungTu("phieu_nhap", null, maTrongCau, null, null));
        }
        if (dto.getPhieuChuyenKho() == null && maPhieuChuyen != null) {
            dto.setPhieuChuyenKho(chungTu("phieu_chuyen_kho", null, maPhieuChuyen, null, null));
        }
        // nhapTuTrungChuyen ghi hai dòng cùng câu: dòng xuất ở kho trung chuyển là hàng rời trung chuyển, không phải "nhận hàng"
        if ("xuat_kho".equals(e.getLoaiGiaoDich()) && nghiepVu != null
                && (nghiepVu.startsWith("nhan_chuyen_kho") || "hoan_tra_chuyen_kho".equals(nghiepVu))) {
            nghiepVu = "roi_trung_chuyen";
        }
        dto.setNghiepVu(nghiepVu);
        return daTach;
    }

    private boolean theoPhieuXuat(LichSuGiaoDichKho e, LichSuGiaoDichKhoDto dto, String ghi, PhieuXuatKho px) {
        String maTrongCau = null;
        String nghiepVu = null;
        boolean daTach = true;
        Matcher m;
        if ((m = DI_DUONG.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            nghiepVu = "hang_di_duong";
        } else if ((m = XUAT.matcher(ghi)).matches()) {
            maTrongCau = m.group(2);
            nghiepVu = "Xuất chuyển kho".equals(m.group(1)) ? "xuat_chuyen_kho" : null;
            if (m.group(3) != null && !m.group(3).isBlank()) dto.setMaVanDon(m.group(3).trim());
        } else if ((m = XUAT_POS.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            nghiepVu = "ban_tai_quay";
        } else {
            daTach = false;
        }
        if (px != null) {
            dto.setChungTu(chungTu("phieu_xuat", px.getId(), px.getSoPhieuXuat(), px.getKho(), px.getKhoChuyenDen()));
            if (px.getPhieuChuyenKho() != null) dto.setPhieuChuyenKho(phieuChuyen(px.getPhieuChuyenKho()));
            if (px.getDonBanHang() != null) {
                dto.setDonBanHang(chungTu("don_ban", px.getDonBanHang().getId(), px.getDonBanHang().getSoDonHang(), null, null));
            }
            if (nghiepVu == null) {
                if ("chuyen_kho".equals(px.getLoaiXuat())) {
                    // PX chuyển kho ghi hai dòng: xuất ở kho gửi, nhập ở kho trung chuyển
                    nghiepVu = "nhap_kho".equals(e.getLoaiGiaoDich()) ? "hang_di_duong" : "xuat_chuyen_kho";
                } else if (px.getDonBanHang() != null) {
                    nghiepVu = "xuat_don_ban";
                }
            }
        } else if (maTrongCau != null) {
            dto.setChungTu(chungTu("phieu_xuat", null, maTrongCau, null, null));
        }
        dto.setNghiepVu(nghiepVu);
        return daTach;
    }

    private boolean theoPhieuDieuChinh(LichSuGiaoDichKho e, LichSuGiaoDichKhoDto dto, String ghi, PhieuDieuChinhKho dck) {
        String maTrongCau = null;
        String maDot = null;
        String maPhieuChuyen = null;
        String nghiepVu = null;
        boolean daTach = true;
        Matcher m;
        if ((m = KIEM_KE.matcher(ghi)).matches()) {
            maDot = m.group(1);
            maTrongCau = m.group(3);
            nghiepVu = "kiem_ke";
            String ke = m.group(2).trim();
            if (!ke.isEmpty() && !"null".equals(ke)) dto.setKe(theoMa(dto.getKhoId(), LichSuGiaoDichKhoDto.KeGiaoDich.chiMa(ke)));
        } else if ((m = CHENH_LECH.matcher(ghi)).matches()) {
            maTrongCau = m.group(1);
            maPhieuChuyen = m.group(2);
            nghiepVu = "chenh_lech_chuyen_kho";
        } else {
            daTach = false;
        }
        if (dck != null) {
            dto.setChungTu(chungTu("phieu_dieu_chinh", dck.getId(), dck.getSoPhieu(), dck.getKho(), null));
            DotKiemKe dot = dck.getDotKiemKe();
            if (dot != null) dto.setDotKiemKe(chungTu("dot_kiem_ke", dot.getId(), dot.getMaDotKiemKe(), dot.getKho(), null));
            if (dck.getPhieuChuyenKho() != null) dto.setPhieuChuyenKho(phieuChuyen(dck.getPhieuChuyenKho()));
            if (nghiepVu == null) {
                nghiepVu = dot != null ? "kiem_ke" : dck.getPhieuChuyenKho() != null ? "chenh_lech_chuyen_kho" : null;
            }
        } else if (maTrongCau != null) {
            dto.setChungTu(chungTu("phieu_dieu_chinh", null, maTrongCau, null, null));
        }
        if (dto.getDotKiemKe() == null && maDot != null) dto.setDotKiemKe(chungTu("dot_kiem_ke", null, maDot, null, null));
        if (dto.getPhieuChuyenKho() == null && maPhieuChuyen != null) {
            dto.setPhieuChuyenKho(chungTu("phieu_chuyen_kho", null, maPhieuChuyen, null, null));
        }
        dto.setNghiepVu(nghiepVu);
        return daTach;
    }

    /** Kệ ghi trong câu sổ lúc nhập: "Chưa gắn kệ" = hàng vào phần chưa có kệ. */
    private void ganKe(LichSuGiaoDichKhoDto dto, String ma) {
        if (ma.isEmpty()) return;
        if (CHUA_GAN_KE.equals(ma)) {
            dto.setChuaCoKe(true);
            return;
        }
        dto.setKe(dto.getKhoId() == null ? LichSuGiaoDichKhoDto.KeGiaoDich.chiMa(ma)
                : theoMa(dto.getKhoId(), LichSuGiaoDichKhoDto.KeGiaoDich.chiMa(ma)));
    }

    private LichSuGiaoDichKhoDto.ChungTuGiaoDich donTheoSo(String so) {
        return donBanHangRepository.findFirstBySoDonHangOrderByIdDesc(so)
                .map(d -> chungTu("don_ban", d.getId(), d.getSoDonHang(), null, null))
                .orElseGet(() -> chungTu("don_ban", null, so, null, null));
    }

    private static LichSuGiaoDichKhoDto.ChungTuGiaoDich phieuChuyen(PhieuChuyenKho p) {
        return chungTu("phieu_chuyen_kho", p.getId(), p.getSoPhieuChuyen(), p.getKhoXuat(), p.getKhoNhap());
    }

    private static LichSuGiaoDichKhoDto.ChungTuGiaoDich chungTu(String loai, Integer id, String ma, Kho kho, Kho khoNhan) {
        return new LichSuGiaoDichKhoDto.ChungTuGiaoDich(loai, id, ma,
                kho != null ? kho.getId() : null, khoNhan != null ? khoNhan.getId() : null);
    }

    /**
     * Dòng phiếu chuyển kệ ứng với dòng sổ: theo phiếu (id_tham_chieu) và lô. Một lô sang nhiều kệ đích thì có nhiều dòng;
     * ChuyenKeNoiBoService ghi dòng phiếu và dòng sổ xen kẽ trong cùng vòng lặp nên thứ tự id của hai bên trùng nhau.
     */
    private ChiTietPhieuChuyenKe timDongPhieu(LichSuGiaoDichKho e) {
        if (e.getIdThamChieu() == null || e.getLoHang() == null) return null;
        Integer loId = e.getLoHang().getId();
        List<ChiTietPhieuChuyenKe> ds = chiTietPhieuChuyenKeRepository.theoPhieuVaLo(e.getIdThamChieu(), loId);
        if (ds.size() <= 1) return ds.isEmpty() ? null : ds.get(0);
        List<Integer> soCungLo = repository.findByLoaiThamChieuAndIdThamChieuOrderByIdAsc(e.getLoaiThamChieu(), e.getIdThamChieu())
                .stream()
                .filter(x -> x.getLoHang() != null && loId.equals(x.getLoHang().getId()))
                .map(LichSuGiaoDichKho::getId)
                .toList();
        int viTri = soCungLo.indexOf(e.getId());
        return viTri >= 0 && soCungLo.size() == ds.size() ? ds.get(viTri) : null;
    }

    private static LichSuGiaoDichKhoDto.KeGiaoDich keCo(String maTrongSo, ViTriKho vt) {
        return new LichSuGiaoDichKhoDto.KeGiaoDich(maTrongSo,
                vt.getKhuVucKho() != null ? vt.getKhuVucKho().getTenKhuVuc() : null,
                vt.getDayKe(), vt.getHangKe(), vt.getTangKe());
    }

    /** Kệ đã bị xóa thì giữ nguyên mã đã ghi trong sổ. */
    private LichSuGiaoDichKhoDto.KeGiaoDich theoMa(Integer khoId, LichSuGiaoDichKhoDto.KeGiaoDich ke) {
        if (ke.getMa() == null) return ke;
        return viTriKhoRepository.findFirstByKho_IdAndMaViTriIgnoreCase(khoId, ke.getMa())
                .map(vt -> keCo(ke.getMa(), vt))
                .orElse(ke);
    }

    @Transactional
    public LichSuGiaoDichKho create(LichSuGiaoDichKho entity) {
        return repository.save(entity);
    }
}