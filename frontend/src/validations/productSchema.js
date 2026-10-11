import * as yup from "yup";

/**
 * Validation schema for Product Variant (Biến thể sản phẩm)
 */
export const productVariantSchema = yup.object().shape({
    mauSacId: yup
        .number()
        .required("Vui lòng chọn màu sắc")
        .positive("Màu sắc không hợp lệ"),
    sizeId: yup
        .number()
        .required("Vui lòng chọn kích cỡ")
        .positive("Kích cỡ không hợp lệ"),
    chatLieuId: yup
        .number()
        .required("Vui lòng chọn chất liệu")
        .positive("Chất liệu không hợp lệ"),
    maSku: yup
        .string()
        .required("Vui lòng nhập mã SKU")
        .min(3, "Mã SKU phải có ít nhất 3 ký tự")
        .max(50, "Mã SKU không được quá 50 ký tự"),
    maVachSku: yup
        .string()
        .max(100, "Mã vạch SKU không được quá 100 ký tự"),
    giaVon: yup
        .number()
        .required("Vui lòng nhập giá vốn")
        .min(0, "Giá vốn phải lớn hơn hoặc bằng 0"),
    giaBan: yup
        .number()
        .required("Vui lòng nhập giá bán")
        .min(0, "Giá bán phải lớn hơn 0")
        .test(
            'is-greater-than-cost',
            'Giá bán phải lớn hơn giá vốn',
            function (value) {
                const { giaVon } = this.parent;
                return !giaVon || !value || value >= giaVon;
            }
        ),
    trangThai: yup
        .number()
        .oneOf([0, 1], "Trạng thái không hợp lệ")
        .default(1),
});

export const productSchema = yup.object().shape({
    tenSanPham: yup
        .string()
        .required("Vui lòng nhập tên sản phẩm")
        .min(3, "Tên sản phẩm phải có ít nhất 3 ký tự")
        .max(255, "Tên sản phẩm không được quá 255 ký tự"),
    maSanPham: yup
        .string()
        .max(50, "Mã sản phẩm không được quá 50 ký tự"),
    maVach: yup
        .string()
        .max(100, "Mã vạch không được quá 100 ký tự"),
    moTa: yup
        .string()
        .max(5000, "Mô tả không được quá 5000 ký tự"),
    giaVonMacDinh: yup
        .number()
        .min(0, "Giá vốn phải lớn hơn hoặc bằng 0")
        .default(0),
    giaBanMacDinh: yup
        .number()
        .required("Vui lòng nhập giá bán mặc định")
        .min(0, "Giá bán phải lớn hơn 0")
        .test(
            'is-greater-than-default-cost',
            'Giá bán phải lớn hơn giá vốn',
            function (value) {
                const { giaVonMacDinh } = this.parent;
                return !giaVonMacDinh || !value || value >= giaVonMacDinh;
            }
        ),
    mucTonToiThieu: yup
        .number()
        .min(0, "Mức tồn tối thiểu phải lớn hơn hoặc bằng 0")
        .default(0),
    trangThai: yup
        .number()
        .oneOf([0, 1], "Trạng thái không hợp lệ")
        .default(1),
    // bienTheSanPhams: yup
    //     .array()
    //     .of(productVariantSchema)
    //     .min(1, "Phải có ít nhất 1 biến thể sản phẩm"),
    anhSanPhams: yup
        .mixed()
        .test('fileSize', 'Mỗi ảnh không được quá 5MB', (files) => {
            if (!files || files.length === 0) return true;
            return Array.from(files).every(file => file.size <= 5 * 1024 * 1024);
        })
        .test('fileType', 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)', (files) => {
            if (!files || files.length === 0) return true;
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            return Array.from(files).every(file => validTypes.includes(file.type));
        }),
    anhBienThes: yup
        .mixed()
        .test('fileSize', 'Mỗi ảnh không được quá 5MB', (files) => {
            if (!files || files.length === 0) return true;
            return Array.from(files).every(file => file.size <= 5 * 1024 * 1024);
        })
        .test('fileType', 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)', (files) => {
            if (!files || files.length === 0) return true;
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            return Array.from(files).every(file => validTypes.includes(file.type));
        }),
});
