import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Pencil, Building2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function CompanyManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch companies
  const { data: companies, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Company[];
    },
  });

  // Create company mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; code: string | null; is_active: boolean }) => {
      const { error } = await supabase.from('companies').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      toast.success('สร้างบริษัทสำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('รหัสบริษัทนี้มีอยู่แล้ว');
      } else {
        toast.error(error.message);
      }
    },
  });

  // Update company mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string | null; is_active: boolean } }) => {
      const { error } = await supabase.from('companies').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      toast.success('อัปเดตบริษัทสำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('รหัสบริษัทนี้มีอยู่แล้ว');
      } else {
        toast.error(error.message);
      }
    },
  });

  // Delete company mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      toast.success('ลบบริษัทสำเร็จ');
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: Error) => {
      if (error.message.includes('violates foreign key')) {
        toast.error('ไม่สามารถลบได้ เนื่องจากมีผู้ใช้สังกัดบริษัทนี้อยู่');
      } else {
        toast.error(error.message);
      }
    },
  });

  // Filter companies
  const filteredCompanies = companies?.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (company.code && company.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenCreateDialog = () => {
    setEditingCompany(null);
    setFormName('');
    setFormCode('');
    setFormIsActive(true);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (company: Company) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormCode(company.code || '');
    setFormIsActive(company.is_active);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    setFormName('');
    setFormCode('');
    setFormIsActive(true);
  };

  const handleOpenDeleteDialog = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('กรุณากรอกชื่อบริษัท');
      return;
    }

    const data = {
      name: formName.trim(),
      code: formCode.trim() || null,
      is_active: formIsActive,
    };

    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (!selectedCompany) return;
    deleteMutation.mutate(selectedCompany.id);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาบริษัท..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มบริษัท
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อบริษัท</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden md:table-cell">สร้างเมื่อ</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies?.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.code ? (
                      <Badge variant="outline">{company.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.is_active ? 'default' : 'secondary'}>
                      {company.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(company)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(company)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCompanies?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {searchQuery ? 'ไม่พบบริษัทที่ค้นหา' : 'ยังไม่มีบริษัทในระบบ'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editingCompany ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทใหม่'}
            </DialogTitle>
            <DialogDescription>
              {editingCompany ? 'แก้ไขข้อมูลบริษัท' : 'กรอกข้อมูลบริษัทใหม่'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อบริษัท *</Label>
              <Input
                id="name"
                placeholder="บริษัท ABC จำกัด"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">รหัสบริษัท</Label>
              <Input
                id="code"
                placeholder="ABC"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                รหัสย่อสำหรับอ้างอิง (ไม่บังคับ)
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">สถานะ Active</Label>
              <Switch
                id="is_active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCompany ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบบริษัท
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบบริษัท <span className="font-semibold">{selectedCompany?.name}</span> ใช่หรือไม่?
              <br /><br />
              หากมีผู้ใช้สังกัดบริษัทนี้อยู่ จะไม่สามารถลบได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ลบบริษัท
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
