/**
 * Tô phần khớp từ khóa tìm kiếm bằng <mark> (không phân biệt hoa thường, so theo tiếng Việt); không khớp thì trả
 * nguyên chữ. Dùng ở các bảng tìm theo tên / SKU / mã vạch (Sản phẩm theo sàn, Giá bán & tem mã vạch).
 */
export default function ToKhop({ text, tu }) {
  const chu = text ?? "";
  const vt = tu ? chu.toLocaleLowerCase("vi").indexOf(tu.toLocaleLowerCase("vi")) : -1;
  if (vt < 0) return chu;
  return (
    <>
      {chu.slice(0, vt)}
      <mark className="rounded-sm bg-amber-100 px-px text-inherit">{chu.slice(vt, vt + tu.length)}</mark>
      {chu.slice(vt + tu.length)}
    </>
  );
}
