# FS WMS Backoffice Design Contract

Baseline: the approved Admin Dashboard (`frontend/src/pages/dashboard/admin/DashboardAdmin.jsx`).

## Visual language

- Navy sidebar (`bo-sidebar` #182537, hover #243654) · white header (`bo-surface`) · light-gray canvas (`bo-canvas` #F4F6F8).
- White content surfaces (`SurfaceCard` / `TableShell`), neutral borders (`bo-border` #E1E6EC), blue primary actions (`bo-primary` #1677FF, hover #095FCC).
- Inter sans-serif (`font-backoffice`), compact density, radius 6–10px, `shadow-sm` only, subtle dividers.
- Forbidden: legacy gold grid/orbs/gradients, Playfair Display / DM Mono headings, ivory surfaces, heavy shadows, decorative animation, Sapo branding.

## Reusable components (always prefer these)

`components/backoffice/`: PageContainer, PageHeader · `components/shared/`: ListToolbar, SearchInput, TableShell, StatusBadge, EmptyState, LoadingState, ErrorState, SurfaceCard, FormSection, FormActions · `components/ui/`: existing shadcn primitives.

## Rules

- Tailwind utility classes ONLY.
- No inline `style={{...}}` — the single allowed exception is dynamic data-viz sizing (e.g. chart bar `height: pct%`), as in the approved Dashboard.
- No `<style>` blocks in JSX, no CDN Tailwind, no new framework/dependency, no Font Awesome, no dynamic partial Tailwind class names (complete static class maps).
- Tables scroll inside their card (`overflow-x-auto`); the page never scrolls horizontally; responsive at 390/768/1024/1280/1440.
- Loading / populated / empty / zero-data / no-result / error / retry / validation / submitting / confirmation / unauthorized states must each render deliberately; empty and zero states are valid data.
- Dropdowns: `DropdownMenuContent` sets its own surface classes (`rounded-lg border border-bo-border bg-white p-1 shadow-lg`). The legacy gold dropdown CSS has been removed from index.css, so do not add `backoffice-user-menu`.

## Logic-preservation contract (FROZEN)

Unchanged unless explicitly approved: backend code; API endpoints; HTTP methods; request payloads; response mapping; service method names; route paths and params; App.jsx route behavior; role values (`quan_tri_vien`, `quan_ly_kho`, `nhan_vien_kho`, `nhan_vien_mua_hang`, `nhan_vien_ban_hang`) and permissions; localStorage keys (`access_token`, `role`, `selected_kho_id`); sessionStorage behavior; auth flow; useEffect logic; state variables; form field names; validation rules; pagination/search/filter/sort parameters; navigation after actions; confirmation flows; print and barcode behavior; complete WMS workflows.

Files that must show zero diff at every gate: `frontend/src/App.jsx`, `frontend/src/services/**`, `backend/**`, `frontend/src/components/backoffice/sidebar.config.js`, `frontend/package.json`, `frontend/package-lock.json`. Also frozen: auth pages, storefront, supplier public pages, print pages, `components/ui/**` default variants, the reference template folder.

## Security note (documented, NOT part of this migration)

No ProtectedRoute exists and `apiClient.js` has no 401 redirect — role filtering is sidebar-only. Tracked as a separate security task.
