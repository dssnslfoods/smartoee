import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users, Settings, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  created_at: string;
  machine_count?: number;
  user_count?: number;
}

interface Machine {
  id: string;
  name: string;
  code: string;
  line_name?: string;
}

export function PermissionGroupManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, company } = useAuth();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [machineDialogGroup, setMachineDialogGroup] = useState<PermissionGroup | null>(null);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '' });

  // Fetch permission groups
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('machine_permission_groups')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      
      if (error) throw error;

      // Get counts for each group
      const groupsWithCounts = await Promise.all(
        data.map(async (group) => {
          const [machineResult, userResult] = await Promise.all([
            supabase
              .from('machine_permission_group_machines')
              .select('id', { count: 'exact', head: true })
              .eq('group_id', group.id),
            supabase
              .from('user_permission_groups')
              .select('id', { count: 'exact', head: true })
              .eq('group_id', group.id),
          ]);
          
          return {
            ...group,
            machine_count: machineResult.count || 0,
            user_count: userResult.count || 0,
          };
        })
      );
      
      return groupsWithCounts as PermissionGroup[];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch all machines in the company
  const { data: machines = [] } = useQuery({
    queryKey: ['company-machines', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('machines')
        .select(`
          id,
          name,
          code,
          lines!inner(name, company_id)
        `)
        .eq('lines.company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data.map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        line_name: (m.lines as { name: string })?.name,
      })) as Machine[];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch machines in selected group
  const { data: groupMachineIds = [] } = useQuery({
    queryKey: ['group-machines', machineDialogGroup?.id],
    queryFn: async () => {
      if (!machineDialogGroup?.id) return [];
      
      const { data, error } = await supabase
        .from('machine_permission_group_machines')
        .select('machine_id')
        .eq('group_id', machineDialogGroup.id);
      
      if (error) throw error;
      return data.map(d => d.machine_id);
    },
    enabled: !!machineDialogGroup?.id,
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      if (!profile?.company_id) throw new Error('ไม่พบข้อมูลบริษัท');

      const { data, error } = await supabase
        .from('machine_permission_groups')
        .insert({
          name,
          description: description || null,
          company_id: profile.company_id,
          created_by: profile.user_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'สร้างกลุ่มเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      setIsAddDialogOpen(false);
      setNewGroupForm({ name: '', description: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('machine_permission_groups')
        .delete()
        .eq('id', groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ลบกลุ่มเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      setDeleteGroupId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Update group machines mutation
  const updateGroupMachinesMutation = useMutation({
    mutationFn: async ({ groupId, machineIds }: { groupId: string; machineIds: string[] }) => {
      // Delete existing
      await supabase
        .from('machine_permission_group_machines')
        .delete()
        .eq('group_id', groupId);
      
      // Insert new
      if (machineIds.length > 0) {
        const { error } = await supabase
          .from('machine_permission_group_machines')
          .insert(machineIds.map(machine_id => ({ group_id: groupId, machine_id })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'บันทึกเครื่องจักรเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-machines'] });
      setMachineDialogGroup(null);
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);

  // Update selectedMachineIds when group machines are loaded
  const handleOpenMachineDialog = (group: PermissionGroup) => {
    setMachineDialogGroup(group);
  };

  // Update selected machines when dialog opens
  const handleMachineIdsLoaded = () => {
    if (machineDialogGroup && groupMachineIds.length >= 0) {
      setSelectedMachineIds(groupMachineIds);
    }
  };

  // Toggle machine selection
  const toggleMachine = (machineId: string) => {
    setSelectedMachineIds(prev => 
      prev.includes(machineId) 
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณากรอกชื่อกลุ่ม', variant: 'destructive' });
      return;
    }
    createGroupMutation.mutate(newGroupForm);
  };

  const handleSaveMachines = () => {
    if (!machineDialogGroup) return;
    updateGroupMachinesMutation.mutate({
      groupId: machineDialogGroup.id,
      machineIds: selectedMachineIds,
    });
  };

  if (!company) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">ไม่พบข้อมูลบริษัท</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            จัดการกลุ่มสิทธิ์เครื่องจักร
          </CardTitle>
          <CardDescription>
            สร้างกลุ่มเพื่อกำหนดสิทธิ์เครื่องจักรและ assign ให้พนักงานหลายคนพร้อมกัน
          </CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          สร้างกลุ่มใหม่
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            ยังไม่มีกลุ่มสิทธิ์ในระบบ
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อกลุ่ม</TableHead>
                <TableHead>คำอธิบาย</TableHead>
                <TableHead className="text-center">เครื่องจักร</TableHead>
                <TableHead className="text-center">พนักงาน</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.description || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{group.machine_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{group.user_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenMachineDialog(group)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>กำหนดเครื่องจักร</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteGroupId(group.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ลบกลุ่ม</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Group Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างกลุ่มสิทธิ์ใหม่</DialogTitle>
            <DialogDescription>
              สร้างกลุ่มเพื่อกำหนดสิทธิ์การเข้าถึงเครื่องจักรสำหรับพนักงาน
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">ชื่อกลุ่ม</Label>
                <Input
                  id="groupName"
                  value={newGroupForm.name}
                  onChange={(e) => setNewGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="เช่น ทีม A, กะเช้า"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">คำอธิบาย (ไม่บังคับ)</Label>
                <Input
                  id="description"
                  value={newGroupForm.description}
                  onChange={(e) => setNewGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Machine Assignment Dialog */}
      <Dialog 
        open={!!machineDialogGroup} 
        onOpenChange={() => setMachineDialogGroup(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>กำหนดเครื่องจักรสำหรับ "{machineDialogGroup?.name}"</DialogTitle>
            <DialogDescription>
              เลือกเครื่องจักรที่ต้องการให้กลุ่มนี้มีสิทธิ์เข้าถึง
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {machines.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">ไม่พบเครื่องจักรในระบบ</p>
            ) : (
              <div className="space-y-2">
                {machines.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleMachine(machine.id)}
                  >
                    <Checkbox
                      checked={selectedMachineIds.includes(machine.id)}
                      onCheckedChange={() => toggleMachine(machine.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{machine.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {machine.code} • {machine.line_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                เลือก {selectedMachineIds.length} เครื่อง
              </span>
            </div>
            <Button variant="outline" onClick={() => setMachineDialogGroup(null)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSaveMachines}
              disabled={updateGroupMachinesMutation.isPending}
            >
              {updateGroupMachinesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่มนี้? พนักงานที่อยู่ในกลุ่มจะสูญเสียสิทธิ์การเข้าถึงเครื่องจักรที่กำหนดไว้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteGroupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'ลบ'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
