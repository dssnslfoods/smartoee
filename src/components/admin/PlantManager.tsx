import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

interface Company {
  id: string;
  name: string;
  code: string | null;
}

interface Plant {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  company_id: string | null;
  companies?: Company | null;
}

export function PlantManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [deletingPlant, setDeletingPlant] = useState<Plant | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', is_active: true, company_id: '' });

  // Fetch companies for dropdown
  const { data: companies } = useQuery({
    queryKey: ['admin-companies-dropdown'],
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

  const { data: plants, isLoading } = useQuery({
    queryKey: ['admin-plants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plants')
        .select('*, companies(id, name, code)')
        .order('name');
      if (error) throw error;
      return data as Plant[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; is_active: boolean; company_id: string }) => {
      const { error } = await supabase
        .from('plants')
        .insert({ 
          name: data.name, 
          code: data.code || null, 
          is_active: data.is_active,
          company_id: data.company_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plants'] });
      toast.success('Plant created successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string; is_active: boolean; company_id: string } }) => {
      const { error } = await supabase
        .from('plants')
        .update({ 
          name: data.name, 
          code: data.code || null, 
          is_active: data.is_active,
          company_id: data.company_id || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plants'] });
      toast.success('Plant updated successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plants'] });
      toast.success('Plant deleted successfully');
      setIsDeleteOpen(false);
      setDeletingPlant(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingPlant(null);
    setFormData({ name: '', code: '', is_active: true, company_id: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setFormData({ 
      name: plant.name, 
      code: plant.code || '', 
      is_active: plant.is_active,
      company_id: plant.company_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlant(null);
    setFormData({ name: '', code: '', is_active: true, company_id: '' });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Plant name is required');
      return;
    }
    if (editingPlant) {
      updateMutation.mutate({ id: editingPlant.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Plants</h3>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Plant
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
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plants?.map((plant) => (
              <TableRow key={plant.id}>
                <TableCell className="font-medium">{plant.name}</TableCell>
                <TableCell>{plant.code || '-'}</TableCell>
                <TableCell>
                  {plant.companies ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{plant.companies.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={plant.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                    {plant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(plant)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingPlant(plant); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {plants?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No plants found
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
            <DialogTitle>{editingPlant ? 'Edit Plant' : 'Add Plant'}</DialogTitle>
            <DialogDescription>
              {editingPlant ? 'Update plant details' : 'Create a new plant'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Factory"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., PLT-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select 
                value={formData.company_id || "__none__"} 
                onValueChange={(v) => setFormData({ ...formData, company_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.code && `(${company.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {editingPlant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPlant?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPlant && deleteMutation.mutate(deletingPlant.id)}
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
