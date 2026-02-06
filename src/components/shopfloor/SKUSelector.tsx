import { useState, useMemo } from 'react';
import { Search, Package, Timer, Check, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Product } from '@/services/types';

interface SKUSelectorProps {
  products: Product[];
  selectedProductId: string | null;
  onProductChange: (productId: string | null) => void;
  machineCycleTime?: number;
  effectiveCycleTime?: number;
  cycleTimeSource?: string;
  noBenchmarkWarning?: string | null;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SKUSelector({
  products,
  selectedProductId,
  onProductChange,
  machineCycleTime,
  effectiveCycleTime,
  cycleTimeSource,
  noBenchmarkWarning,
  isLoading = false,
  disabled = false,
}: SKUSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-9 bg-muted rounded-md" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected product display */}
      {selectedProduct ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">
                {selectedProduct.name}
              </p>
              <p className="text-xs text-muted-foreground">{selectedProduct.code}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs gap-1">
              <Timer className="h-3 w-3" />
              Target: {effectiveCycleTime ?? selectedProduct.ideal_cycle_time_seconds}s [{cycleTimeSource ?? 'SKU'}]
            </Badge>
          </div>
          {noBenchmarkWarning && (
            <Alert className="py-2 border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-xs text-yellow-700">
                {noBenchmarkWarning}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : machineCycleTime ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
          <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">ยังไม่ได้เลือก SKU</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs gap-1">
            <Timer className="h-3 w-3" />
            Target: {machineCycleTime}s [Machine Default]
          </Badge>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหา SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
          disabled={disabled}
        />
      </div>

      {/* Product grid */}
      <ScrollArea className="h-[180px]">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'ไม่พบ SKU ที่ค้นหา' : 'ไม่มี SKU ในระบบ'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-3">
            {filteredProducts.map((product) => {
              const isSelected = product.id === selectedProductId;
              return (
                <button
                  key={product.id}
                  onClick={() => onProductChange(isSelected ? null : product.id)}
                  disabled={disabled}
                  className={cn(
                    'relative flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all',
                    'hover:bg-accent/50 hover:border-accent-foreground/20',
                    isSelected
                      ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                      : 'bg-card border-border',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      isSelected && 'text-primary'
                    )}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">
                        {product.code}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Timer className="h-2.5 w-2.5" />
                        {product.ideal_cycle_time_seconds}s
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
