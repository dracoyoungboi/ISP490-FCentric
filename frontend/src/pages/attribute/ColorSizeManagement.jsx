// src/pages/attributes/ColorSizeManagement.jsx
import { useCallback, useEffect, useState } from 'react';
import {
    ChevronLeft, ChevronRight, Eye, Palette, Pencil, Plus,
    RefreshCcw, Ruler, Trash2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmModal from "@/components/ui/confirm-modal";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import { mauSacService, sizeService } from "@/services/attributeService";
import { toast } from "@/lib/thongBaoNhanh";

const PaginationBar = ({ page, totalPages, total, pageSize, onPageChange }) => (
    <div className="flex flex-col gap-3 rounded-lg border border-bo-border bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-bo-muted">
            Displaying {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={page === 0}
                onClick={() => onPageChange(page - 1)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border bg-white text-bo-foreground transition-colors hover:bg-bo-surface-subtle disabled:opacity-40"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="px-3 font-mono text-xs font-bold text-bo-foreground">{page + 1} / {totalPages}</span>
            <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => onPageChange(page + 1)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border bg-white text-bo-foreground transition-colors hover:bg-bo-surface-subtle disabled:opacity-40"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    </div>
);

const ColorSizeManagement = () => {
    const [activeTab, setActiveTab] = useState('color');
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [colorSearch, setColorSearch] = useState('');
    const [sizeSearch, setSizeSearch] = useState('');

    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [totalColors, setTotalColors] = useState(0);
    const [totalSizes, setTotalSizes] = useState(0);
    const [colorPage, setColorPage] = useState(0);
    const [colorLimit] = useState(10);
    const [sizePage, setSizePage] = useState(0);
    const [sizeLimit] = useState(10);
    const [loadingColor, setLoadingColor] = useState(false);
    const [loadingSize, setLoadingSize] = useState(false);

    const [formData, setFormData] = useState({
        tenMau: '', maMau: '', maMauHex: '#000000',
        maSize: '', tenSize: '', loaiSize: '', thuTuSapXep: '', moTa: '',
    });

    const fetchColors = useCallback(async () => {
        setLoadingColor(true);
        try {
            const res = await mauSacService.filter({ page: colorPage, size: colorLimit, filters: [] });
            if (res.status === 200) {
                setColors(res.data.content);
                setTotalColors(res.data.totalElements);
            }
        } catch { toast.error("Không thể tải danh sách màu"); }
        finally { setLoadingColor(false); }
    }, [colorPage, colorLimit]);

    const fetchSizes = useCallback(async () => {
        setLoadingSize(true);
        try {
            const res = await sizeService.filter({ page: sizePage, size: sizeLimit, filters: [] });
            if (res.status === 200) {
                setSizes(res.data.content);
                setTotalSizes(res.data.totalElements);
            }
        } catch { toast.error("Không thể tải danh sách size"); }
        finally { setLoadingSize(false); }
    }, [sizePage, sizeLimit]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn tải lại ngay mỗi khi trang đổi.
    useEffect(() => { queueMicrotask(() => fetchColors()); }, [fetchColors]);
    useEffect(() => { queueMicrotask(() => fetchSizes()); }, [fetchSizes]);

    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        if (item) {
            setFormData(activeTab === 'color'
                ? { tenMau: item.tenMau, maMau: item.maMau || '', maMauHex: item.maMauHex || '#000000' }
                : { maSize: item.maSize || '', tenSize: item.tenSize || '', loaiSize: item.loaiSize || '', thuTuSapXep: item.thuTuSapXep || '', moTa: item.moTa || '' }
            );
        } else {
            setFormData(activeTab === 'color'
                ? { tenMau: '', maMau: '', maMauHex: '#000000' }
                : { maSize: '', tenSize: '', loaiSize: '', thuTuSapXep: '', moTa: '' }
            );
        }
        setShowModal(true);
    };

    const handleSubmit = async () => {
        try {
            let res;
            if (activeTab === 'color') {
                res = modalMode === 'add' ? await mauSacService.create(formData) : await mauSacService.update({ id: selectedItem.id, ...formData });
            } else {
                res = modalMode === 'add' ? await sizeService.create(formData) : await sizeService.update({ id: selectedItem.id, ...formData });
            }
            if (res.status === 200) {
                toast.success(modalMode === 'add' ? "Thêm mới thành công" : "Cập nhật thành công");
                activeTab === 'color' ? fetchColors() : fetchSizes();
                setShowModal(false);
            }
        } catch { toast.error("Có lỗi xảy ra"); }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = activeTab === 'color' ? await mauSacService.delete(deleteTarget.id) : await sizeService.delete(deleteTarget.id);
            if (res.status === 200) {
                toast.success("Xóa thành công");
                activeTab === 'color' ? fetchColors() : fetchSizes();
            }
        } catch { toast.error("Có lỗi xảy ra khi xóa"); }
        finally { setIsDeleting(false); setDeleteTarget(null); }
    };

    const filteredColors = colors.filter(c => !colorSearch.trim() || c.tenMau?.toLowerCase().includes(colorSearch.toLowerCase()) || c.maMau?.toLowerCase().includes(colorSearch.toLowerCase()));
    const filteredSizes = sizes.filter(s => !sizeSearch.trim() || s.tenSize?.toLowerCase().includes(sizeSearch.toLowerCase()) || s.maSize?.toLowerCase().includes(sizeSearch.toLowerCase()));

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                title="Danh mục thuộc tính"
                description="Quản lý màu sắc và kích cỡ dùng trong hệ thống"
                actions={
                    <Button
                        onClick={() => handleOpenModal('add')}
                        className="h-9 gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <Plus size={18} /> Thêm {activeTab === 'color' ? 'màu' : 'size'} mới
                    </Button>
                }
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="h-auto w-fit flex-wrap items-center justify-start gap-1 rounded-lg border border-bo-border bg-bo-surface-subtle p-1">
                    <TabsTrigger
                        value="color"
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-bo-muted data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
                    >
                        <Palette size={14} className="mr-2" />Màu sắc
                    </TabsTrigger>
                    <TabsTrigger
                        value="size"
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-bo-muted data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
                    >
                        <Ruler size={14} className="mr-2" />Kích cỡ
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="color" className="mt-5 space-y-5">
                    <SurfaceCard>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex flex-1 flex-col gap-2">
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Search colors</Label>
                                <SearchInput
                                    value={colorSearch}
                                    onChange={e => setColorSearch(e.target.value)}
                                    onClear={() => setColorSearch('')}
                                    placeholder="Mã hoặc tên màu..."
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setColorSearch('')}
                                className="h-9 shrink-0 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <RefreshCcw size={16} /> Reset
                            </Button>
                        </div>
                    </SurfaceCard>

                    {loadingColor ? (
                        <SurfaceCard contentClassName="p-0 sm:p-0">
                            <LoadingState rows={5} />
                        </SurfaceCard>
                    ) : (
                        <TableShell>
                            <table className="w-full min-w-[720px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className="h-11 w-16 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã màu</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tên màu</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">HEX Code</th>
                                        <th className="h-11 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {filteredColors.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6">
                                                <EmptyState
                                                    icon={Palette}
                                                    title="Không có màu sắc nào"
                                                    description="Chưa có dữ liệu phù hợp để hiển thị."
                                                    className="min-h-0 py-8"
                                                />
                                            </td>
                                        </tr>
                                    ) : filteredColors.map((c, i) => (
                                        <tr key={c.id} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-3 py-3 text-center font-mono text-xs text-bo-muted">{colorPage * colorLimit + i + 1}</td>
                                            <td className="px-3 py-3"><span className="font-mono font-semibold text-bo-primary">{c.maMau}</span></td>
                                            <td className="px-3 py-3 font-semibold text-bo-foreground">{c.tenMau}</td>
                                            <td className="px-3 py-3">
                                                <span className="inline-flex items-center rounded-md border border-bo-border bg-bo-surface-subtle px-2 py-0.5 font-mono text-xs text-bo-foreground">
                                                    {c.maMauHex || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="Xem chi tiết"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                        onClick={() => handleOpenModal('view', c)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Chỉnh sửa"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                        onClick={() => handleOpenModal('edit', c)}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Xóa"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-danger hover:text-bo-danger"
                                                        onClick={() => setDeleteTarget(c)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableShell>
                    )}
                    {totalColors > 0 && <PaginationBar page={colorPage} totalPages={Math.ceil(totalColors/colorLimit)} total={totalColors} pageSize={colorLimit} onPageChange={setColorPage} />}
                </TabsContent>

                <TabsContent value="size" className="mt-5 space-y-5">
                    <SurfaceCard>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex flex-1 flex-col gap-2">
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Search sizes</Label>
                                <SearchInput
                                    value={sizeSearch}
                                    onChange={e => setSizeSearch(e.target.value)}
                                    onClear={() => setSizeSearch('')}
                                    placeholder="Mã hoặc tên size..."
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setSizeSearch('')}
                                className="h-9 shrink-0 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <RefreshCcw size={16} /> Reset
                            </Button>
                        </div>
                    </SurfaceCard>

                    {loadingSize ? (
                        <SurfaceCard contentClassName="p-0 sm:p-0">
                            <LoadingState rows={5} />
                        </SurfaceCard>
                    ) : (
                        <TableShell>
                            <table className="w-full min-w-[720px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className="h-11 w-16 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã size</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tên size</th>
                                        <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Phân loại</th>
                                        <th className="h-11 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {filteredSizes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6">
                                                <EmptyState
                                                    icon={Ruler}
                                                    title="Không có kích cỡ nào"
                                                    description="Chưa có dữ liệu phù hợp để hiển thị."
                                                    className="min-h-0 py-8"
                                                />
                                            </td>
                                        </tr>
                                    ) : filteredSizes.map((s, i) => (
                                        <tr key={s.id} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-3 py-3 text-center font-mono text-xs text-bo-muted">{sizePage * sizeLimit + i + 1}</td>
                                            <td className="px-3 py-3"><span className="font-mono font-semibold text-bo-primary">{s.maSize}</span></td>
                                            <td className="px-3 py-3 font-semibold text-bo-foreground">{s.tenSize}</td>
                                            <td className="px-3 py-3 text-xs text-bo-muted">{s.loaiSize || '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="Xem chi tiết"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                        onClick={() => handleOpenModal('view', s)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Chỉnh sửa"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                        onClick={() => handleOpenModal('edit', s)}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Xóa"
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-danger hover:text-bo-danger"
                                                        onClick={() => setDeleteTarget(s)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableShell>
                    )}
                    {totalSizes > 0 && <PaginationBar page={sizePage} totalPages={Math.ceil(totalSizes/sizeLimit)} total={totalSizes} pageSize={sizeLimit} onPageChange={setSizePage} />}
                </TabsContent>
            </Tabs>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-bo-foreground">
                            {modalMode === 'add' ? 'Thêm mới' : modalMode === 'edit' ? 'Cập nhật' : 'Chi tiết'}{' '}
                            <span className="text-bo-primary">{activeTab === 'color' ? 'màu' : 'size'}</span>
                        </DialogTitle>
                        <DialogDescription className="sr-only">Biểu mẫu thông tin thuộc tính</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {activeTab === 'color' ? (
                            <>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Account Name</Label>
                                    <Input
                                        disabled={modalMode === 'view'}
                                        value={formData.tenMau}
                                        onChange={e => setFormData({...formData, tenMau: e.target.value})}
                                        className="h-9 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        placeholder="Tên màu"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Unique Code</Label>
                                    <Input
                                        disabled={modalMode === 'view'}
                                        value={formData.maMau}
                                        onChange={e => setFormData({...formData, maMau: e.target.value})}
                                        className="h-9 border-bo-border bg-white font-mono text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        placeholder="Mã màu"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Hex Visual</Label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            disabled={modalMode === 'view'}
                                            value={formData.maMauHex}
                                            onChange={e => setFormData({...formData, maMauHex: e.target.value})}
                                            className="h-9 w-14 cursor-pointer rounded-md border border-bo-border bg-white p-1"
                                        />
                                        <Input
                                            disabled={modalMode === 'view'}
                                            value={formData.maMauHex}
                                            onChange={e => setFormData({...formData, maMauHex: e.target.value})}
                                            className="h-9 flex-1 border-bo-border bg-white font-mono text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Size ID</Label>
                                        <Input
                                            disabled={modalMode === 'view'}
                                            value={formData.maSize}
                                            onChange={e => setFormData({...formData, maSize: e.target.value})}
                                            className="h-9 border-bo-border bg-white font-mono text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Display Name</Label>
                                        <Input
                                            disabled={modalMode === 'view'}
                                            value={formData.tenSize}
                                            onChange={e => setFormData({...formData, tenSize: e.target.value})}
                                            className="h-9 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Category</Label>
                                        <Input
                                            disabled={modalMode === 'view'}
                                            value={formData.loaiSize}
                                            onChange={e => setFormData({...formData, loaiSize: e.target.value})}
                                            className="h-9 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Priority</Label>
                                        <Input
                                            type="number"
                                            disabled={modalMode === 'view'}
                                            value={formData.thuTuSapXep}
                                            onChange={e => setFormData({...formData, thuTuSapXep: e.target.value})}
                                            className="h-9 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="border-t border-bo-border pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowModal(false)}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                        </Button>
                        {modalMode !== 'view' && (
                            <Button
                                onClick={handleSubmit}
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                Lưu thông tin
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title="Delete attribute?"
                description="This action cannot be undone. Are you sure you want to proceed?"
                confirmText="Confirm Delete"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeleting}
            />
        </PageContainer>
    );
};

export default ColorSizeManagement;
