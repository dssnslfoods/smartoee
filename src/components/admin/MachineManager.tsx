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

interface Machine {
  id: string;
  name: string;
  code: string;
  line_id: string;
  company_id: string;
  ideal_cycle_time_seconds: number;
  is_active: boolean;
}

interface Line {
  id: string;
  name: string;
  plant_id: string;
  company_id: string;
  plants: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

export function MachineManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    line_id: '', 
    company_id: '',
    ideal_cycle_time_seconds: 60, 
    is_active: true 
  });
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

  const { data: lines } = useQuery({
    queryKey: ['admin-lines-lookup', selectedCompanyIdForForm || selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('lines')
        .select('id, name, plant_id, company_id, plants(name)')
        .eq('is_active', true)
        .order('name');
      
      const companyToFilter = selectedCompanyIdForForm || selectedCompanyId;
      if (companyToFilter) {
        query = query.eq('company_id', companyToFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Line[];
    },
  });

  const { data: machines, isLoading } = useQuery({
    queryKey: ['admin-machines', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('machines')
        .select('*, lines(name, plants(name)), companies(name)')
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
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('machines')
        .insert({ 
          name: data.name, 
          code: data.code, 
          line_id: data.line_id, 
          company_id: data.company_id,
          ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
          is_active: data.is_active 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] });
      toast.success('Machine created successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('machines')
        .update({ 
          name: data.name, 
          code: data.code, 
          line_id: data.line_id,
          company_id: data.company_id, 
          ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
          is_active: data.is_active 
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] });
      toast.success('Machine updated successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('machines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] });
      toast.success('Machine deleted successfully');
      setIsDeleteOpen(false);
      setDeletingMachine(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingMachine(null);
    setSelectedCompanyIdForForm(selectedCompanyId || companies?.[0]?.id || '');
    setFormData({ name: '', code: '', line_id: '', company_id: selectedCompanyId || companies?.[0]?.id || '', ideal_cycle_time_seconds: 60, is_active: true });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setSelectedCompanyIdForForm(machine.company_id);
    setFormData({ 
      name: machine.name, 
      code: machine.code, 
      line_id: machine.line_id, 
      company_id: machine.company_id,
      ideal_cycle_time_seconds: machine.ideal_cycle_time_seconds,
      is_active: machine.is_active 
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMachine(null);
    setSelectedCompanyIdForForm(selectedCompanyId || '');
    setFormData({ name: '', code: '', line_id: '', company_id: selectedCompanyId || '', ideal_cycle_time_seconds: 60, is_active: true });
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyIdForForm(companyId);
    setFormData({ ...formData, company_id: companyId, line_id: '' });
  };

  const handleSubmit = () => {
    if (!formData.company_id) {
      toast.error('Company is required');
      return;
    }
    if (!formData.line_id) {
      toast.error('Line is required');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Machine name is required');
      return;
    }
    if (!formData.code.trim()) {
      toast.error('Machine code is required');
      return;
    }
    if (editingMachine) {
      updateMutation.mutate({ id: editingMachine.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Machines</h3>
        <Button onClick={handleOpenCreate} size="sm" disabled={!companies?.length}>
          <Plus className="h-4 w-4 mr-2" />
          Add Machine
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
              <TableHead>Line</TableHead>
              <TableHead>Cycle Time (s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines?.map((machine) => {
              const line = machine.lines as { name: string; plants: { name: string } | null } | null;
              const company = machine.companies as { name: string } | null;
              return (
                <TableRow key={machine.id}>
                  <TableCell className="font-medium">{machine.name}</TableCell>
                  <TableCell>{machine.code}</TableCell>
                  <TableCell>{company?.name || '-'}</TableCell>
                  <TableCell>
                    {line?.name} ({line?.plants?.name || '-'})
                  </TableCell>
                  <TableCell>{machine.ideal_cycle_time_seconds}</TableCell>
                  <TableCell>
                    <span className={machine.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                      {machine.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(machine as Machine)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingMachine(machine as Machine); setIsDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {machines?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No machines found
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
            <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
            <DialogDescription>
              {editingMachine ? 'Update machine details' : 'Create a new machine'}
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
              <Label htmlFor="line_id">Line *</Label>
              <Select 
                value={formData.line_id} 
                onValueChange={(value) => setFormData({ ...formData, line_id: value })}
                disabled={!formData.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.company_id ? "Select line" : "Select company first"} />
                </SelectTrigger>
                <SelectContent>
                  {lines?.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name} ({line.plants?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CNC Machine 01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CNC-001"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle_time">Ideal Cycle Time (seconds)</Label>
              <Input
                id="cycle_time"
                type="number"
                min="1"
                value={formData.ideal_cycle_time_seconds}
                onChange={(e) => setFormData({ ...formData, ideal_cycle_time_seconds: parseInt(e.target.value) || 60 })}
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
              {editingMachine ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMachine?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMachine && deleteMutation.mutate(deletingMachine.id)}
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
