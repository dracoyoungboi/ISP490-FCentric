import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';

export default function WarehouseHeader({ onAddWarehouse }) {
    return (
        <div className="flex items-center justify-end">
            <Button
                onClick={onAddWarehouse}
                className="bg-slate-900 text-white border border-slate-900 hover:bg-bo-surface hover:text-slate-900 shadow-sm transition-all duration-200"
            >
                <Plus className="w-4 h-4 mr-2" />
                Thêm kho mới
            </Button>
        </div>
    );
}
