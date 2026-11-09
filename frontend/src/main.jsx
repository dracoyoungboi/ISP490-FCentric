import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { batTheoDoiCamUng } from './lib/camUng'
import { khoiDongNgonNgu, t } from './i18n'

batTheoDoiCamUng()

const goc = createRoot(document.getElementById('root'))

// Nạp ngôn ngữ TRƯỚC khi nạp ứng dụng: các hằng số gọi t() ở cấp module phải thấy đúng ngôn ngữ
// (tiếng Việt khởi tạo tức thì, không tải tệp dịch nào)
khoiDongNgonNgu()
  .then(() => import('./App.jsx'))
  .then((moDun) => {
    const App = moDun.default
    goc.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((loi) => {
    // Không tải được mã ứng dụng (mạng chập chờn, bản mới vừa triển khai): báo và cho tải lại, không để trang trắng
    console.error('Không tải được ứng dụng:', loi)
    goc.render(
      <div role="alert" style={{ padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <p style={{ marginBottom: 12 }}>{t('Không tải được ứng dụng. Kiểm tra mạng rồi tải lại trang.')}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '6px 14px', cursor: 'pointer' }}>
          {t('Tải lại')}
        </button>
      </div>,
    )
  })
