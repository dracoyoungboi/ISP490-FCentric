package com.dev.backend.constant.variables;

public interface IHanhDong {

    //Quyền hạn
    String
            cap_quyen = "cap_quyen",
            thu_hoi_quyen = "thu_hoi_quyen",
            cap_nhat_quyen = "cap_nhat_quyen",
            them_kho = "them_kho",
            xoa_kho = "xoa_kho",
            nang_cap_chuc_vu = "nang_cap_chuc_vu",
            // Một lần lưu ở ngăn kéo Phân quyền (vai trò + kho + tập quyền), giá trị cũ/mới là ảnh chụp JSON
            cap_nhat_phan_quyen = "cap_nhat_phan_quyen",
            cap_nhat_mau_quyen = "cap_nhat_mau_quyen";
    //Sản phẩm
    String
            cap_nhat_san_pham = "cap_nhat_san_pham",
            them_moi_san_pham = "them_moi_san_pham",
            xoa_san_pham = "xoa_san_pham",
            tao_pick_list = "tao_pick_list",
            phan_cong_nhat_hang = "phan_cong_nhat_hang",
            quet_barcode = "quet_barcode",
            hoan_tat_nhat_hang = "hoan_tat_nhat_hang",
            // Hủy phiếu nhặt (phiếu chuyển kho bị hủy khi đang / đã nhặt)
            huy_pick_list = "huy_pick_list",
            phan_bo_lo_nhat_hang = "phan_bo_lo_nhat_hang",
            sua_lo_phieu_xuat = "sua_lo_phieu_xuat",
            tao_lai_phieu_xuat = "tao_lai_phieu_xuat",
            quet_dong_goi = "quet_dong_goi",
            hoan_tat_dong_goi = "hoan_tat_dong_goi",
            // Đổi giá bán một biến thể (màn Giá bán & tem mã vạch, form Sửa sản phẩm): loai_tham_chieu = bien_the_san_pham,
            // gia_tri_cu / gia_tri_moi = {"giaBan":…}, ghi_chu = lý do
            doi_gia_ban = "doi_gia_ban";
    //Yêu cầu nhập hàng (ghi vào lich_su_thay_doi, ghi_chu = lý do từ chối)
    String
            duyet_yeu_cau_mua_hang = "duyet_yeu_cau_mua_hang",
            tu_choi_yeu_cau_mua_hang = "tu_choi_yeu_cau_mua_hang",
            nhap_kho = "nhap_kho",
            xuat_kho = "xuat_kho",
            cap_nhat_kenh_ban = "cap_nhat_kenh_ban",
            dong_bo_san_pham = "dong_bo_san_pham",
            dong_bo_ton_kho = "dong_bo_ton_kho",
            cap_nhat_cau_hinh = "cap_nhat_cau_hinh";
    //Chuyển kho nội bộ (lich_su_thay_doi.loai_tham_chieu = phieu_chuyen_kho, id_tham_chieu = id phiếu chuyển;
    //gia_tri_cu / gia_tri_moi = trạng thái, ghi_chu = lý do hoặc số chứng từ sinh ra)
    String
            tao_phieu_chuyen = "tao_phieu_chuyen",
            duyet_phieu_chuyen = "duyet_phieu_chuyen",
            // Phiếu nhặt của phiếu chuyển hoàn tất: lô đã nhặt ghi vào PX-CK, chờ xác nhận xuất (trạng thái không đổi)
            nhat_xong_chuyen_kho = "nhat_xong_chuyen_kho",
            huy_phieu_chuyen = "huy_phieu_chuyen",
            xuat_chuyen_kho = "xuat_chuyen_kho",
            ghi_so_xknb = "ghi_so_xknb",
            nhan_chuyen_kho = "nhan_chuyen_kho",
            lap_bien_ban_giao_nhan = "lap_bien_ban_giao_nhan",
            // Ảnh chụp đính kèm biên bản giao nhận (ghi_chu = số biên bản, mô tả ảnh)
            them_anh_bien_ban = "them_anh_bien_ban",
            xoa_anh_bien_ban = "xoa_anh_bien_ban",
            xu_ly_chenh_lech = "xu_ly_chenh_lech",
            nhap_hoan_tra = "nhap_hoan_tra";
    //Mẫu in: mỗi lần lưu một phiên bản (lich_su_thay_doi.loai_tham_chieu = cau_hinh_mau_in,
    //id_tham_chieu = id dòng cau_hinh_mau_in; gia_tri_cu / gia_tri_moi = ảnh chụp JSON cấu hình)
    String
            cap_nhat_mau_in = "cap_nhat_mau_in";
    //Bảo mật (NhatKyBaoMatService): loai_tham_chieu = nguoi_dung / cau_hinh_thanh_toan; không bao giờ ghi mật khẩu,
    //mã hay khóa, chỉ ghi việc gì đã xảy ra
    String
            dang_nhap = "dang_nhap",
            dang_nhap_that_bai = "dang_nhap_that_bai",
            tao_tai_khoan = "tao_tai_khoan",
            khoa_tai_khoan = "khoa_tai_khoan",
            mo_khoa_tai_khoan = "mo_khoa_tai_khoan",
            doi_mat_khau = "doi_mat_khau",
            dat_lai_mat_khau = "dat_lai_mat_khau",
            cap_nhat_khoa_thanh_toan = "cap_nhat_khoa_thanh_toan";

    /**
     * Nhật ký job dọn 90 ngày (AuditLogCleanupJob) KHÔNG xóa: phiên bản mẫu in (để khôi phục), lịch sử đổi giá bán và bản ghi bảo mật
     * (đăng nhập, khóa tài khoản, mật khẩu, đổi quyền / vai trò, đổi khóa thanh toán). Không đưa cap_nhat_kenh_ban
     * vào đây: hành động này còn ghi kết quả mỗi lần đồng bộ đơn từ sàn, giữ mãi thì bảng phình.
     */
    java.util.List<String> KHONG_TU_DON = java.util.List.of(
            cap_nhat_mau_in,
            // Lịch sử giá bán: ai đổi, khi nào, vì sao; màn Giá bán đọc lần đổi gần nhất từ đây
            doi_gia_ban,
            dang_nhap, dang_nhap_that_bai, tao_tai_khoan, khoa_tai_khoan, mo_khoa_tai_khoan, doi_mat_khau,
            dat_lai_mat_khau,
            cap_nhat_khoa_thanh_toan,
            cap_quyen, thu_hoi_quyen, cap_nhat_quyen, them_kho, xoa_kho, nang_cap_chuc_vu,
            cap_nhat_phan_quyen, cap_nhat_mau_quyen);
}
