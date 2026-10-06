import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  GripVertical,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Layers,
  RefreshCcw,
  Tag,
} from 'lucide-react';
import { danhMucQuanAoService } from '@/services/danhMucQuanAoService';
import { toast } from 'sonner';
import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import SurfaceCard from '@/components/shared/SurfaceCard';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmModal from '@/components/ui/confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Màn hình quản lý danh mục quần áo dạng cây – hỗ trợ thêm/sửa/xóa/khoá/kéo-thả đổi cha-con

// Thụt lề theo cấp = level × 20px, ánh xạ qua bảng class tĩnh (không dựng class động).
const LEVEL_INDENT_CLASSES = ['pl-0', 'pl-5', 'pl-10', 'pl-15', 'pl-20', 'pl-25'];

// Đếm tổng/gốc/con cho dashboard – chỉ tính node đang hoạt động (trangThai !== 0)
const computeStats = (nodes) => {
  let total = 0, root = 0, sub = 0;
  const walk = (list, level) => {
    list.forEach((n) => {
      if (n.trangThai === 0) return; // bỏ qua node đã khoá
      total++;
      if (level === 0) root++; else sub++;
      if (n.danhMucCons?.length) walk(n.danhMucCons, level + 1);
    });
  };
  walk(nodes, 0);
  return { total, root, sub };
};

// Chuẩn hóa payload phẳng hoặc lồng nhau từ API thành cây cha-con đúng chuẩn cho UI
const buildTreeFromAll = (list) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  const rawById = new Map();    // id → node gốc từ API
  const parentById = new Map(); // id → parentId

  // Duyệt toàn bộ node, ghi nhận id và quan hệ cha (hỗ trợ cả payload phẳng lẫn lồng nhau)
  const visit = (nodes, inferredParentId = null) => {
    (nodes || []).forEach((item) => {
      if (!item || item.id == null) return;
      const explicitParentId = item.danhMucChaId ?? item.danhMucCha?.id ?? null;
      const parentId = explicitParentId ?? inferredParentId;
      if (!rawById.has(item.id)) rawById.set(item.id, item);
      if (parentId != null && parentId !== item.id) parentById.set(item.id, parentId);
      else if (!parentById.has(item.id)) parentById.set(item.id, null); // node gốc
      if (Array.isArray(item.danhMucCons) && item.danhMucCons.length > 0) visit(item.danhMucCons, item.id);
    });
  };
  visit(list, null);

  // Clone node, reset danhMucCons để lắp ráp lại từ đầu (tránh phụ thuộc cấu trúc payload gốc)
  const nodeMap = new Map();
  rawById.forEach((item, id) => nodeMap.set(id, { ...item, danhMucCons: [] }));

  // Gắn node vào cha tương ứng; node không có cha hợp lệ → roots[]
  const roots = [];
  nodeMap.forEach((node, id) => {
    const parentId = parentById.get(id);
    if (parentId != null && parentId !== id && nodeMap.has(parentId)) nodeMap.get(parentId).danhMucCons.push(node);
    else roots.push(node);
  });
  return roots;
};

// Thu thập tất cả id node hợp lệ – dùng để lọc expandedNodes sau reload (tránh id mồ côi)
const collectNodeIds = (nodes) => {
  const ids = new Set();
  const walk = (list) => { (list || []).forEach((item) => { ids.add(item.id); if (item.danhMucCons?.length) walk(item.danhMucCons); }); };
  walk(nodes);
  return ids;
};

const DanhMucQuanAoTree = () => {

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [treeData, setTreeData] = useState([]);                              // dữ liệu cây danh mục, nguồn chính render UI
  const [expandedNodes, setExpandedNodes] = useState(new Set());            // tập id các node đang mở (Set → O(1) lookup)
  const [draggedNode, setDraggedNode] = useState(null);                     // node đang được kéo
  const [dragOverNode, setDragOverNode] = useState(null);                   // node đang được hover khi kéo
  const [editingNode, setEditingNode] = useState(null);                     // id node đang ở chế độ sửa inline
  const [editForm, setEditForm] = useState({});                             // dữ liệu form sửa
  const [creatingNode, setCreatingNode] = useState(null);                   // 'root' hoặc id cha khi đang tạo mới
  const [createForm, setCreateForm] = useState({ maDanhMuc: '', tenDanhMuc: '', moTa: '', trangThai: 1 }); // dữ liệu form tạo mới
  const [deleteModal, setDeleteModal] = useState({ show: false, nodeId: null, nodeName: '' }); // trạng thái modal xác nhận xóa
  const [isLoading, setIsLoading] = useState(false);                        // cờ loading khi tải/reload dữ liệu

  // ── STATS ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ total: 0, root: 0, sub: 0 });       // số liệu thống kê hiển thị dashboard card

  // LUỒNG TẢI DỮ LIỆU: gọi song song getCayDanhMuc + getAll → ưu tiên getAll (đầy đủ hơn) → buildTreeFromAll → setTreeData
  const fetchTreeData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Gọi song song 2 API để giảm thời gian chờ
      const [treeResponse, allResponse] = await Promise.allSettled([
        danhMucQuanAoService.getCayDanhMuc(), // GET /get-cay-danh-muc – chỉ trả node đang hoạt động
        danhMucQuanAoService.getAll(),         // GET /all – trả toàn bộ kể cả trangThai=0
      ]);

      let data = [];

      // Ưu tiên getAll() vì đầy đủ cả node khoá
      if (allResponse.status === 'fulfilled' && allResponse.value?.data?.status === 200) {
        const allData = allResponse.value.data.data;
        if (Array.isArray(allData) && allData.length > 0) {
          data = buildTreeFromAll(allData);
        }
      }

      // Fallback sang getCayDanhMuc nếu getAll() lỗi hoặc không có dữ liệu
      if (data.length === 0 && treeResponse.status === 'fulfilled' && treeResponse.value?.data?.status === 200) {
        const treeDataRaw = treeResponse.value.data.data;
        if (Array.isArray(treeDataRaw) && treeDataRaw.length > 0) {
          data = buildTreeFromAll(treeDataRaw); // Sử dụng buildTreeFromAll cho nhất quán
        }
      }

      if (Array.isArray(data)) {
        setTreeData(data);
        setStats(computeStats(data));
        // Giữ lại các node đang mở hợp lệ sau reload (không đóng sập toàn bộ cây)
        setExpandedNodes((prev) => {
          const availableIds = collectNodeIds(data);
          const next = new Set();
          prev.forEach((id) => { if (availableIds.has(id)) next.add(id); });
          return next;
        });
      } else {
        // Cả 2 API đều không trả về dữ liệu hợp lệ
        setTreeData([]);
        setStats({ total: 0, root: 0, sub: 0 });
        toast.warning('Không có danh mục nào được tải');
      }
    } catch (error) {
      console.error('Lỗi khi tải danh mục:', error);
      toast.error('Không thể tải dữ liệu danh mục');
      setTreeData([]);
      setStats({ total: 0, root: 0, sub: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tải dữ liệu khi component mount lần đầu
  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
  useEffect(() => { queueMicrotask(() => fetchTreeData()); }, [fetchTreeData]);

  // Toggle đóng/mở một node theo id
  const toggleExpand = (nodeId) => {
    setExpandedNodes((prev) => { const next = new Set(prev); if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId); return next; });
  };

  // ── DRAG & DROP ────────────────────────────────────────────────────────────

  // Bắt đầu kéo: lưu thông tin node đang kéo để dùng khi drop
  const handleDragStart = (e, node, parentId) => {
    e.stopPropagation();
    setDraggedNode({ ...node, currentParentId: parentId });
    e.dataTransfer.effectAllowed = 'move';
  };

  // Đang kéo qua node: highlight nếu hợp lệ (không phải chính nó, không phải con cháu)
  const handleDragOver = (e, node) => {
    e.preventDefault(); e.stopPropagation();
    if (draggedNode && draggedNode.id !== node.id && !isDescendant(draggedNode, node)) setDragOverNode(node.id);
  };

  // Rời vùng hover: xóa highlight
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOverNode(null); };

  // LUỒNG KÉO-THẢ ĐỔI CHA: validate → Axios PUT update { danhMucChaId: targetNode.id } → Service.update → UPDATE DB → reload cây
  const handleDrop = async (e, targetNode) => {
    e.preventDefault(); e.stopPropagation(); setDragOverNode(null);
    if (!draggedNode || draggedNode.id === targetNode.id) { setDraggedNode(null); return; }
    if (isDescendant(draggedNode, targetNode)) {
      toast.warning('Không thể kéo danh mục cha vào con của nó'); // chặn vòng lặp cha-con
      setDraggedNode(null); return;
    }
    try {
      const response = await danhMucQuanAoService.update({
        id: draggedNode.id, tenDanhMuc: draggedNode.tenDanhMuc,
        danhMucChaId: targetNode.id, // gắn cha mới = node vừa thả vào
        moTa: draggedNode.moTa, trangThai: draggedNode.trangThai,
      });
      if (response.data.status === 200) { toast.success('Cập nhật thành công'); fetchTreeData(); }
      else toast.error('Cập nhật thất bại: ' + response.data.message);
    } catch { toast.error('Có lỗi xảy ra khi cập nhật'); }
    setDraggedNode(null);
  };

  // LUỒNG KÉO VỀ ROOT: Axios PUT update { danhMucChaId: null } → Service.update → UPDATE danh_muc_cha_id=NULL → reload
  const handleDropToRoot = async (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOverNode(null);
    if (!draggedNode) return;
    try {
      const response = await danhMucQuanAoService.update({
        id: draggedNode.id, tenDanhMuc: draggedNode.tenDanhMuc,
        danhMucChaId: null, // null = chuyển về danh mục gốc
        moTa: draggedNode.moTa, trangThai: draggedNode.trangThai,
      });
      if (response.data.status === 200) { toast.success('Đã chuyển thành danh mục gốc!'); fetchTreeData(); }
      else toast.error('Cập nhật thất bại: ' + response.data.message);
    } catch { toast.error('Có lỗi xảy ra khi cập nhật'); }
    setDraggedNode(null);
  };

  // Kiểm tra targetNode có nằm trong nhánh con của sourceNode không (DFS – phòng cycle)
  const isDescendant = (sourceNode, targetNode) => {
    if (!sourceNode.danhMucCons?.length) return false;
    for (const child of sourceNode.danhMucCons) {
      if (child.id === targetNode.id) return true;
      if (isDescendant(child, targetNode)) return true;
    }
    return false;
  };

  // ── EDIT ───────────────────────────────────────────────────────────────────

  // Mở inline edit: nạp dữ liệu node hiện tại vào editForm
  const handleEdit = (node, parentId) => {
    setEditingNode(node.id);
    setEditForm({ id: node.id, tenDanhMuc: node.tenDanhMuc, moTa: node.moTa, trangThai: node.trangThai, danhMucChaId: parentId });
  };

  // LUỒNG LƯU SỬA: Axios PUT /update (editForm) → Controller → Service.update → Repository.save → UPDATE DB → reload cây
  const handleSaveEdit = async () => {
    try {
      const response = await danhMucQuanAoService.update(editForm);
      if (response.data.status === 200) { toast.success('Cập nhật thành công!'); setEditingNode(null); fetchTreeData(); }
      else toast.error('Cập nhật thất bại: ' + response.data.message);
    } catch { toast.error('Có lỗi xảy ra khi cập nhật'); }
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────

  // Mở modal xác nhận xóa, lưu id và tên node cần xóa
  const confirmDelete = (node) => setDeleteModal({ show: true, nodeId: node.id, nodeName: node.tenDanhMuc });

  // LUỒNG XÓA MỀM: Axios DELETE /{id} → Controller set trangThai=0 → Repository.save → node vẫn ở DB nhưng hiển thị mờ
  const handleDelete = async () => {
    try {
      const response = await danhMucQuanAoService.delete(deleteModal.nodeId);
      if (response.data.status === 200) { toast.success(`Đã chuyển "${deleteModal.nodeName}" sang ngừng hoạt động`); fetchTreeData(); }
    } catch { toast.error('Lỗi khi xóa danh mục'); }
    finally { setDeleteModal({ show: false, nodeId: null, nodeName: '' }); }
  };

  // ── CREATE ─────────────────────────────────────────────────────────────────

  // Mở form tạo danh mục con ngay dưới parentNode và tự động expand node cha
  const handleAddChild = (parentNode) => {
    setCreatingNode(parentNode.id);
    setCreateForm({ maDanhMuc: '', tenDanhMuc: '', moTa: '', trangThai: 1, danhMucChaId: parentNode.id });
    const newExpanded = new Set(expandedNodes);
    newExpanded.add(parentNode.id);
    setExpandedNodes(newExpanded);
  };

  // LUỒNG TẠO MỚI: validate client → chuẩn hóa payload → Axios POST /create → Controller → Service.create → Repository.findByMaDanhMuc + save → INSERT DB → reload cây
  const handleSaveCreate = async () => {
    // Validate client-side: tránh gửi request thiếu trường bắt buộc lên server
    if (!createForm.tenDanhMuc.trim()) { toast.warning('Vui lòng nhập tên danh mục!'); return; }
    if (!createForm.maDanhMuc.trim()) { toast.warning('Vui lòng nhập mã danh mục!'); return; }
    try {
      // Chuẩn hóa payload: trim chuỗi, ép trangThai về Number, đảm bảo danhMucChaId gửi null cho danh mục gốc
      const payload = {
        ...createForm,
        maDanhMuc: createForm.maDanhMuc.trim(),
        tenDanhMuc: createForm.tenDanhMuc.trim(),
        moTa: createForm.moTa?.trim() || '',
        trangThai: Number(createForm.trangThai) || 1,
        danhMucChaId: Object.prototype.hasOwnProperty.call(createForm, 'danhMucChaId') ? createForm.danhMucChaId : null,
      };
      // Gọi API: Frontend → Controller.create → Service.create (@Transactional) → Repository → DB
      const response = await danhMucQuanAoService.create(payload);
      if (response.data.status === 200) {
        toast.success('Tạo danh mục thành công!');
        setCreatingNode(null);
        setCreateForm({ maDanhMuc: '', tenDanhMuc: '', moTa: '', trangThai: 1 }); // reset form sau khi tạo thành công
        fetchTreeData(); // reload cây để đồng bộ dữ liệu mới từ DB
      } else {
        toast.error('Tạo danh mục thất bại: ' + (response.data.message || 'Không rõ lỗi')); // hiển thị lỗi nghiệp vụ từ backend (VD: trùng mã)
      }
    } catch (error) {
      // Lấy message lỗi từ response body backend thay vì thông báo chung chung
      const message = error?.response?.data?.message || error?.message || 'Có lỗi xảy ra khi tạo danh mục';
      toast.error(message);
    }
  };

  // Huỷ tạo mới, reset form về mặc định
  const handleCancelCreate = () => { setCreatingNode(null); setCreateForm({ maDanhMuc: '', tenDanhMuc: '', moTa: '', trangThai: 1 }); };

  // Mở form tạo danh mục cấp gốc (danhMucChaId = null)
  const handleAddRoot = () => { setCreatingNode('root'); setCreateForm({ maDanhMuc: '', tenDanhMuc: '', moTa: '', trangThai: 1, danhMucChaId: null }); };

  // ── Render create form ────────────────────────────────────────────────────
  const renderCreateForm = (parentId) => (
    <div className={`my-2 ${parentId !== 'root' ? 'pl-5' : ''}`}>
      <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-bo-foreground">
          {parentId === 'root' ? 'Thêm danh mục gốc mới' : 'Thêm danh mục con'}
        </p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-bo-muted">Mã danh mục *</label>
            <Input
              value={createForm.maDanhMuc}
              onChange={(e) => setCreateForm({ ...createForm, maDanhMuc: e.target.value })}
              placeholder="VD: DM001"
              className="h-8 border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-bo-muted">Tên danh mục *</label>
            <Input
              value={createForm.tenDanhMuc}
              onChange={(e) => setCreateForm({ ...createForm, tenDanhMuc: e.target.value })}
              placeholder="VD: Áo thun"
              className="h-8 border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
            />
          </div>
        </div>
        <div className="mb-3 space-y-1">
          <label className="text-xs font-medium text-bo-muted">Mô tả</label>
          <textarea
            value={createForm.moTa}
            onChange={(e) => setCreateForm({ ...createForm, moTa: e.target.value })}
            placeholder="Nhập mô tả..."
            rows={2}
            className="w-full resize-none rounded-md border border-bo-border bg-white px-3 py-2 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelCreate}
            className="h-8 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <X className="size-3.5" /> Hủy
          </Button>
          <Button
            size="sm"
            onClick={handleSaveCreate}
            className="h-8 gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            <Save className="size-3.5" /> Lưu
          </Button>
        </div>
      </div>
    </div>
  );

  // ── Render node ───────────────────────────────────────────────────────────
  /**
   * Render đệ quy từng node trong cây danh mục.
   * - level: độ sâu hiện tại → thụt lề level × 20px để thể hiện cấp bậc.
   * - parentId: id cha của node hiện tại (dùng cho edit).
   * - isInactive: node trangThai=0 hiển thị mờ.
   * - isEditing: render Input thay vì text thuần để sửa inline.
   * - isCreating: mở form tạo con ngay dưới node này khi đang expanded.
   * - Chỉ render con khi isExpanded = true → giảm số DOM node, cải thiện hiệu năng.
   */
  const renderNode = (node, level = 0, parentId = null) => {
    const allChildren = node.danhMucCons || [];
    const hasChildren = allChildren.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isDragOver = dragOverNode === node.id;
    const isEditing = editingNode === node.id;
    const isCreating = creatingNode === node.id;
    const isInactive = Number(node.trangThai) === 0;

    return (
      <div key={node.id} className={LEVEL_INDENT_CLASSES[Math.min(level, LEVEL_INDENT_CLASSES.length - 1)]}>
        {/* Moi cap trong cay se thut vao 20px de the hien quan he cap bac. */}
        <div
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, node, parentId)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          className={`my-1 rounded-lg border transition-colors ${isDragOver ? 'border-bo-primary bg-bo-primary-soft' : 'border-transparent'
            }`}
        >
          {/* Node row */}
          <div
            className={`group flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm transition-colors ${isEditing
                ? 'cursor-default border-bo-primary'
                : 'cursor-move border-bo-border hover:border-bo-primary/40'
              } ${isInactive ? 'border-bo-border bg-bo-surface-subtle opacity-55' : ''}`}
          >
            {/* Left */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GripVertical className="size-4 shrink-0 text-slate-300 group-hover:text-slate-400" />

              {(hasChildren || isCreating) ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleExpand(node.id);
                  }}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-bo-muted transition-colors hover:bg-bo-primary-soft hover:text-bo-primary"
                >
                  {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </button>
              ) : (
                <div className="w-5 shrink-0" />
              )}

              {isExpanded && (hasChildren || isCreating)
                ? <FolderOpen className="size-4 shrink-0 text-bo-primary" />
                : <Folder className="size-4 shrink-0 text-bo-primary" />
              }

              {isEditing ? (
                <Input
                  value={editForm.tenDanhMuc}
                  onChange={(e) => setEditForm({ ...editForm, tenDanhMuc: e.target.value })}
                  className="h-8 min-w-0 flex-1 border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                  autoFocus
                />
              ) : (
                <span className="truncate text-sm font-semibold text-bo-foreground">{node.tenDanhMuc}</span>
              )}

              <span className="shrink-0 font-mono text-xs text-bo-muted">({node.maDanhMuc})</span>

              {level === 0 && (
                <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-bo-border bg-bo-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-bo-muted">
                  Gốc
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex size-7 items-center justify-center rounded-md text-bo-success transition-colors hover:bg-bo-success-soft"
                    title="Lưu"
                  >
                    <Save className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingNode(null)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100"
                    title="Hủy"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleAddChild(node)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-bo-primary transition-colors hover:bg-bo-primary-soft"
                    title="Thêm danh mục con"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleEdit(node, parentId)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100"
                    title="Sửa"
                  >
                    <Edit className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirmDelete(node)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-bo-danger transition-colors hover:bg-bo-danger-soft"
                    title="Xóa mềm"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mô tả & inline edit */}
          {node.moTa && !isEditing && (
            <p className="mt-1 pl-[72px] text-xs italic text-bo-muted">{node.moTa}</p>
          )}
          {isEditing && (
            <div className="mt-1 pl-[72px] pr-3">
              <textarea
                value={editForm.moTa || ''}
                onChange={(e) => setEditForm({ ...editForm, moTa: e.target.value })}
                placeholder="Mô tả..."
                rows={2}
                className="w-full resize-none rounded-md border border-bo-border bg-white px-3 py-1.5 text-xs text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary"
              />
            </div>
          )}
        </div>

        {/* ── Danh sách con & form tạo con ── */}
        {isExpanded && (
          <div className="mt-1">
            {/* Chỉ render danh sách con khi node đang mở (isExpanded=true)
                → tránh render toàn bộ cây cùng lúc, tối ưu hiệu năng DOM. */}
            {allChildren.map((child) => renderNode(child, level + 1, node.id))}
            {/* Form tạo con xuất hiện ngay dưới cùng của danh sách con khi đang tạo mới. */}
            {isCreating && renderCreateForm(node.id)}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Danh mục sản phẩm"
        description="Kéo và thả để thay đổi mối quan hệ cha – con"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTreeData}
              disabled={isLoading}
              className="h-9 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
            >
              <RefreshCcw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={handleAddRoot}
              className="h-9 gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              <Plus className="size-4" />
              Thêm danh mục gốc
            </Button>
          </>
        }
      />

      {/* ── Stats ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Tag className="size-4" />}
          iconClass="bg-bo-primary-soft text-bo-primary"
          label="Tổng danh mục"
          value={stats.total}
        />
        <StatTile
          icon={<Folder className="size-4" />}
          iconClass="bg-bo-success-soft text-bo-success"
          label="Danh mục gốc"
          value={stats.root}
        />
        <StatTile
          icon={<Layers className="size-4" />}
          iconClass="bg-bo-warning-soft text-bo-warning"
          label="Danh mục con"
          value={stats.sub}
        />
      </section>

      {/* ── Main tree ── */}
      <SurfaceCard>
        {/* Drop-to-root zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverNode('root'); }}
          onDragLeave={() => setDragOverNode(null)}
          onDrop={handleDropToRoot}
          className={`min-h-[400px] rounded-lg border border-dashed p-3 transition-colors ${dragOverNode === 'root' ? 'border-bo-primary bg-bo-primary-soft' : 'border-bo-border bg-bo-surface-subtle'
            }`}
        >
          {isLoading && treeData.length === 0 && creatingNode === null ? (
            <LoadingState />
          ) : (
            <>
              {creatingNode === 'root' && renderCreateForm('root')}

              {treeData.filter(node => node.trangThai !== 0).length === 0 && creatingNode !== 'root' ? (
                <EmptyState
                  icon={Tag}
                  title="Chưa có danh mục nào"
                  description='Nhấn "Thêm danh mục gốc" để bắt đầu'
                />
              ) : (
                // Render toàn bộ node gốc (level=0, parentId=null).
                // Mỗi node tự đệ quy render node con thông qua renderNode(child, level+1, node.id).
                // Chỉ hiển thị danh mục gốc đang hoạt động (trangThai !== 0)
                treeData.filter(node => node.trangThai !== 0).map((node) => renderNode(node, 0, null))
              )}
            </>
          )}
        </div>
      </SurfaceCard>

      {/* ── Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={deleteModal.show}
        onClose={() => setDeleteModal({ show: false })}
        onConfirm={handleDelete}
        title="Xác nhận xóa danh mục"
        description={
          <>
            Bạn có chắc chắn muốn xóa{" "}
            <strong className="font-semibold text-bo-foreground">"{deleteModal.nodeName}"</strong>?
            <span className="mt-1 block text-xs font-medium text-bo-danger">
              Danh mục sẽ được chuyển sang trạng thái ngừng hoạt động và vẫn hiển thị mờ trong danh sách.
            </span>
          </>
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy"
        variant="danger"
      />
    </PageContainer>
  );
};

/* ══════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════ */
function StatTile({ icon, iconClass, label, value }) {
  return (
    <div className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-bo-muted">{label}</span>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
    </div>
  );
}

export default DanhMucQuanAoTree;
