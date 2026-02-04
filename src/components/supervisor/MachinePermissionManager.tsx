import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Machine {
  id: string;
  name: string;
  code: string;
  line_id: string;
  line?: {
    name: string;
    plant?: {
      name: string;
    };
  };
}

interface MachinePermission {
  id: string;
  machine_id: string;
  user_id: string;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  machine_count?: number;
}

interface UserPermissionGroup {
  id: string;
  group_id: string;
  user_id: string;
}

interface MachinePermissionManagerProps {
  staffUserId: string;
  staffName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MachinePermissionManager({
  staffUserId,
  staffName,
  isOpen,
  onClose,
}: MachinePermissionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('groups');

  // Fetch machines in supervisor's company
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['company-machines', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('machines')
        .select(`
          id,
          name,
          code,
          line_id,
          lines!inner (
            name,
            plants!inner (
              name
            )
          )
        `)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      return data.map((m: any) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        line_id: m.line_id,
        line: {
          name: m.lines?.name,
          plant: {
            name: m.lines?.plants?.name,
          },
        },
      })) as Machine[];
    },
    enabled: !!profile?.company_id && isOpen,
  });

  // Fetch permission groups
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['permission-groups', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('machine_permission_groups')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      
      if (error) throw error;

      // Get machine counts
      const groupsWithCounts = await Promise.all(
        data.map(async (group) => {
          const { count } = await supabase
            .from('machine_permission_group_machines')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return { ...group, machine_count: count || 0 };
        })
      );
      
      return groupsWithCounts as PermissionGroup[];
    },
    enabled: !!profile?.company_id && isOpen,
  });

  // Fetch current direct permissions for this staff
  const { data: currentPermissions = [], isLoading: loadingPermissions } = useQuery({
    queryKey: ['staff-machine-permissions', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_machine_permissions')
        .select('*')
        .eq('user_id', staffUserId);
      
      if (error) throw error;
      return data as MachinePermission[];
    },
    enabled: !!staffUserId && isOpen,
  });

  // Fetch current group assignments for this staff
  const { data: currentGroupAssignments = [], isLoading: loadingGroupAssignments } = useQuery({
    queryKey: ['staff-group-assignments', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permission_groups')
        .select('*')
        .eq('user_id', staffUserId);
      
      if (error) throw error;
      return data as UserPermissionGroup[];
    },
    enabled: !!staffUserId && isOpen,
  });

  // Initialize selections when data loads
  useEffect(() => {
    if (!loadingPermissions && currentPermissions.length >= 0) {
      setSelectedMachines(new Set(currentPermissions.map(p => p.machine_id)));
    }
  }, [currentPermissions, loadingPermissions]);

  useEffect(() => {
    if (!loadingGroupAssignments && currentGroupAssignments.length >= 0) {
      setSelectedGroups(new Set(currentGroupAssignments.map(g => g.group_id)));
    }
  }, [currentGroupAssignments, loadingGroupAssignments]);

  // Save permissions mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save direct machine permissions
      const currentMachineIds = new Set(currentPermissions.map(p => p.machine_id));
      const machinesToAdd = [...selectedMachines].filter(id => !currentMachineIds.has(id));
      const machinesToRemove = currentPermissions.filter(p => !selectedMachines.has(p.machine_id));

      if (machinesToRemove.length > 0) {
        const { error } = await supabase
          .from('user_machine_permissions')
          .delete()
          .in('id', machinesToRemove.map(p => p.id));
        if (error) throw error;
      }

      if (machinesToAdd.length > 0) {
        const { error } = await supabase
          .from('user_machine_permissions')
          .insert(machinesToAdd.map(machine_id => ({
            user_id: staffUserId,
            machine_id,
          })));
        if (error) throw error;
      }

      // Save group assignments
      const currentGroupIds = new Set(currentGroupAssignments.map(g => g.group_id));
      const groupsToAdd = [...selectedGroups].filter(id => !currentGroupIds.has(id));
      const groupsToRemove = currentGroupAssignments.filter(g => !selectedGroups.has(g.group_id));

      if (groupsToRemove.length > 0) {
        const { error } = await supabase
          .from('user_permission_groups')
          .delete()
          .in('id', groupsToRemove.map(g => g.id));
        if (error) throw error;
      }

      if (groupsToAdd.length > 0) {
        const { error } = await supabase
          .from('user_permission_groups')
          .insert(groupsToAdd.map(group_id => ({
            user_id: staffUserId,
            group_id,
          })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'บันทึกสิทธิเครื่องจักรเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['staff-machine-permissions', staffUserId] });
      queryClient.invalidateQueries({ queryKey: ['staff-group-assignments', staffUserId] });
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMachine = (machineId: string) => {
    const newSet = new Set(selectedMachines);
    if (newSet.has(machineId)) {
      newSet.delete(machineId);
    } else {
      newSet.add(machineId);
    }
    setSelectedMachines(newSet);
  };

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(selectedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setSelectedGroups(newSet);
  };

  const selectAllMachines = () => setSelectedMachines(new Set(machines.map(m => m.id)));
  const deselectAllMachines = () => setSelectedMachines(new Set());
  const selectAllGroups = () => setSelectedGroups(new Set(groups.map(g => g.id)));
  const deselectAllGroups = () => setSelectedGroups(new Set());

  const isLoading = loadingMachines || loadingPermissions || loadingGroups || loadingGroupAssignments;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            กำหนดสิทธิเครื่องจักร
          </DialogTitle>
          <DialogDescription>
            กำหนดสิทธิ์การเข้าถึงเครื่องจักรสำหรับ <span className="font-medium">{staffName}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="groups">
                กลุ่มสิทธิ์ ({selectedGroups.size})
              </TabsTrigger>
              <TabsTrigger value="direct">
                เครื่องจักรโดยตรง ({selectedMachines.size})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-3">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีกลุ่มสิทธิ์ในระบบ<br />
                  <span className="text-sm">สร้างกลุ่มได้ที่แท็บ "จัดการกลุ่มสิทธิ์"</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      เลือก {selectedGroups.size} / {groups.length} กลุ่ม
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllGroups}>
                        เลือกทั้งหมด
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllGroups}>
                        ยกเลิกทั้งหมด
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[250px] border rounded-md p-3">
                    <div className="space-y-2">
                      {groups.map((group) => (
                        <label
                          key={group.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedGroups.has(group.id)}
                            onCheckedChange={() => toggleGroup(group.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {group.machine_count} เครื่องจักร
                              {group.description && ` • ${group.description}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            <TabsContent value="direct" className="space-y-3">
              {machines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่พบเครื่องจักรในบริษัท
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      เลือก {selectedMachines.size} / {machines.length} เครื่อง
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllMachines}>
                        เลือกทั้งหมด
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllMachines}>
                        ยกเลิกทั้งหมด
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[250px] border rounded-md p-3">
                    <div className="space-y-2">
                      {machines.map((machine) => (
                        <label
                          key={machine.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedMachines.has(machine.id)}
                            onCheckedChange={() => toggleMachine(machine.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{machine.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {machine.line?.plant?.name} / {machine.line?.name} • {machine.code}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
