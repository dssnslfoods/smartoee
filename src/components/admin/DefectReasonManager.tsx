import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DEFECT_REASON_COLUMNS,
} from '@/lib/masterDataExport';

interface DefectReason {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  company_id: string | null;
}

export function DefectReasonManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingReason, setEditingReason] = useState<DefectReason | null>(null);
  const [deletingReason, setDeletingReason] = useState<DefectReason | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', is_active: true });

  const selectedCompanyId = company?.id;

  const { data: reasons, isLoading } = useQuery({
    queryKey: ['admin-defect-reasons', selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from('defect_reasons').select('*').order('name');
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as DefectReason[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('defect_reasons')
        .insert({ 
          code: data.code, name: data.name, is_active: data.is_active,
          company_id: selectedCompanyId || null 
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-defect-reasons'] });
      toast.success('สร้าง Defect Reason สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('defect_reasons')
        .update({ code: data.code, name: data.name, is_active: data.is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-defect-reasons'] });
      toast.success('อัปเดต Defect Reason สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('defect_reasons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-defect-reasons'] });
      toast.success('ลบ Defect Reason สำเร็จ');
      setIsDeleteOpen(false);
      setDeletingReason(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: { code: string; name: string; is_active: boolean; company_id: string | null }[]) => {
      const { error } = await supabase.from('defect_reasons').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-defect-reasons'] });
      toast.success(`นำเข้าข้อมูลสำเร็จ ${variables.length} รายการ`);
    },
    onError: (error: Error) => toast.error(`นำเข้าข้อมูลล้มเหลว: ${error.message}`),
  });

  const handleOpenCreate = () => {
    setEditingReason(null);
    setFormData({ code: '', name: '', is_active: true });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (reason: DefectReason) => {
    setEditingReason(reason);
    setFormData({ code: reason.code, name: reason.name, is_active: reason.is_active });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingReason(null);
    setFormData({ code: '', name: '', is_active: true });
  };

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('กรุณากรอก Code และ Name');
      return;
    }
    if (editingReason) {
      updateMutation.mutate({ id: editingReason.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExportExcel = () => {
    if (!reasons || reasons.length === 0) {
      toast.error('ไม่มีข้อมูลให้ export');
      return;
    }
    const companyName = company?.name || 'All';
    exportMasterDataToExcel(reasons, DEFECT_REASON_COLUMNS, `defect_reasons_${companyName}`, 'Defect Reasons');
    toast.success('Export Excel สำเร็จ');
  };

  const handleExportCSV = () => {
    if (!reasons || reasons.length === 0) {
      toast.error('ไม่มีข้อมูลให้ export');
      return;
    }
    const companyName = company?.name || 'All';
    exportMasterDataToCSV(reasons, DEFECT_REASON_COLUMNS, `defect_reasons_${companyName}`);
    toast.success('Export CSV สำเร็จ');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedCompanyId) {
      toast.error('กรุณาเลือกบริษัทก่อน import');
      return;
    }

    setIsImporting(true);
    try {
      const parsed = await parseImportFile(file);

      if (parsed.length === 0) {
        toast.error('ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบรูปแบบ (ต้องมี header: Code, Name)');
        return;
      }

      const rows = parsed
        .filter(row => row.code && row.name)
        .map(row => ({
          code: row.code,
          name: row.name,
          is_active: row.status ? row.status.toLowerCase() === 'active' : true,
          company_id: selectedCompanyId,
        }));

      if (rows.length === 0) {
        toast.error('ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์');
        return;
      }

      await bulkInsertMutation.mutateAsync(rows);
    } catch (error) {
      toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบ');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Defect Reasons</h3>
          {company && (
            <p className="text-sm text-muted-foreground">บริษัท: {company.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || !selectedCompanyId}
          >
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!reasons || reasons.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                Export Excel (.xls)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                Export CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Reason
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reasons?.map((reason) => (
              <TableRow key={reason.id}>
                <TableCell className="font-mono">{reason.code}</TableCell>
                <TableCell className="font-medium">{reason.name}</TableCell>
                <TableCell>
                  <span className={reason.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                    {reason.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(reason)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingReason(reason); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {reasons?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  ไม่พบ Defect Reason {company ? `ของบริษัท ${company.name}` : ''}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReason ? 'แก้ไข Defect Reason' : 'เพิ่ม Defect Reason'}</DialogTitle>
            <DialogDescription>
              {editingReason ? 'แก้ไขรายละเอียด' : 'สร้าง Defect Reason ใหม่'}
              {company && ` สำหรับบริษัท ${company.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., DF-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Surface Defect"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingReason ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Defect Reason</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ "{deletingReason?.name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingReason && deleteMutation.mutate(deletingReason.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
