import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis
} from "@/components/ui/pagination";

export default function PaginationComponent({
    currentPage = 0,
    pageSize = 10,
    totalItems = 0,
    onPageChange,
    onPageSizeChange,
    isLoading = false,
    pageSizeOptions = [10, 20, 30, 40, 50]
}) {
    const totalPages = useMemo(() => Math.ceil(totalItems / pageSize), [totalItems, pageSize]);

    const displayedItems = useMemo(() => {
        const start = currentPage * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        return end - start;
    }, [currentPage, pageSize, totalItems]);

    return (
        <div className="p-4 border-t flex-none bg-bo-surface">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    Hiển thị {displayedItems} / {totalItems}
                </span>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-500">Số lượng:</Label>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => onPageSizeChange(Number(value))}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="h-8 w-20 px-2 text-xs">
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent
                                position="popper"
                                side="bottom"
                                align="start"
                                sideOffset={4}
                                className="z-50 border border-gray-200 shadow-lg rounded-md bg-bo-surface"
                            >
                                {pageSizeOptions.map((size) => {
                                    const active = String(pageSize) === String(size);

                                    return (
                                        <SelectItem
                                            key={size}
                                            value={String(size)}
                                            className={
                                                active
                                                    ? "bg-slate-900 text-white focus:bg-slate-900 focus:text-white"
                                                    : "focus:bg-gray-100"
                                            }
                                        >
                                            {size}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => onPageChange(currentPage - 1)}
                                    className={currentPage === 0 || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                />
                            </PaginationItem>

                            {[...Array(Math.min(3, totalPages))].map((_, idx) => {
                                const pageNum = idx + 1;
                                const isActive = currentPage + 1 === pageNum;

                                return (
                                    <PaginationItem key={pageNum}>
                                        <PaginationLink
                                            onClick={() => onPageChange(pageNum - 1)}
                                            isActive={isActive}
                                            className={`cursor-pointer ${isActive
                                                ? "bg-slate-900 text-white border border-slate-900 hover:bg-white hover:text-slate-900"
                                                : "hover:bg-gray-100"
                                                } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                                        >
                                            {pageNum}
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                            })}

                            {totalPages > 4 && (
                                <PaginationItem>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            )}

                            {totalPages > 3 && (
                                <PaginationItem>
                                    <PaginationLink
                                        onClick={() => onPageChange(totalPages - 1)}
                                        isActive={currentPage + 1 === totalPages}
                                        className={`cursor-pointer ${currentPage + 1 === totalPages
                                            ? "bg-slate-900 text-white border border-slate-900 hover:bg-white hover:text-slate-900"
                                            : "hover:bg-gray-100"
                                            } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                                    >
                                        {totalPages}
                                    </PaginationLink>
                                </PaginationItem>
                            )}

                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => onPageChange(currentPage + 1)}
                                    className={currentPage + 1 >= totalPages || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            </div>
        </div>
    );
}
