import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Thư viện giao diện shadcn sinh sẵn: giữ nguyên bản gốc (xuất kèm biến thể/hook cạnh component,
    // khung chờ tải độ rộng ngẫu nhiên), không sửa tay để còn cập nhật theo shadcn.
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    // Tệp cấu hình chạy trên Node, không chạy trên trình duyệt
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Thông báo nhanh: luôn gọi qua "@/lib/thongBaoNhanh" để dùng chung vị trí, thời gian, gộp trùng
    // (config/thongBaoNhanh.js). Chỉ hai file bọc thư viện được import thẳng sonner.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/lib/thongBaoNhanh.jsx', 'src/components/ui/sonner.jsx'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'sonner',
          message: 'Dùng toast từ "@/lib/thongBaoNhanh" để theo cấu hình thông báo chung (src/config/thongBaoNhanh.js).',
        }],
      }],
    },
  },
])
