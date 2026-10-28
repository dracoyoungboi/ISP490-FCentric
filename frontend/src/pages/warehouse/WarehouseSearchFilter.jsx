import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, ChevronDown, Check, Filter, RefreshCcw } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function WarehouseSearchFilter({ searchTerm, setSearchTerm, filterStatus, setFilterStatus }) {
    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
    };

    return (
        <Card className="border-0 shadow-lg bg-bo-surface">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Filter className="h-5 w-5 text-purple-600" />
                    Bộ lọc tìm kiếm
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Tìm kiếm */}
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-gray-700 font-medium">Tìm kiếm</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Tìm theo tên, mã kho, địa chỉ..."
                                className="pl-9 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Trạng thái */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Trạng thái</Label>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between bg-bo-surface border-gray-200 hover:bg-gray-50 font-normal">
                                    <span className="truncate">
                                        {filterStatus === "all" && "Tất cả trạng thái"}
                                        {filterStatus === "active" && "Đang hoạt động"}
                                        {filterStatus === "inactive" && "Không hoạt động"}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-70 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-[200px] bg-bo-surface border border-gray-100 shadow-xl z-50">
                                <DropdownMenuItem
                                    onClick={() => setFilterStatus("all")}
                                    className="flex items-center justify-between cursor-pointer hover:bg-purple-50"
                                >
                                    Tất cả trạng thái
                                    {filterStatus === "all" && <Check className="h-4 w-4" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setFilterStatus("active")}
                                    className="flex items-center justify-between cursor-pointer hover:bg-purple-50"
                                >
                                    Đang hoạt động
                                    {filterStatus === "active" && <Check className="h-4 w-4" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setFilterStatus("inactive")}
                                    className="flex items-center justify-between cursor-pointer hover:bg-purple-50"
                                >
                                    Không hoạt động
                                    {filterStatus === "inactive" && <Check className="h-4 w-4" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Reset Button */}
                    <div className="flex items-end">
                        <Button
                            variant="outline"
                            onClick={handleResetFilters}
                            className="bg-bo-surface text-gray-700 border-gray-200 hover:bg-gray-50 h-10 px-4 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 w-full justify-center"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Đặt lại
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
