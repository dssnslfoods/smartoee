import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Factory, Layers, Cpu, Shield, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PermLevel = 'plant' | 'line' | 'machine';

interface StaffPermissionDialogProps {
  staffUserId: string;
  staffName: string;
  isOpen: boolean;
  onClose: () => void;
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
  machines?: { name: string; code: string; lines?: { name: string; plants?: { name: string } } };
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
  const { company, profile } = useAuth();
  const scopeCompanyId = company?.id;

  const [activeTab, setActiveTab] = useState('permissions');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: PermLevel; id: string; name: string } | null>(null);

  // Add dialog state
  const [dialogLevel, setDialogLevel] = useState<PermLevel>('plant');
  const [dialogPlantId, setDialogPlantId] = useState('');
  const [dialogLineId, setDialogLineId] = useState('');
  const [dialogMachineId, setDialogMachineId] = useState('');

  // Group selection state
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [groupsDirty, setGroupsDirty] = useState(false);

  // ─── Data queries ───
  const { data: plants } = useQuery({
    queryKey: ['perm-plants', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('plants').select('id, name').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  const { data: allLines } = useQuery({
    queryKey: ['perm-lines', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lines').select('id, name, plant_id').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  const { data: allMachines } = useQuery({
    queryKey: ['perm-machines', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('id, name, code, line_id').eq('is_active', true).eq('company_id', scopeCompanyId!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && isOpen,
  });

  // ─── Current permissions ───
  const { data: plantPerms, isLoading: loadingPlant } = useQuery({
    queryKey: ['user-plant-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_plant_permissions').select('*, plants(name)').eq('user_id', staffUserId);
      if (error) throw error;
      return data as PlantPermission[];
    },
    enabled: !!staffUserId && isOpen,
  });

  const { data: linePerms, isLoading: loadingLine } = useQuery({
    queryKey: ['user-line-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_line_permissions').select('*, lines(name, plants(name))').eq('user_id', staffUserId);
      if (error) throw error;
      return data as LinePermission[];
    },
    enabled: !!staffUserId && isOpen,
  });

  const { data: machinePerms, isLoading: loadingMachine } = useQuery({
    queryKey: ['user-machine-perms', staffUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_machine_permissions').select('*, machines(name, code, lines(name, plants(name)))').eq('user_id', staffUserId);
      if (error) throw error;
      return data as MachinePermission[];
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

  // ─── Cascading filters ───
  const dialogLines = useMemo(() => {
    if (!dialogPlantId || !allLines) return [];
    return allLines.filter(l => l.plant_id === dialogPlantId);
  }, [dialogPlantId, allLines]);

  const dialogMachines = useMemo(() => {
    if (!dialogLineId || !allMachines) return [];
    return allMachines.filter(m => m.line_id === dialogLineId);
  }, [dialogLineId, allMachines]);

  // ─── Mutations ───
  const addPlantPerm = useMutation({
    mutationFn: async (plantId: string) => {
      const { error } = await supabase.from('user_plant_permissions').insert({ user_id: staffUserId, plant_id: plantId });
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('เพิ่มสิทธิ์ Plant สำเร็จ'); closeAddDialog(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const addLinePerm = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from('user_line_permissions').insert({ user_id: staffUserId, line_id: lineId });
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('เพิ่มสิทธิ์ Line สำเร็จ'); closeAddDialog(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMachinePerm = useMutation({
    mutationFn: async (machineId: string) => {
      const { error } = await supabase.from('user_machine_permissions').insert({ user_id: staffUserId, machine_id: machineId });
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('เพิ่มสิทธิ์ Machine สำเร็จ'); closeAddDialog(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePlantPerm = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('user_plant_permissions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLinePerm = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('user_line_permissions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMachinePerm = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('user_machine_permissions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
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

  // ─── Handlers ───
  const openAddDialog = () => {
    setDialogLevel('plant');
    setDialogPlantId('');
    setDialogLineId('');
    setDialogMachineId('');
    setIsAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setDialogPlantId('');
    setDialogLineId('');
    setDialogMachineId('');
  };

  const handleAddPermission = () => {
    if (dialogLevel === 'plant' && dialogPlantId) addPlantPerm.mutate(dialogPlantId);
    else if (dialogLevel === 'line' && dialogLineId) addLinePerm.mutate(dialogLineId);
    else if (dialogLevel === 'machine' && dialogMachineId) addMachinePerm.mutate(dialogMachineId);
  };

  const handleDeletePermission = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'plant') deletePlantPerm.mutate(deleteConfirm.id);
    else if (deleteConfirm.type === 'line') deleteLinePerm.mutate(deleteConfirm.id);
    else deleteMachinePerm.mutate(deleteConfirm.id);
  };

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(selectedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId); else newSet.add(groupId);
    setSelectedGroups(newSet);
    setGroupsDirty(true);
  };

  const canSubmit = () => {
    if (dialogLevel === 'plant') return !!dialogPlantId;
    if (dialogLevel === 'line') return !!dialogPlantId && !!dialogLineId;
    return !!dialogPlantId && !!dialogLineId && !!dialogMachineId;
  };

  const getLevelDescription = () => {
    if (dialogLevel === 'plant') return 'เข้าถึง ทุก Line และ Machine ใน Plant ที่เลือก';
    if (dialogLevel === 'line') return 'เข้าถึง ทุก Machine ใน Line ที่เลือก';
    return 'เข้าถึง Machine ที่เลือกเพียงเครื่องเดียว';
  };

  const isLoading = loadingPlant || loadingLine || loadingMachine;
  const totalPerms = (plantPerms?.length || 0) + (linePerms?.length || 0) + (machinePerms?.length || 0);
  const isMutating = addPlantPerm.isPending || addLinePerm.isPending || addMachinePerm.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              กำหนดสิทธิ์ — {staffName}
            </DialogTitle>
            <DialogDescription>
              กำหนดสิทธิ์การเข้าถึง Plant / Line / Machine และกลุ่มสิทธิ์
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="permissions">
                สิทธิ์ ({totalPerms})
              </TabsTrigger>
              <TabsTrigger value="groups">
                กลุ่มสิทธิ์ ({selectedGroups.size})
              </TabsTrigger>
            </TabsList>

            {/* ─── Permissions Tab ─── */}
            <TabsContent value="permissions" className="flex-1 overflow-auto space-y-3 mt-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1" />
                  เพิ่มสิทธิ์
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : totalPerms === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    ยังไม่มีสิทธิ์ กดปุ่ม "เพิ่มสิทธิ์" เพื่อกำหนดสิทธิ์การเข้าถึง
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {/* Plant permissions */}
                  {plantPerms && plantPerms.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                          <Factory className="h-3.5 w-3.5" />
                          Plant Level — ดูได้ทุก Line & Machine
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="flex flex-wrap gap-2">
                          {plantPerms.map((perm) => (
                            <Badge key={perm.id} variant="secondary" className="gap-1.5 pl-3 pr-1 py-1.5 text-sm">
                              <Factory className="h-3.5 w-3.5 text-primary" />
                              {perm.plants?.name}
                              <button onClick={() => setDeleteConfirm({ type: 'plant', id: perm.id, name: perm.plants?.name || '' })} className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Line permissions */}
                  {linePerms && linePerms.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                          <Layers className="h-3.5 w-3.5" />
                          Line Level — ดูได้ทุก Machine ใน Line
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="flex flex-wrap gap-2">
                          {linePerms.map((perm) => (
                            <Badge key={perm.id} variant="secondary" className="gap-1.5 pl-3 pr-1 py-1.5 text-sm">
                              <Layers className="h-3.5 w-3.5 text-blue-500" />
                              {perm.lines?.name}
                              <span className="text-muted-foreground text-xs">({perm.lines?.plants?.name})</span>
                              <button onClick={() => setDeleteConfirm({ type: 'line', id: perm.id, name: perm.lines?.name || '' })} className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Machine permissions */}
                  {machinePerms && machinePerms.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-3.5 w-3.5" />
                          Machine Level — เข้าถึงเฉพาะเครื่อง
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="flex flex-wrap gap-2">
                          {machinePerms.map((perm) => (
                            <Badge key={perm.id} variant="secondary" className="gap-1.5 pl-3 pr-1 py-1.5 text-sm">
                              <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                              {perm.machines?.name}
                              <span className="text-muted-foreground text-xs">({perm.machines?.lines?.name})</span>
                              <button onClick={() => setDeleteConfirm({ type: 'machine', id: perm.id, name: perm.machines?.name || '' })} className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
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

      {/* ─── Add Permission Dialog ─── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มสิทธิ์การเข้าถึง</DialogTitle>
            <DialogDescription>
              กำหนดสิทธิ์ให้ <span className="font-medium text-foreground">{staffName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Permission level selector */}
            <div className="space-y-2">
              <Label>ระดับสิทธิ์</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['plant', 'line', 'machine'] as PermLevel[]).map((level) => {
                  const Icon = level === 'plant' ? Factory : level === 'line' ? Layers : Cpu;
                  const label = level === 'plant' ? 'ทั้ง Plant' : level === 'line' ? 'ระบุ Line' : 'ราย Machine';
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setDialogLevel(level);
                        if (level === 'plant') { setDialogLineId(''); setDialogMachineId(''); }
                        if (level === 'line') { setDialogMachineId(''); }
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all',
                        dialogLevel === level
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{getLevelDescription()}</p>
            </div>

            <Separator />

            {/* Plant */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                เลือก Plant
              </Label>
              <Select value={dialogPlantId} onValueChange={(v) => { setDialogPlantId(v); setDialogLineId(''); setDialogMachineId(''); }}>
                <SelectTrigger><SelectValue placeholder="เลือก Plant..." /></SelectTrigger>
                <SelectContent>
                  {plants?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Line */}
            {dialogLevel !== 'plant' && dialogPlantId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  เลือก Line
                </Label>
                <Select value={dialogLineId} onValueChange={(v) => { setDialogLineId(v); setDialogMachineId(''); }}>
                  <SelectTrigger><SelectValue placeholder="เลือก Line..." /></SelectTrigger>
                  <SelectContent>
                    {dialogLines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {dialogLines.length === 0 && <p className="text-xs text-muted-foreground">ไม่มี Line ใน Plant นี้</p>}
              </div>
            )}

            {/* Machine */}
            {dialogLevel === 'machine' && dialogLineId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-500" />
                  เลือก Machine
                </Label>
                <Select value={dialogMachineId} onValueChange={setDialogMachineId}>
                  <SelectTrigger><SelectValue placeholder="เลือก Machine..." /></SelectTrigger>
                  <SelectContent>
                    {dialogMachines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>)}
                  </SelectContent>
                </Select>
                {dialogMachines.length === 0 && <p className="text-xs text-muted-foreground">ไม่มี Machine ใน Line นี้</p>}
              </div>
            )}

            {/* Preview */}
            {canSubmit() && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">สรุปสิทธิ์ที่จะเพิ่ม:</p>
                <div className="flex items-center gap-1 text-sm">
                  <span className="font-medium">{staffName}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  {dialogLevel === 'plant' && (
                    <Badge variant="secondary" className="gap-1">
                      <Factory className="h-3 w-3" />
                      {plants?.find(p => p.id === dialogPlantId)?.name} (ทั้ง Plant)
                    </Badge>
                  )}
                  {dialogLevel === 'line' && (
                    <Badge variant="secondary" className="gap-1">
                      <Layers className="h-3 w-3" />
                      {dialogLines.find(l => l.id === dialogLineId)?.name} (ทุก Machine)
                    </Badge>
                  )}
                  {dialogLevel === 'machine' && (
                    <Badge variant="secondary" className="gap-1">
                      <Cpu className="h-3 w-3" />
                      {dialogMachines.find(m => m.id === dialogMachineId)?.name}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog}>ยกเลิก</Button>
            <Button onClick={handleAddPermission} disabled={!canSubmit() || isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              เพิ่มสิทธิ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสิทธิ์</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบสิทธิ์ "{deleteConfirm?.name}" ของ {staffName} หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePermission} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบสิทธิ์
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
