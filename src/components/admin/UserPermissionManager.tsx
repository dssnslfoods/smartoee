import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Factory, Layers, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  company_id: string | null;
}

interface PlantPermission {
  id: string;
  user_id: string;
  plant_id: string;
  plants?: { name: string };
}

interface LinePermission {
  id: string;
  user_id: string;
  line_id: string;
  lines?: { name: string; plants?: { name: string } };
}

interface MachinePermission {
  id: string;
  user_id: string;
  machine_id: string;
  machines?: { name: string; lines?: { name: string } };
}

export function UserPermissionManager() {
  const queryClient = useQueryClient();
  const { company, isAdmin } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'plant' | 'line' | 'machine'; id: string } | null>(null);
  const [permType, setPermType] = useState<'plant' | 'line' | 'machine'>('plant');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  // Company ID for scoping: Admin uses selected company, Supervisor uses own company
  const scopeCompanyId = company?.id;

  // Fetch users - scoped by company for Supervisors
  const { data: users } = useQuery({
    queryKey: ['admin-users', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('full_name');
      
      // Supervisor sees only users in their company
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Fetch entities for dropdown - scoped by company
  const { data: plants } = useQuery({
    queryKey: ['admin-plants-perm', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('plants').select('id, name, company_id').eq('is_active', true).order('name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ['admin-lines-perm', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('lines').select('id, name, company_id, plants(name)').eq('is_active', true).order('name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ['admin-machines-perm', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('machines').select('id, name, company_id, lines(name)').eq('is_active', true).order('name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch permissions for selected user
  const { data: plantPerms, isLoading: loadingPlantPerms } = useQuery({
    queryKey: ['user-plant-perms', selectedUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_plant_permissions')
        .select('*, plants(name)')
        .eq('user_id', selectedUserId);
      if (error) throw error;
      return data as PlantPermission[];
    },
    enabled: !!selectedUserId,
  });

  const { data: linePerms, isLoading: loadingLinePerms } = useQuery({
    queryKey: ['user-line-perms', selectedUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_line_permissions')
        .select('*, lines(name, plants(name))')
        .eq('user_id', selectedUserId);
      if (error) throw error;
      return data as LinePermission[];
    },
    enabled: !!selectedUserId,
  });

  const { data: machinePerms, isLoading: loadingMachinePerms } = useQuery({
    queryKey: ['user-machine-perms', selectedUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_machine_permissions')
        .select('*, machines(name, lines(name))')
        .eq('user_id', selectedUserId);
      if (error) throw error;
      return data as MachinePermission[];
    },
    enabled: !!selectedUserId,
  });

  // Add permission mutations
  const addPlantPerm = useMutation({
    mutationFn: async (plantId: string) => {
      const { error } = await supabase.from('user_plant_permissions').insert({ user_id: selectedUserId, plant_id: plantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-plant-perms', selectedUserId] });
      toast.success('Plant permission added');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addLinePerm = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from('user_line_permissions').insert({ user_id: selectedUserId, line_id: lineId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-line-perms', selectedUserId] });
      toast.success('Line permission added');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMachinePerm = useMutation({
    mutationFn: async (machineId: string) => {
      const { error } = await supabase.from('user_machine_permissions').insert({ user_id: selectedUserId, machine_id: machineId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-machine-perms', selectedUserId] });
      toast.success('Machine permission added');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete permission mutations
  const deletePlantPerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_plant_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-plant-perms', selectedUserId] });
      toast.success('Permission removed');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLinePerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_line_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-line-perms', selectedUserId] });
      toast.success('Permission removed');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMachinePerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_machine_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-machine-perms', selectedUserId] });
      toast.success('Permission removed');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenAddDialog = (type: 'plant' | 'line' | 'machine') => {
    setPermType(type);
    setSelectedEntityId('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedEntityId('');
  };

  const handleAddPermission = () => {
    if (!selectedEntityId) {
      toast.error('Please select an item');
      return;
    }
    if (permType === 'plant') addPlantPerm.mutate(selectedEntityId);
    else if (permType === 'line') addLinePerm.mutate(selectedEntityId);
    else addMachinePerm.mutate(selectedEntityId);
  };

  const handleDeletePermission = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'plant') deletePlantPerm.mutate(deleteConfirm.id);
    else if (deleteConfirm.type === 'line') deleteLinePerm.mutate(deleteConfirm.id);
    else deleteMachinePerm.mutate(deleteConfirm.id);
  };

  const selectedUser = users?.find(u => u.user_id === selectedUserId);
  const isLoading = loadingPlantPerms || loadingLinePerms || loadingMachinePerms;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">User Permissions</h3>
      </div>

      {/* User Selector */}
      <div className="space-y-2">
        <Label>Select User</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a user to manage permissions" />
          </SelectTrigger>
          <SelectContent>
            {users?.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.full_name} <span className="text-muted-foreground">({user.role})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedUserId && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedUser?.full_name}</span>
            <Badge variant="outline">{selectedUser?.role}</Badge>
          </div>

          <Tabs defaultValue="plant">
            <TabsList>
              <TabsTrigger value="plant" className="gap-2">
                <Factory className="h-4 w-4" />
                Plants ({plantPerms?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="line" className="gap-2">
                <Layers className="h-4 w-4" />
                Lines ({linePerms?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="machine" className="gap-2">
                <Cpu className="h-4 w-4" />
                Machines ({machinePerms?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plant" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleOpenAddDialog('plant')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plant
                </Button>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plant</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plantPerms?.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell>{perm.plants?.name}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: 'plant', id: perm.id })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plantPerms?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                          No plant permissions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="line" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleOpenAddDialog('line')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Plant</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linePerms?.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell>{perm.lines?.name}</TableCell>
                      <TableCell>{perm.lines?.plants?.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: 'line', id: perm.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {linePerms?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No line permissions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="machine" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleOpenAddDialog('machine')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Machine
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machinePerms?.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell>{perm.machines?.name}</TableCell>
                      <TableCell>{perm.machines?.lines?.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: 'machine', id: perm.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {machinePerms?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No machine permissions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!selectedUserId && (
        <div className="text-center text-muted-foreground py-12">
          Select a user to manage their permissions
        </div>
      )}

      {/* Add Permission Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {permType.charAt(0).toUpperCase() + permType.slice(1)} Permission</DialogTitle>
            <DialogDescription>
              Grant access to {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select {permType}</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${permType}`} />
                </SelectTrigger>
                <SelectContent>
                  {permType === 'plant' && plants?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  {permType === 'line' && lines?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({(l.plants as { name: string } | null)?.name})
                    </SelectItem>
                  ))}
                  {permType === 'machine' && machines?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({(m.lines as { name: string } | null)?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleAddPermission} disabled={!selectedEntityId}>
              Add Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this permission? The user will lose access to this resource.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePermission}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
