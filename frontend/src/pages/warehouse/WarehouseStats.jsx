import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Warehouse, CheckCircle2, X, Package } from 'lucide-react';
import { t } from "@/i18n";

export default function WarehouseStats({ stats }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{t("Tổng số kho")}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Warehouse className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-green-50 to-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{t("Đang hoạt động")}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.active}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-gray-50 to-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{t("Không hoạt động")}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.inactive}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <X className="h-6 w-6 text-gray-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{t("Tổng tồn kho")}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalStock}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-purple-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
