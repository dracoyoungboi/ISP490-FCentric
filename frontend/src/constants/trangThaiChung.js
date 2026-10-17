/**
 * Nhãn cho mã trạng thái không có trong bảng tên của loại chứng từ (dữ liệu cũ, dữ liệu ghi từ phiên bản
 * khác hoặc sửa tay trong CSDL). Hiện rõ mã để biết cần bổ sung tên nào, thay vì "—" hoặc mượn tên
 * của trạng thái khác (vd. coi như "Nháp").
 */
export function trangThaiLa(trangThai) {
    if (trangThai === null || trangThai === undefined || trangThai === "") {
        return { label: "Chưa có trạng thái" };
    }
    return { label: `Không xác định (mã ${trangThai})` };
}
