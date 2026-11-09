import * as yup from "yup";
import { t } from "@/i18n";

/**
 * Validation schema for Product Variant (Biến thể sản phẩm)
 */
export const productVariantSchema = yup.object().shape({
    mauSacId: yup
        .number()
        .required(t("Vui lòng chọn màu sắc"))
        .positive(t("Màu sắc không hợp lệ")),
    sizeId: yup
        .number()
        .required(t("Vui lòng chọn kích cỡ"))
        .positive(t("Kích cỡ không hợp lệ")),
    chatLieuId: yup
        .number()
        .required(t("Vui lòng chọn chất liệu"))
        .positive(t("Chất liệu không hợp lệ")),
    maSku: yup
        .string()
        .required(t("Vui lòng nhập mã SKU"))
        .min(3, t("Mã SKU phải có ít nhất 3 ký tự"))
        .max(50, t("Mã SKU không được quá 50 ký tự")),
    maVachSku: yup
        .string()
        .max(100, t("Mã vạch SKU không được quá 100 ký tự")),
    giaVon: yup
        .number()
        .required(t("Vui lòng nhập giá vốn"))
        .min(0, t("Giá vốn phải lớn hơn hoặc bằng 0")),
    giaBan: yup
        .number()
        .required(t("Vui lòng nhập giá bán"))
        .min(0, t("Giá bán phải lớn hơn 0"))
        .test(
            'is-greater-than-cost',
            t('Giá bán phải lớn hơn giá vốn'),
            function (value) {
                const { giaVon } = this.parent;
                return !giaVon || !value || value >= giaVon;
            }
        ),
    trangThai: yup
        .number()
        .oneOf([0, 1], t("Trạng thái không hợp lệ"))
        .default(1),
});

export const productSchema = yup.object().shape({
    tenSanPham: yup
        .string()
        .required(t("Vui lòng nhập tên sản phẩm"))
        .min(3, t("Tên sản phẩm phải có ít nhất 3 ký tự"))
        .max(255, t("Tên sản phẩm không được quá 255 ký tự")),
    maSanPham: yup
        .string()
        .max(50, t("Mã sản phẩm không được quá 50 ký tự")),
    maVach: yup
        .string()
        .max(100, t("Mã vạch không được quá 100 ký tự")),
    moTa: yup
        .string()
        .max(5000, t("Mô tả không được quá 5000 ký tự")),
    giaVonMacDinh: yup
        .number()
        .min(0, t("Giá vốn phải lớn hơn hoặc bằng 0"))
        .default(0),
    giaBanMacDinh: yup
        .number()
        .required(t("Vui lòng nhập giá bán mặc định"))
        .min(0, t("Giá bán phải lớn hơn 0"))
        .test(
            'is-greater-than-default-cost',
            t('Giá bán phải lớn hơn giá vốn'),
            function (value) {
                const { giaVonMacDinh } = this.parent;
                return !giaVonMacDinh || !value || value >= giaVonMacDinh;
            }
        ),
    mucTonToiThieu: yup
        .number()
        .min(0, t("Mức tồn tối thiểu phải lớn hơn hoặc bằng 0"))
        .default(0),
    trangThai: yup
        .number()
        .oneOf([0, 1], t("Trạng thái không hợp lệ"))
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
