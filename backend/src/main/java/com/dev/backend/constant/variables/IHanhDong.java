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
            // Đơn mua đã chốt kết thúc sớm (loai_tham_chieu = don_mua_hang, gia_tri_cu / gia_tri_moi = trạng thái,
            // ghi_chu = lý do bắt buộc): đóng khi nhà cung cấp giao thiếu (6), hủy khi chưa nhận gì (7)
            dong_don_mua_hang = "dong_don_mua_hang",
            huy_don_mua_hang = "huy_don_mua_hang",
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
            // Quản lý Kho tổng từ chối yêu cầu Chờ duyệt (phiếu sang Đã hủy, ghi_chu = lý do từ chối)
            tu_choi_phieu_chuyen = "tu_choi_phieu_chuyen",
            xuat_chuyen_kho = "xuat_chuyen_kho",
            ghi_so_xknb = "ghi_so_xknb",
            nhan_chuyen_kho = "nhan_chuyen_kho",
            lap_bien_ban_giao_nhan = "lap_bien_ban_giao_nhan",
            // Đại diện kho gửi xác nhận biên bản giao nhận (ghi_chu = số biên bản, ý kiến kho gửi; trạng thái không đổi)
            xac_nhan_bien_ban = "xac_nhan_bien_ban",
            // Ảnh chụp đính kèm biên bản giao nhận (ghi_chu = số biên bản, mô tả ảnh)
            them_anh_bien_ban = "them_anh_bien_ban",
            xoa_anh_bien_ban = "xoa_anh_bien_ban",
            xu_ly_chenh_lech = "xu_ly_chenh_lech",
            nhap_hoan_tra = "nhap_hoan_tra";
    //Mẫu in: mỗi lần lưu một phiên bản (lich_su_thay_doi.loai_tham_chieu = cau_hinh_mau_in,
    //id_tham_chieu = id dòng cau_hinh_mau_in; gia_tri_cu / gia_tri_moi = ảnh chụp JSON cấu hình)
    String
            cap_nhat_mau_in = "cap_nhat_mau_in";
    //Xuất dữ liệu kế toán: tạo lô (loai_tham_chieu = lo_xuat_ke_toan), mở khóa chứng từ (chung_tu_xuat_ke_toan,
    //ghi_chu = lý do), đổi cấu hình / thuế suất, nhập hóa đơn nhà cung cấp (hoa_don_dau_vao, id = phiếu nhập)
    String
            tao_lo_xuat_ke_toan = "tao_lo_xuat_ke_toan",
            mo_khoa_chung_tu_ke_toan = "mo_khoa_chung_tu_ke_toan",
            cap_nhat_cau_hinh_ke_toan = "cap_nhat_cau_hinh_ke_toan",
            cap_nhat_thue_suat = "cap_nhat_thue_suat",
            cap_nhat_hoa_don_dau_vao = "cap_nhat_hoa_don_dau_vao";
    //Tải tệp Excel của một báo cáo (XuatBaoCaoService): loai_tham_chieu = bao_cao, không có id tham chiếu;
    //gia_tri_moi = {"baoCao":…,"tenTep":…,"boLoc":{…}}, ghi_chu = tên báo cáo
    String
            xuat_bao_cao = "xuat_bao_cao";
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
            cap_nhat_khoa_thanh_toan = "cap_nhat_khoa_thanh_toan",
            // Quản trị viên sửa họ tên / email / SĐT tài khoản người khác (gia_tri_cu / gia_tri_moi = các trường đổi)
            sua_tai_khoan = "sua_tai_khoan";

    // ===== Nhật ký nghiệp vụ (NhatKyNghiepVu): gia_tri_cu / gia_tri_moi = JSON chỉ các trường đổi, ghi_chu = lý do =====
    // Theo BA (05/11) lịch sử thay đổi chỉ lưu cho danh mục dữ liệu (master data): người dùng, sản phẩm, giá bán, danh mục,
    // thuộc tính, nhà cung cấp, kho, vị trí kệ, khách hàng. Nhật ký chứng từ chỉ giữ các dòng có từ trước.
    //Nhà cung cấp (loai_tham_chieu = nha_cung_cap). Đổi MST thì ghi_chu bắt đầu "[Nhạy cảm]"
    String
            them_nha_cung_cap = "them_nha_cung_cap",
            sua_nha_cung_cap = "sua_nha_cung_cap",
            doi_trang_thai_nha_cung_cap = "doi_trang_thai_nha_cung_cap",
            xoa_nha_cung_cap = "xoa_nha_cung_cap";
    //Kho, vị trí kho, khách hàng, mã vạch nhà cung cấp (mã vạch ghi trên loai nha_cung_cap, id nhà cung cấp)
    String
            // Kho với tư cách danh mục (khác them_kho / xoa_kho ở trên: thêm / bớt kho trong phân quyền người dùng)
            tao_kho = "tao_kho",
            sua_kho = "sua_kho",
            doi_trang_thai_kho = "doi_trang_thai_kho",
            xoa_mem_kho = "xoa_mem_kho",
            tao_khu_vuc = "tao_khu_vuc",
            sua_khu_vuc = "sua_khu_vuc",
            xoa_khu_vuc = "xoa_khu_vuc",
            tao_vi_tri = "tao_vi_tri",
            sua_vi_tri = "sua_vi_tri",
            xoa_vi_tri = "xoa_vi_tri",
            luu_mat_bang = "luu_mat_bang",
            them_khach_hang = "them_khach_hang",
            sua_khach_hang = "sua_khach_hang",
            xoa_khach_hang = "xoa_khach_hang",
            them_ma_vach_ncc = "them_ma_vach_ncc",
            xoa_ma_vach_ncc = "xoa_ma_vach_ncc";
    //Danh mục chung (danh mục, thương hiệu, chất liệu, màu, size): loai_tham_chieu = tên bảng
    String
            them_danh_muc_chung = "them_danh_muc_chung",
            sua_danh_muc_chung = "sua_danh_muc_chung",
            xoa_danh_muc_chung = "xoa_danh_muc_chung";
    /**
     * Job dọn 90 ngày (AuditLogCleanupJob) CHỈ xóa các hành động trong danh sách này: ghi rất nhiều, giá trị truy vết
     * thấp (mỗi lần quét mã, mỗi lượt đồng bộ sàn). Mọi hành động khác giữ lại — chứng từ kế toán phải lưu tối thiểu 10
     * năm, tài liệu quản lý tối thiểu 5 năm (Luật Kế toán 2015, Điều 41), nên lịch sử duyệt / hủy / sửa không tự xóa.
     */
    java.util.List<String> DUOC_DON = java.util.List.of(
            quet_barcode, quet_dong_goi, dong_bo_san_pham, dong_bo_ton_kho, cap_nhat_kenh_ban);
}
