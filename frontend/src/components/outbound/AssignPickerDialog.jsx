import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/shared/SearchInput";
import { nhatHangService } from "@/services/nhatHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getCurrentUserId, hasAnyRole, ROLES } from "@/utils/roles";
import { normalizeText } from "@/mocks/mockHelpers";
import { cn } from "@/lib/utils";

/**
 * Phân công người nhặt cho Pick List.
 * - Quản trị viên / quản lý kho: chọn người trong danh sách nhân viên kho.
 * - Mọi vai trò kho: "Nhận việc" (tự phân công cho mình).
 */
export default function AssignPickerDialog({ open, onOpenChange, pickList, onAssigned }) {
  const canAssignOthers = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const isAdmin = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const currentUserId = getCurrentUserId();

  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open || !canAssignOthers) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingStaff(true);
      setStaffError("");
      setSelectedId(pickList?.nguoiNhatId ?? null);
    });
    nhatHangService
      .getNguoiNhat({ isAdmin })
      .then((list) => {
        if (!cancelled) setStaff(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setStaffError("Chưa lấy được danh sách nhân viên kho. Bạn vẫn có thể nhận việc cho mình.");
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canAssignOthers, isAdmin, pickList?.nguoiNhatId]);

  const filteredStaff = useMemo(() => {
    const key = normalizeText(keyword);
    return staff.filter((person) => !key || normalizeText(`${person.hoTen} ${person.tenDangNhap ?? ""}`).includes(key));
  }, [staff, keyword]);

  const assign = async (nguoiNhatId) => {
    if (!pickList || !nguoiNhatId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const dto = await nhatHangService.phanCong(pickList.id, { nguoiNhatId });
      toast.success(`Đã phân công ${pickList.maPickList} cho ${dto?.tenNguoiNhat || "nhân viên"}`);
      onAssigned?.(dto);
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể phân công người nhặt"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bo-foreground">Phân công người nhặt</DialogTitle>
          <DialogDescription className="text-slate-600">
            {pickList ? `Pick List ${pickList.maPickList}` : ""}
            {pickList?.tenNguoiNhat ? ` · đang giao cho ${pickList.tenNguoiNhat}` : " · chưa có người nhặt"}
          </DialogDescription>
        </DialogHeader>

        {canAssignOthers ? (
          <div className="space-y-3">
            <SearchInput
              className="sm:max-w-none"
              placeholder="Tìm theo tên hoặc tài khoản"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onClear={() => setKeyword("")}
            />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-bo-border">
              {loadingStaff ? (
                <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-bo-muted">
                  <Loader2 className="size-4 animate-spin" /> Đang tải nhân viên kho
                </div>
              ) : staffError ? (
                <p className="px-3 py-6 text-center text-sm text-bo-muted">{staffError}</p>
              ) : filteredStaff.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-bo-muted">Không có nhân viên phù hợp.</p>
              ) : (
                <ul className="divide-y divide-bo-border">
                  {filteredStaff.map((person) => {
                    const active = selectedId === person.id;
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(person.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                            active ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-bo-foreground">{person.hoTen}</span>
                            <span className="block truncate text-xs text-bo-muted">
                              {person.tenDangNhap || "—"} · {person.vaiTro === ROLES.QUAN_LY_KHO ? "Quản lý kho" : "Nhân viên kho"}
                            </span>
                          </span>
                          {active ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
            <Users className="mt-0.5 size-4 shrink-0 text-bo-muted" />
            <p>Bạn có thể nhận Pick List này để bắt đầu nhặt hàng. Quản lý kho có thể phân công lại sau.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={saving || !currentUserId}
            onClick={() => assign(currentUserId)}
            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <UserCheck className="size-4" />
            Nhận việc cho tôi
          </Button>
          {canAssignOthers ? (
            <Button
              type="button"
              disabled={saving || !selectedId || selectedId === pickList?.nguoiNhatId}
              onClick={() => assign(selectedId)}
              className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Phân công
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
