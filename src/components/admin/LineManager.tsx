import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { toast } from 'sonner';

interface Line {
  id: string;
  name: string;
  code: string | null;
  plant_id: string;
  company_id: string;
  is_active: boolean;
}

interface Plant {
  id: string;
  name: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

export function LineManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [deletingLine, setDeletingLine] = useState<Line | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', plant_id: '', company_id: '', is_active: true });
  const [selectedCompanyIdForForm, setSelectedCompanyIdForForm] = useState<string>('');

  // Use the admin's selected company context
  const selectedCompanyId = company?.id;

  // Set default company_id when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      setSelectedCompanyIdForForm(selectedCompanyId);
      setFormData(prev => ({ ...prev, company_id: selectedCompanyId }));
    }
  }, [selectedCompanyId]);

  const { data: companies } = useQuery({
    queryKey: ['admin-companies-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Company[];
    },
  });

  const { data: plants } = useQuery({
    queryKey: ['admin-plants-lookup', selectedCompanyIdForForm || selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('plants')
        .select('id, name, company_id')
        .eq('is_active', true)
        .order('name');
      
      const companyToFilter = selectedCompanyIdForForm || selectedCompanyId;
      if (companyToFilter) {
        query = query.eq('company_id', companyToFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Plant[];
    },
  });

  const { data: lines, isLoading } = useQuery({
    queryKey: ['admin-lines', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('lines')
        .select('*, plants(name), companies(name)')
        .order('name');
      
      // Filter by selected company if available
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; plant_id: string; company_id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('lines')
        .insert({ name: data.name, code: data.code || null, plant_id: data.plant_id, company_id: data.company_id, is_active: data.is_active });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lines'] });
      toast.success('Line created successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string; plant_id: string; company_id: string; is_active: boolean } }) => {
      const { error } = await supabase
        .from('lines')
        .update({ name: data.name, code: data.code || null, plant_id: data.plant_id, company_id: data.company_id, is_active: data.is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lines'] });
      toast.success('Line updated successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lines'] });
      toast.success('Line deleted successfully');
      setIsDeleteOpen(false);
      setDeletingLine(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingLine(null);
    setSelectedCompanyIdForForm(selectedCompanyId || companies?.[0]?.id || '');
    setFormData({ name: '', code: '', plant_id: '', company_id: selectedCompanyId || companies?.[0]?.id || '', is_active: true });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (line: Line) => {
    setEditingLine(line);
    setSelectedCompanyIdForForm(line.company_id);
    setFormData({ name: line.name, code: line.code || '', plant_id: line.plant_id, company_id: line.company_id, is_active: line.is_active });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLine(null);
    setSelectedCompanyIdForForm(selectedCompanyId || '');
    setFormData({ name: '', code: '', plant_id: '', company_id: selectedCompanyId || '', is_active: true });
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyIdForForm(companyId);
    setFormData({ ...formData, company_id: companyId, plant_id: '' });
  };

  const handleSubmit = () => {
    if (!formData.company_id) {
      toast.error('Company is required');
      return;
    }
    if (!formData.plant_id) {
      toast.error('Plant is required');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Line name is required');
      return;
    }
    if (editingLine) {
      updateMutation.mutate({ id: editingLine.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Lines</h3>
        <Button onClick={handleOpenCreate} size="sm" disabled={!companies?.length}>
          <Plus className="h-4 w-4 mr-2" />
          Add Line
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines?.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.name}</TableCell>
                <TableCell>{line.code || '-'}</TableCell>
                <TableCell>{(line.companies as { name: string } | null)?.name || '-'}</TableCell>
                <TableCell>{(line.plants as { name: string } | null)?.name || '-'}</TableCell>
                <TableCell>
                  <span className={line.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                    {line.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(line as Line)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingLine(line as Line); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {lines?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No lines found
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
            <DialogTitle>{editingLine ? 'Edit Line' : 'Add Line'}</DialogTitle>
            <DialogDescription>
              {editingLine ? 'Update line details' : 'Create a new production line'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_id">Company *</Label>
              <Select value={formData.company_id} onValueChange={handleCompanyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.code && `(${company.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plant_id">Plant *</Label>
              <Select 
                value={formData.plant_id} 
                onValueChange={(value) => setFormData({ ...formData, plant_id: value })}
                disabled={!formData.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.company_id ? "Select plant" : "Select company first"} />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., CNC Line 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., LINE-001"
              />
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
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLine ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingLine?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLine && deleteMutation.mutate(deletingLine.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
