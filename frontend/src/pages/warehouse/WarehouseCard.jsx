import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Edit, Trash2, Eye, MapPin, User, Package, TrendingUp } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';

export default function WarehouseCard({ warehouse, onView, onEdit, onDelete }) {
    return (
        <Card className="border-2 hover:shadow-lg transition-all duration-300">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-lg">
                            <Warehouse className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{warehouse.tenKho}</CardTitle>
                            <p className="text-sm text-gray-600 font-mono">{warehouse.maKho}</p>
                        </div>
                    </div>
                    {warehouse.trangThai === 1 ? (
                        <Badge className="bg-gray-900 hover:bg-gray-800 text-white border-0">
                            Hoạt động
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            Đóng
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                    <p className="text-sm text-gray-700">{warehouse.diaChi}</p>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Quản lý:</span>
                    </div>
                    <span className="text-sm font-medium">{warehouse.quanLy?.hoTen || '—'}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Tồn kho:</span>
                    </div>
                    <span className="text-sm font-bold text-purple-600">{formatNumber(warehouse.soLuongTon)}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Giá trị:</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                        {formatCurrency(warehouse.giaTriTon)}
                    </span>
                </div>

                <div className="pt-4 border-t flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onView(warehouse)}
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        Chi tiết
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onEdit(warehouse)}
                    >
                        <Edit className="w-4 h-4 mr-1" />
                        Sửa
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-bo-danger-strong hover:bg-bo-danger-soft"
                        onClick={() => onDelete(warehouse)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
