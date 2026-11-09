import apiClient from './apiClient';
import { t } from "@/i18n";

const purchaseOrderCreateService = {
    /**
     * Lấy danh sách tất cả nhà cung cấp
     * @returns Promise<ResponseData<List<NhaCungCap>>>
     */
    getAllSuppliers: async () => {
        try {
            // Sử dụng endpoint từ supplierService.js
            const response = await apiClient.get('/api/supplier');
            return response.data; // Giả sử trả về { data: [...] } hoặc tương tự
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            throw error;
        }
    },

    /**
     * Lấy danh sách biến thể sản phẩm (flatten từ danh sách sản phẩm)
     * @returns Promise<Array<BienTheSanPhamDisplay>>
     */
    getAllProductVariants: async () => {
        try {
            // Sử dụng endpoint filter sản phẩm để lấy tất cả sản phẩm và biến thể
            const response = await apiClient.post('/api/v1/san-pham-quan-ao/filter', {
                page: 0,
                size: 1000,
                filters: [],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }]
            });

            const products = response.data?.data?.content || [];
            const variants = [];

            products.forEach(product => {
                if (product.bienTheSanPhams && product.bienTheSanPhams.length > 0) {
                    product.bienTheSanPhams.forEach(variant => {
                        // Format thuộc tính: Màu - Size - Chất liệu
                        const attributes = [
                            variant.mauSac?.tenMau,
                            variant.size?.tenSize,
                            variant.chatLieu?.tenChatLieu
                        ].filter(Boolean).join(' - ');

                        variants.push({
                            id: variant.id,
                            maBienThe: variant.maSku,
                            tenSanPham: product.tenSanPham,
                            thuocTinh: attributes,
                            donViTinh: t("Cái"), // Mặc định hoặc lấy từ DB nếu có
                            tonKho: 0, // Cần bổ sung logic lấy tồn kho nếu có API
                            giaVon: variant.giaVon,
                            giaBan: variant.giaBan,
                            anhBienThe: variant.anhBienThe,
                            productImage: product.anhQuanAos?.[0]?.urlAnh,
                            // Giữ lại full object nếu cần
                            originalVariant: variant
                        });
                    });
                }
            });

            // Trả về structure giống API response để frontend dễ xử lý
            return {
                data: variants
            };

        } catch (error) {
            console.error('Error fetching product variants:', error);
            throw error;
        }
    },

    /**
     * Tạo mới đơn mua hàng
     * @param {Object} creating - Dữ liệu đơn mua hàng cần tạo
     * @param {number} khoId - ID của kho
     * @returns Promise<ResponseData<DonMuaHangDto>>
     */
    create: async (creating, khoId) => {
        console.log('Creating purchase order:', creating);
        console.log('Kho ID:', khoId);
        try {
            const response = await apiClient.post(
                '/api/v1/nghiep-vu/don-mua-hang/create',
                creating,
                {
                    headers: {
                        'kho_id': khoId  // ✅ Thêm kho_id vào header
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error creating purchase order:', error);
            throw error;
        }
    }
};


export default purchaseOrderCreateService;