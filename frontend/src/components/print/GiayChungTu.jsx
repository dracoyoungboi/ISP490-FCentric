import { dauCongTy } from "@/components/chuyen-kho/inChuyenKho";

/*
 * Khung giấy dùng chung của các chứng từ in bố cục cố định (chuyển kho nội bộ, kiểm kê): chữ đen trên nền trắng, phông có
 * chân như chứng từ kế toán. Không dùng thẻ <header>/<footer> vì print.css ẩn hai thẻ đó khi in. Bọc nội dung trong
 * `<div className="giay-ct"><style>{CSS_GIAY}</style>…</div>`.
 */
export const CSS_GIAY = `
.giay-ct{position:relative;color:#111;font:13.5px/1.45 "Times New Roman",Times,"Liberation Serif",serif}
.giay-ct .dau-giay{display:flex;justify-content:space-between;gap:20px;font-size:12.5px}
.giay-ct .dau-giay b{font-size:13px}
.giay-ct .ten-giay{text-align:center;margin:22px 0 4px;font-size:18px;font-weight:700;letter-spacing:.02em}
.giay-ct .ngay-giay{text-align:center;font-style:italic;margin-bottom:16px}
.giay-ct p{margin:3px 0}
.giay-ct table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12.5px}
.giay-ct th,.giay-ct td{border:1px solid #333;padding:4px 6px;vertical-align:top}
.giay-ct th{font-weight:700;text-align:center}
.giay-ct td.r{text-align:right;white-space:nowrap}
.giay-ct td.c{text-align:center}
.giay-ct tr{break-inside:avoid}
.giay-ct .ky{display:grid;gap:8px;margin-top:22px;text-align:center;font-size:12.5px;break-inside:avoid}
.giay-ct .ky b{display:block}
.giay-ct .ky i{display:block;font-size:11.5px}
.giay-ct .ky .ten-ky{margin-top:62px;font-weight:700;min-height:1.45em}
.giay-ct .chan-giay{margin-top:28px;font-size:11.5px;font-style:italic;color:#333;border-top:1px solid #999;padding-top:8px}
.giay-ct .dau-dong{position:absolute;right:0;top:64px;border:2px solid #c2410c;color:#c2410c;padding:4px 10px;font:700 13px Inter,Arial,sans-serif;transform:rotate(-6deg);letter-spacing:.04em;background:rgba(255,255,255,.8)}
`;

/** Đầu giấy: tên đăng ký, mã số thuế, địa chỉ của công ty (bên trái) và số chứng từ (bên phải). */
export function DauGiay({ hoSo, children }) {
  const cty = dauCongTy(hoSo);
  return (
    <div className="dau-giay">
      <div>
        <b>{cty.ten}</b>
        <br />
        Mã số thuế: {cty.maSoThue}
        <br />
        Địa chỉ: {cty.diaChi}
      </div>
      <div style={{ textAlign: "right" }}>{children}</div>
    </div>
  );
}

export function TenGiay({ ten, ngay }) {
  return (
    <>
      <div className="ten-giay">{ten}</div>
      <div className="ngay-giay">{ngay}</div>
    </>
  );
}

/**
 * Ô ký: mỗi cột `[chức danh, tên, dòng nhắc, dòng dưới tên]`; dòng nhắc mặc định "(Ký, ghi rõ họ tên)". Ô xác nhận trên
 * F Centric (kho gửi của biên bản giao nhận) ghi "(Xác nhận trên hệ thống)" và giờ xác nhận dưới tên.
 */
export function Ky({ cot }) {
  return (
    <div className="ky" style={{ gridTemplateColumns: `repeat(${cot.length}, 1fr)` }}>
      {cot.map(([chucDanh, ten, nhac = "(Ký, ghi rõ họ tên)", duoiTen]) => (
        <div key={chucDanh}>
          <b>{chucDanh}</b>
          <i>{nhac}</i>
          <div className="ten-ky">{ten || ""}</div>
          {duoiTen ? <i>{duoiTen}</i> : null}
        </div>
      ))}
    </div>
  );
}
