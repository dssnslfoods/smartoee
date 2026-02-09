import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, Cpu, CheckSquare, Square, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StaffPermissionDialogProps {
  staffUserId: string;
  staffName: string;
  isOpen: boolean;
  onClose: () => void;
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

export function StaffPermissionDialog({ staffUserId, staffName, isOpen, onClose }: StaffPermissionDialogProps) {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const scopeCompanyId = company?.id;

  const [activeTab, setActiveTab] = useState('permissions');

  // Filter state
  const [filterPlantId, setFilterPlantId] = useState<string>('all');
  const [filterLineId, setFilterLineId] = useState<string>('all');

  // Group selection state
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [groupsDirty, setGroupsDirty] = useState(false);

  // ─── Data queries ───
  const { data: plants = [] } = useQuery({
    queryKey: ['perm-plants', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('plants').select('id, name').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  const { data: allLines = [] } = useQuery({
    queryKey: ['perm-lines', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lines').select('id, name, plant_id').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  const { data: allMachines = [] } = useQuery({
    queryKey: ['perm-machines', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('id, name, code, line_id').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  // ─── Current permissions (machine-level only for the new UI) ───
  const { data: machinePerms = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['user-machine-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_machine_permissions').select('id, machine_id').eq('user_id', staffUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!staffUserId && isOpen,
  });

  const { data: plantPerms = [] } = useQuery({
    queryKey: ['user-plant-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_plant_permissions').select('id, plant_id').eq('user_id', staffUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!staffUserId && isOpen,
  });

  const { data: linePerms = [] } = useQuery({
    queryKey: ['user-line-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_line_permissions').select('id, line_id').eq('user_id', staffUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!staffUserId && isOpen,
  });

  // ─── Permission groups ───
  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups', scopeCompanyId],
    queryFn: async () => {
      if (!scopeCompanyId) return [];
      const { data, error } = await supabase.from('machine_permission_groups').select('*').eq('company_id', scopeCompanyId).order('name');
      if (error) throw error;
      const groupsWithCounts = await Promise.all(
        data.map(async (group) => {
          const { count } = await supabase.from('machine_permission_group_machines').select('id', { count: 'exact', head: true }).eq('group_id', group.id);
          return { ...group, machine_count: count || 0 };
        })
      );
      return groupsWithCounts as PermissionGroup[];
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  const { data: currentGroupAssignments = [], isLoading: loadingGroupAssignments } = useQuery({
    queryKey: ['staff-group-assignments', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_permission_groups').select('*').eq('user_id', staffUserId);
      if (error) throw error;
      return data as UserPermissionGroup[];
    },
    enabled: !!staffUserId && isOpen,
  });

  useEffect(() => {
    if (!loadingGroupAssignments && currentGroupAssignments.length >= 0) {
      setSelectedGroups(new Set(currentGroupAssignments.map(g => g.group_id)));
      setGroupsDirty(false);
    }
  }, [currentGroupAssignments, loadingGroupAssignments]);

  // ─── Build permission sets for quick lookup ───
  const permittedMachineIds = useMemo(() => new Set(machinePerms.map(p => p.machine_id)), [machinePerms]);
  const permittedPlantIds = useMemo(() => new Set(plantPerms.map(p => p.plant_id)), [plantPerms]);
  const permittedLineIds = useMemo(() => new Set(linePerms.map(p => p.line_id)), [linePerms]);

  // Build a lookup: lineId -> plantId
  const lineToPlant = useMemo(() => {
    const map: Record<string, string> = {};
    allLines.forEach(l => { map[l.id] = l.plant_id; });
    return map;
  }, [allLines]);

  // Build a lookup: machineId -> lineId
  const machineToLine = useMemo(() => {
    const map: Record<string, string> = {};
    allMachines.forEach(m => { map[m.id] = m.line_id; });
    return map;
  }, [allMachines]);

  // Check if a machine is permitted (through any level)
  const isMachinePermitted = useCallback((machineId: string) => {
    if (permittedMachineIds.has(machineId)) return true;
    const lineId = machineToLine[machineId];
    if (lineId && permittedLineIds.has(lineId)) return true;
    const plantId = lineId ? lineToPlant[lineId] : undefined;
    if (plantId && permittedPlantIds.has(plantId)) return true;
    return false;
  }, [permittedMachineIds, permittedLineIds, permittedPlantIds, machineToLine, lineToPlant]);

  // Get the permission source for display
  const getPermSource = useCallback((machineId: string): 'machine' | 'line' | 'plant' | null => {
    if (permittedMachineIds.has(machineId)) return 'machine';
    const lineId = machineToLine[machineId];
    if (lineId && permittedLineIds.has(lineId)) return 'line';
    const plantId = lineId ? lineToPlant[lineId] : undefined;
    if (plantId && permittedPlantIds.has(plantId)) return 'plant';
    return null;
  }, [permittedMachineIds, permittedLineIds, permittedPlantIds, machineToLine, lineToPlant]);

  // ─── Filtered lines and machines ───
  const filteredLines = useMemo(() => {
    if (filterPlantId === 'all') return allLines;
    return allLines.filter(l => l.plant_id === filterPlantId);
  }, [filterPlantId, allLines]);

  const filteredMachines = useMemo(() => {
    let machines = allMachines;
    if (filterPlantId !== 'all') {
      const lineIdsInPlant = new Set(allLines.filter(l => l.plant_id === filterPlantId).map(l => l.id));
      machines = machines.filter(m => lineIdsInPlant.has(m.line_id));
    }
    if (filterLineId !== 'all') {
      machines = machines.filter(m => m.line_id === filterLineId);
    }
    return machines;
  }, [filterPlantId, filterLineId, allMachines, allLines]);

  // Group machines by line for display
  const machinesByLine = useMemo(() => {
    const map: Record<string, typeof filteredMachines> = {};
    filteredMachines.forEach(m => {
      if (!map[m.line_id]) map[m.line_id] = [];
      map[m.line_id].push(m);
    });
    return map;
  }, [filteredMachines]);

  const linesForDisplay = useMemo(() => {
    const lineIds = Object.keys(machinesByLine);
    return allLines.filter(l => lineIds.includes(l.id));
  }, [machinesByLine, allLines]);

  // ─── Mutations ───
  const addMachinePermMutation = useMutation({
    mutationFn: async (machineId: string) => {
      const { error } = await supabase.from('user_machine_permissions').insert({ user_id: staffUserId, machine_id: machineId });
      if (error) throw error;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMachinePermMutation = useMutation({
    mutationFn: async (machineId: string) => {
      const perm = machinePerms.find(p => p.machine_id === machineId);
      if (!perm) return;
      const { error } = await supabase.from('user_machine_permissions').delete().eq('id', perm.id);
      if (error) throw error;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Bulk mutations
  const bulkAddMutation = useMutation({
    mutationFn: async (machineIds: string[]) => {
      const inserts = machineIds.map(machine_id => ({ user_id: staffUserId, machine_id }));
      const { error } = await supabase.from('user_machine_permissions').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePerms();
      toast.success('เพิ่มสิทธิ์สำเร็จ');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (machineIds: string[]) => {
      const permIds = machinePerms.filter(p => machineIds.includes(p.machine_id)).map(p => p.id);
      if (permIds.length === 0) return;
      const { error } = await supabase.from('user_machine_permissions').delete().in('id', permIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePerms();
      toast.success('ลบสิทธิ์สำเร็จ');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveGroupsMutation = useMutation({
    mutationFn: async () => {
      const currentGroupIds = new Set(currentGroupAssignments.map(g => g.group_id));
      const groupsToAdd = [...selectedGroups].filter(id => !currentGroupIds.has(id));
      const groupsToRemove = currentGroupAssignments.filter(g => !selectedGroups.has(g.group_id));

      if (groupsToRemove.length > 0) {
        const { error } = await supabase.from('user_permission_groups').delete().in('id', groupsToRemove.map(g => g.id));
        if (error) throw error;
      }
      if (groupsToAdd.length > 0) {
        const { error } = await supabase.from('user_permission_groups').insert(groupsToAdd.map(group_id => ({ user_id: staffUserId, group_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('บันทึกกลุ่มสิทธิ์แล้ว');
      queryClient.invalidateQueries({ queryKey: ['staff-group-assignments', staffUserId] });
      setGroupsDirty(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invalidatePerms = () => {
    queryClient.invalidateQueries({ queryKey: ['user-plant-perms', staffUserId] });
    queryClient.invalidateQueries({ queryKey: ['user-line-perms', staffUserId] });
    queryClient.invalidateQueries({ queryKey: ['user-machine-perms', staffUserId] });
  };

  // ─── Toggle handlers ───
  const handleToggleMachine = async (machineId: string) => {
    const source = getPermSource(machineId);
    if (source === 'plant' || source === 'line') {
      // Can't toggle inherited permissions from here
      toast.info('สิทธิ์นี้ได้รับจากระดับ ' + (source === 'plant' ? 'Plant' : 'Line'));
      return;
    }
    if (permittedMachineIds.has(machineId)) {
      await deleteMachinePermMutation.mutateAsync(machineId);
    } else {
      await addMachinePermMutation.mutateAsync(machineId);
    }
    invalidatePerms();
  };

  const handleSelectAllVisible = () => {
    const toAdd = filteredMachines
      .filter(m => !isMachinePermitted(m.id))
      .map(m => m.id);
    if (toAdd.length === 0) {
      toast.info('เครื่องจักรทั้งหมดมีสิทธิ์แล้ว');
      return;
    }
    bulkAddMutation.mutate(toAdd);
  };

  const handleDeselectAllVisible = () => {
    // Only remove direct machine-level permissions
    const toRemove = filteredMachines
      .filter(m => permittedMachineIds.has(m.id))
      .map(m => m.id);
    if (toRemove.length === 0) {
      toast.info('ไม่มีสิทธิ์ระดับ Machine ที่จะลบ');
      return;
    }
    bulkDeleteMutation.mutate(toRemove);
  };

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(selectedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId); else newSet.add(groupId);
    setSelectedGroups(newSet);
    setGroupsDirty(true);
  };

  // Stats
  const totalPermitted = allMachines.filter(m => isMachinePermitted(m.id)).length;
  const visiblePermitted = filteredMachines.filter(m => isMachinePermitted(m.id)).length;
  const isBusy = bulkAddMutation.isPending || bulkDeleteMutation.isPending || addMachinePermMutation.isPending || deleteMachinePermMutation.isPending;

  // Reset filters when plant changes
  useEffect(() => {
    setFilterLineId('all');
  }, [filterPlantId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            กำหนดสิทธิ์ — {staffName}
          </DialogTitle>
          <DialogDescription>
            เลือกเครื่องจักรที่ต้องการให้สิทธิ์ หรือจัดการกลุ่มสิทธิ์
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions">
              เครื่องจักร ({totalPermitted}/{allMachines.length})
            </TabsTrigger>
            <TabsTrigger value="groups">
              กลุ่มสิทธิ์ ({selectedGroups.size})
            </TabsTrigger>
          </TabsList>

          {/* ─── Permissions Tab ─── */}
          <TabsContent value="permissions" className="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterPlantId} onValueChange={setFilterPlantId}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="ทุก Plant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Plant</SelectItem>
                  {plants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterLineId} onValueChange={setFilterLineId} disabled={filterPlantId === 'all'}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="ทุก Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Line</SelectItem>
                  {filteredLines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {(filterPlantId !== 'all' || filterLineId !== 'all') && (
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setFilterPlantId('all'); setFilterLineId('all'); }}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  ล้างตัวกรอง
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {visiblePermitted}/{filteredMachines.length} เครื่องมีสิทธิ์
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSelectAllVisible} disabled={isBusy}>
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  เลือกทั้งหมด
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDeselectAllVisible} disabled={isBusy}>
                  <Square className="h-3.5 w-3.5 mr-1" />
                  ยกเลิกทั้งหมด
                </Button>
              </div>
            </div>

            <Separator />

            {/* Machine list */}
            {loadingPerms ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-3">
                  {linesForDisplay.map((line) => {
                    const linePlant = plants.find(p => p.id === line.plant_id);
                    const machines = machinesByLine[line.id] || [];
                    const lineAllPermitted = machines.every(m => isMachinePermitted(m.id));
                    const lineSomePermitted = machines.some(m => isMachinePermitted(m.id));
                    const isLineInherited = permittedPlantIds.has(line.plant_id) || permittedLineIds.has(line.id);

                    return (
                      <div key={line.id} className="space-y-1">
                        {/* Line header */}
                        <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50">
                          <Checkbox
                            checked={lineAllPermitted}
                            // Show indeterminate when partially selected
                            {...(!lineAllPermitted && lineSomePermitted ? { 'data-state': 'indeterminate' } : {})}
                            onCheckedChange={(checked) => {
                              if (isLineInherited) {
                                toast.info('สิทธิ์ Line นี้สืบทอดจากระดับ Plant/Line');
                                return;
                              }
                              if (checked) {
                                const toAdd = machines.filter(m => !isMachinePermitted(m.id)).map(m => m.id);
                                if (toAdd.length > 0) bulkAddMutation.mutate(toAdd);
                              } else {
                                const toRemove = machines.filter(m => permittedMachineIds.has(m.id)).map(m => m.id);
                                if (toRemove.length > 0) bulkDeleteMutation.mutate(toRemove);
                              }
                            }}
                            disabled={isBusy}
                          />
                          <span className="font-medium text-sm">{line.name}</span>
                          {linePlant && <span className="text-xs text-muted-foreground">({linePlant.name})</span>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {machines.filter(m => isMachinePermitted(m.id)).length}/{machines.length}
                          </span>
                        </div>

                        {/* Machines */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-6">
                          {machines.map((machine) => {
                            const permitted = isMachinePermitted(machine.id);
                            const source = getPermSource(machine.id);
                            const isInherited = source === 'plant' || source === 'line';

                            return (
                              <label
                                key={machine.id}
                                className={cn(
                                  'flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm',
                                  permitted ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted',
                                  isInherited && 'opacity-70 cursor-default'
                                )}
                              >
                                <Checkbox
                                  checked={permitted}
                                  onCheckedChange={() => handleToggleMachine(machine.id)}
                                  disabled={isBusy || isInherited}
                                />
                                <Cpu className={cn('h-4 w-4 shrink-0', permitted ? 'text-primary' : 'text-muted-foreground')} />
                                <span className="flex-1 truncate">{machine.name}</span>
                                <span className="text-xs text-muted-foreground">{machine.code}</span>
                                {isInherited && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                    {source === 'plant' ? 'Plant' : 'Line'}
                                  </Badge>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {filteredMachines.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      ไม่พบเครื่องจักรตามเงื่อนไขที่กรอง
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ─── Groups Tab ─── */}
          <TabsContent value="groups" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีกลุ่มสิทธิ์ในระบบ<br />
                <span className="text-sm">สร้างกลุ่มได้ที่แท็บ "กลุ่มสิทธิ์"</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    เลือก {selectedGroups.size} / {groups.length} กลุ่ม
                  </span>
                </div>
                <ScrollArea className="flex-1 border rounded-md p-3">
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <label key={group.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                        <Checkbox checked={selectedGroups.has(group.id)} onCheckedChange={() => toggleGroup(group.id)} />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{group.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.machine_count} เครื่องจักร
                            {group.description && ` • ${group.description}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                {groupsDirty && (
                  <Button size="sm" onClick={() => saveGroupsMutation.mutate()} disabled={saveGroupsMutation.isPending} className="self-end">
                    {saveGroupsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    บันทึกกลุ่มสิทธิ์
                  </Button>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
