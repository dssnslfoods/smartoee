import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  exportMasterDataToExcel, exportMasterDataToCSV,
  parseImportFile,
} from '@/lib/masterDataExport';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  company_id: string;
  line_id: string | null;
}

interface Line {
  id: string;
  name: string;
  code: string | null;
  plant_id: string;
  plant_name?: string;
}

const PRODUCT_COLUMNS = [
  { key: 'code', header: 'Code', type: 'string' as const },
  { key: 'name', header: 'Name', type: 'string' as const },
  { key: 'line', header: 'Line', type: 'string' as const },
  { key: 'description', header: 'Description', type: 'string' as const },
  { key: 'is_active', header: 'Status', type: 'boolean' as const },
];

export function ProductManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '', name: '', description: '', is_active: true, line_id: '' as string,
  });

  const selectedCompanyId = company?.id;

  // Fetch lines with plant info for the selector
  const { data: lines } = useQuery({
    queryKey: ['admin-lines-for-products', selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from('lines').select('id, name, code, plant_id').eq('is_active', true).order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;

      // Fetch plant names
      const plantIds = [...new Set((data || []).map(l => l.plant_id))];
      if (plantIds.length === 0) return [] as Line[];
      const { data: plants } = await supabase.from('plants').select('id, name').in('id', plantIds);
      const plantMap = new Map((plants || []).map(p => [p.id, p.name]));

      return (data || []).map(l => ({
        ...l,
        plant_name: plantMap.get(l.plant_id) || '',
      })) as Line[];
    },
    enabled: !!selectedCompanyId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products', selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from('products').select('*').order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Build a line lookup map
  const lineMap = new Map((lines || []).map(l => [l.id, l]));

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('products').insert({
        code: data.code, name: data.name, description: data.description || null,
        is_active: data.is_active, company_id: selectedCompanyId!,
        line_id: data.line_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('สร้าง Product/SKU สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('products').update({
        code: data.code, name: data.name, description: data.description || null,
        is_active: data.is_active,
        line_id: data.line_id || null,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('อัปเดต Product/SKU สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('ลบ Product/SKU สำเร็จ');
      setIsDeleteOpen(false);
      setDeletingProduct(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkUpsertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      // Use comma-separated columns WITHOUT spaces for PostgREST onConflict
      const { error } = await supabase.from('products').upsert(rows as any, {
        onConflict: 'company_id,code'
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`นำเข้าและอัปเดตข้อมูลสำเร็จ ${variables.length} รายการ`);
    },
    onError: (error: Error) => toast.error(`นำเข้าข้อมูลล้มเหลว: ${error.message}`),
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({ code: '', name: '', description: '', is_active: true, line_id: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code, name: product.name,
      description: product.description || '',
      is_active: product.is_active,
      line_id: product.line_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({ code: '', name: '', description: '', is_active: true, line_id: '' });
  };

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('กรุณากรอก Code และ Name');
      return;
    }
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExportExcel = async () => {
    if (!products || products.length === 0) { toast.error('ไม่มีข้อมูลให้ export'); return; }
    const companyName = company?.name || 'All';
    const productsWithLine = products.map(p => ({
      ...p,
      line: p.line_id ? lineMap.get(p.line_id)?.name || '' : '',
    }));
    await exportMasterDataToExcel(productsWithLine, PRODUCT_COLUMNS, `products_${companyName}`, 'Products');
    toast.success('Export Excel สำเร็จ');
  };

  const handleExportCSV = () => {
    if (!products || products.length === 0) { toast.error('ไม่มีข้อมูลให้ export'); return; }
    const companyName = company?.name || 'All';
    const productsWithLine = products.map(p => ({
      ...p,
      line: p.line_id ? lineMap.get(p.line_id)?.name || '' : '',
    }));
    exportMasterDataToCSV(productsWithLine, PRODUCT_COLUMNS, `products_${companyName}`);
    toast.success('Export CSV สำเร็จ');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedCompanyId) { toast.error('กรุณาเลือกบริษัทก่อน import'); return; }
    setIsImporting(true);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); return; }

      const processedRows = parsed
        .filter(row => {
          const code = (row.code || '').trim();
          const name = (row.name || '').trim();
          return code && name;
        })
        .map(row => {
          // Find matching line by name or code
          const lineVal = (row.line || row.line_id || row.production_line || '').trim();
          let foundLineId = null;
          if (lineVal && lines) {
            const matched = lines.find(l =>
              l.name.toLowerCase() === lineVal.toLowerCase() ||
              (l.code && l.code.toLowerCase() === lineVal.toLowerCase())
            );
            if (matched) foundLineId = matched.id;
          }

          return {
            code: (row.code || '').trim(),
            name: (row.name || '').trim(),
            description: row.description || null,
            is_active: row.status ? row.status.toLowerCase() === 'active' : true,
            company_id: selectedCompanyId,
            line_id: foundLineId,
          };
        });

      // Deduplicate rows by code within the batch to avoid PostgREST bulk upsert issues
      const uniqueRowsMap = new Map();
      processedRows.forEach(row => {
        uniqueRowsMap.set(row.code, row);
      });
      const rows = Array.from(uniqueRowsMap.values());

      if (rows.length === 0) { toast.error('ไม่พบข้อมูลที่ถูกต้อง (ต้องมี Code และ Name)'); return; }
      await bulkUpsertMutation.mutateAsync(rows);
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`ไม่สามารถอ่านไฟล์ได้: ${err?.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`);
    }
    finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Products / SKU</h3>
          {company && <p className="text-sm text-muted-foreground">บริษัท: {company.name}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            กำหนด Cycle Time, Setup Time, Target Quality ได้ที่แท็บ "Standards" (Machine × SKU)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleImportFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting || !selectedCompanyId}>
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!products || products.length === 0}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>Export Excel (.xls)</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>Export CSV (.csv)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />Add Product
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map((product) => {
              const line = product.line_id ? lineMap.get(product.line_id) : null;
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-mono">{product.code}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-sm">
                    {line ? (
                      <span>{line.name} <span className="text-muted-foreground">({line.plant_name})</span></span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{product.description || '—'}</TableCell>
                  <TableCell>
                    <span className={product.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingProduct(product); setIsDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {products?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  ไม่พบ Product/SKU {company ? `ของบริษัท ${company.name}` : ''}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'แก้ไข Product/SKU' : 'เพิ่ม Product/SKU'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'แก้ไขรายละเอียด' : 'สร้าง Product/SKU ใหม่'}
              {company && ` สำหรับบริษัท ${company.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g., SKU-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Widget A" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line">Line</Label>
              <Select value={formData.line_id} onValueChange={(val) => setFormData({ ...formData, line_id: val === '__none__' ? '' : val })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Line (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {lines?.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name} ({line.plant_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="รายละเอียดสินค้า (ถ้ามี)" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Product/SKU</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ "{deletingProduct?.name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingProduct && deleteMutation.mutate(deletingProduct.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
