/**
 * Làm phẳng cây danh mục quần áo thành mảng phẳng để nạp vào Select.
 * Dùng chung cho Add/Edit sản phẩm (di chuyển từ AddProductModal).
 */
export const flattenCategoryTree = (tree, level = 0) => {
    let flatList = [];
    if (!Array.isArray(tree)) return flatList;

    tree.forEach(node => {
        // CHỈ LẤY DANH MỤC CÓ TRẠNG THÁI BẰNG 1
        if (node.trangThai === 1) {
            // Tạo chuỗi thụt lề bằng Non-breaking space (\u00A0) để React/HTML không cắt mất
            const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(level);
            const prefix = level > 0 ? `${indent}└─ ` : "";

            flatList.push({
                id: node.id,
                tenDanhMuc: node.tenDanhMuc, // Tên gốc (dùng khi cần)
                displayTitle: `${prefix}${node.tenDanhMuc}`, // Tên hiển thị trong Dropdown có nhánh cây
                level: level
            });

            // Xử lý mảng danh mục con dựa theo DTO là "danhMucCons"
            if (node.danhMucCons && Array.isArray(node.danhMucCons) && node.danhMucCons.length > 0) {
                flatList = flatList.concat(flattenCategoryTree(node.danhMucCons, level + 1));
            }
        }
    });
    return flatList;
};
