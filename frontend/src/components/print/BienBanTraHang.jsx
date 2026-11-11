/* i18n-giu-nguyen-ca-tep: mẫu in chứng từ giữ tiếng Việt (biên bản giao khách, lưu quầy) */

const tien = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`;
const so = (v) => Number(v || 0).toLocaleString('vi-VN');
const ngayGio = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const LY_DO = {
  mac_chat: 'Khách mặc chật',
  mac_rong: 'Khách mặc rộng',
  khong_ung_mau_kieu: 'Không ưng màu/kiểu',
  loi_san_xuat: 'Lỗi kỹ thuật sản xuất',
  doi_y: 'Khách đổi ý',
  khac: 'Khác',
};
const NHOM_LOI = {
  rach_vai: 'Rách vải',
  hong_khoa: 'Hỏng khóa',
  o_ban: 'Ố bẩn',
  bung_chi: 'Bung chỉ, đường may',
  khac: 'Lỗi khác',
};

const o = { border: '1px solid #333', padding: '3px 5px', verticalAlign: 'top' };

/**
 * Một liên "Biên bản trả hàng / đổi hàng" (đặc tả BA bước 5.5): Liên 1 giao khách giữ, Liên 2 thu ngân kẹp cùng hóa
 * đơn gốc để đối soát. Khổ A5 dọc, chữ đen trắng cho máy in văn phòng / nhiệt khổ rộng.
 */
export default function BienBanTraHang({ phieu, lien }) {
  const hoanCk = phieu.phuongThucHoan === 'chuyen_khoan';
  return (
    <section style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#000', lineHeight: 1.35 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>FCENTRIC</div>
          <div>Chi nhánh xử lý: <b>{phieu.khoNhan}</b></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10 }}>
          <div><b>Liên {lien}</b>: {lien === 1 ? 'Giao khách hàng giữ' : 'Lưu quầy, kẹp hóa đơn gốc'}</div>
          <div>Ngày lập: {ngayGio(phieu.ngayTao)}</div>
        </div>
      </div>

      <h1 style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, margin: '10px 0 2px' }}>BIÊN BẢN TRẢ HÀNG / ĐỔI HÀNG</h1>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>Số: <b>{phieu.soPhieu}</b></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr><td style={{ width: '38%' }}>Đơn gốc:</td><td><b>{phieu.soDonHang}</b> (thanh toán {ngayGio(phieu.thanhToanLuc)})</td></tr>
          <tr><td>Nơi bán gốc:</td><td>{phieu.khoBan}{phieu.traCheo ? ' (trả chéo chi nhánh)' : ''}</td></tr>
          <tr><td>Phiếu nhập hàng trả lại:</td><td>{phieu.soPhieuNhap || '— (chỉ có hàng lỗi, không nhập kho)'}</td></tr>
          <tr><td>Khách hàng:</td><td>{phieu.khachHang || '—'}{phieu.soDienThoai ? ` · ${phieu.soDienThoai}` : ''}</td></tr>
          <tr><td>Thu ngân tiếp nhận:</td><td>{phieu.nguoiLap || '—'}</td></tr>
          <tr><td>Hình thức:</td><td>Trả hàng, hoàn tiền</td></tr>
          {phieu.quaHan ? (
            <tr><td>Duyệt quá hạn 03 ngày:</td><td>{phieu.nguoiDuyet || '—'}{phieu.lyDoDuyet ? ` — ${phieu.lyDoDuyet}` : ''}</td></tr>
          ) : null}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, margin: '6px 0 3px' }}>1. Danh sách sản phẩm thu hồi</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...o, textAlign: 'left' }}>Sản phẩm / SKU</th>
            <th style={{ ...o, width: 26 }}>SL</th>
            <th style={{ ...o, textAlign: 'left' }}>QC / Kệ</th>
            <th style={{ ...o, textAlign: 'right' }}>Hoàn trả</th>
          </tr>
        </thead>
        <tbody>
          {phieu.dong.map((d, i) => (
            <tr key={i}>
              <td style={o}>
                {d.tenSanPham}
                <div style={{ fontSize: 9 }}>{d.maSku}{d.mauSac || d.kichCo ? ` · ${[d.mauSac, d.kichCo].filter(Boolean).join(' / ')}` : ''}</div>
                <div style={{ fontSize: 9 }}>Lý do: {LY_DO[d.lyDo] || d.lyDo}</div>
              </td>
              <td style={{ ...o, textAlign: 'center' }}>{so(d.soLuong)}</td>
              <td style={o}>
                {d.tinhTrang === 'dat' ? 'Đạt' : 'Lỗi'}
                <div style={{ fontSize: 9 }}>{d.tinhTrang === 'dat' ? (d.ke ? `Kệ ${d.ke}` : 'Chưa có kệ') : (NHOM_LOI[d.nhomLoi] || 'Để riêng')}</div>
              </td>
              <td style={{ ...o, textAlign: 'right' }}>
                {tien(d.thanhTienHoan)}
                <div style={{ fontSize: 9 }}>{tien(d.donGiaHoan)} / cái</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          <tr><td>Tổng số lượng trả lại:</td><td style={{ textAlign: 'right' }}>{so(phieu.tongSoLuong)} (Đạt {so(phieu.soLuongDat)} · Lỗi {so(phieu.soLuongLoi)})</td></tr>
          <tr><td style={{ fontWeight: 700, fontSize: 12 }}>TỔNG TIỀN HOÀN KHÁCH:</td><td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{tien(phieu.tongTienHoan)}</td></tr>
          <tr>
            <td>Phương thức:</td>
            <td style={{ textAlign: 'right' }}>
              {hoanCk ? `Chuyển khoản — ${phieu.nganHang || ''} ${phieu.soTaiKhoan || ''}`.trim() : 'Tiền mặt tại quầy'}
            </td>
          </tr>
          {hoanCk ? (
            <>
              <tr><td>Chủ tài khoản:</td><td style={{ textAlign: 'right' }}>{phieu.tenChuTaiKhoan}</td></tr>
              <tr><td>Mã giao dịch:</td><td style={{ textAlign: 'right' }}>{phieu.maGiaoDich}</td></tr>
            </>
          ) : null}
        </tbody>
      </table>
      {phieu.ghiChu ? <div style={{ marginTop: 6 }}>Ghi chú: {phieu.ghiChu}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, textAlign: 'center' }}>
        <div style={{ width: '48%' }}>
          <b>KHÁCH HÀNG</b>
          <div style={{ fontSize: 9 }}>(Ký và ghi rõ họ tên)</div>
          <div style={{ height: 48 }} />
        </div>
        <div style={{ width: '48%' }}>
          <b>THU NGÂN TIẾP NHẬN</b>
          <div style={{ fontSize: 9 }}>(Ký và ghi rõ họ tên)</div>
          <div style={{ height: 48 }} />
        </div>
      </div>
    </section>
  );
}
