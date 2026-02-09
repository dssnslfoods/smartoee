import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Factory, Layers, Cpu, Shield, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  machines?: { name: string; code: string; lines?: { name: string; plants?: { name: string } } };
}

type PermLevel = 'plant' | 'line' | 'machine';

export function UserPermissionManager() {
  const queryClient = useQueryClient();
  const { company, isAdmin } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: PermLevel; id: string; name: string } | null>(null);

  // Dialog state for cascading selection
  const [dialogLevel, setDialogLevel] = useState<PermLevel>('plant');
  const [dialogPlantId, setDialogPlantId] = useState<string>('');
  const [dialogLineId, setDialogLineId] = useState<string>('');
  const [dialogMachineId, setDialogMachineId] = useState<string>('');

  const scopeCompanyId = company?.id;

  // ─── Data queries ───
  const { data: users } = useQuery({
    queryKey: ['perm-users', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('user_profiles').select('*').eq('role', 'STAFF').order('full_name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const { data: plants } = useQuery({
    queryKey: ['perm-plants', scopeCompanyId, isAdmin()],
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

  const { data: allLines } = useQuery({
    queryKey: ['perm-lines', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('lines').select('id, name, plant_id, company_id, plants(name)').eq('is_active', true).order('name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: allMachines } = useQuery({
    queryKey: ['perm-machines', scopeCompanyId, isAdmin()],
    queryFn: async () => {
      let query = supabase.from('machines').select('id, name, code, line_id, company_id, lines(name, plant_id, plants(name))').eq('is_active', true).order('name');
      if (!isAdmin() && scopeCompanyId) {
        query = query.eq('company_id', scopeCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ─── Permissions for selected user ───
  const { data: plantPerms, isLoading: loadingPlant } = useQuery({
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

  const { data: linePerms, isLoading: loadingLine } = useQuery({
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

  const { data: machinePerms, isLoading: loadingMachine } = useQuery({
    queryKey: ['user-machine-perms', selectedUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_machine_permissions')
        .select('*, machines(name, code, lines(name, plants(name)))')
        .eq('user_id', selectedUserId);
      if (error) throw error;
      return data as MachinePermission[];
    },
    enabled: !!selectedUserId,
  });

  // Filtered lines/machines for dialog cascading
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
      const { error } = await supabase.from('user_plant_permissions').insert({ user_id: selectedUserId, plant_id: plantId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePerms();
      toast.success('เพิ่มสิทธิ์ Plant สำเร็จ');
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
      invalidatePerms();
      toast.success('เพิ่มสิทธิ์ Line สำเร็จ');
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
      invalidatePerms();
      toast.success('เพิ่มสิทธิ์ Machine สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePlantPerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_plant_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLinePerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_line_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMachinePerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_machine_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidatePerms(); toast.success('ลบสิทธิ์แล้ว'); setDeleteConfirm(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const invalidatePerms = () => {
    queryClient.invalidateQueries({ queryKey: ['user-plant-perms', selectedUserId] });
    queryClient.invalidateQueries({ queryKey: ['user-line-perms', selectedUserId] });
    queryClient.invalidateQueries({ queryKey: ['user-machine-perms', selectedUserId] });
  };

  // ─── Handlers ───
  const handleOpenAddDialog = () => {
    setDialogLevel('plant');
    setDialogPlantId('');
    setDialogLineId('');
    setDialogMachineId('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogPlantId('');
    setDialogLineId('');
    setDialogMachineId('');
  };

  const handleAddPermission = () => {
    if (dialogLevel === 'plant' && dialogPlantId) {
      addPlantPerm.mutate(dialogPlantId);
    } else if (dialogLevel === 'line' && dialogLineId) {
      addLinePerm.mutate(dialogLineId);
    } else if (dialogLevel === 'machine' && dialogMachineId) {
      addMachinePerm.mutate(dialogMachineId);
    }
  };

  const handleDeletePermission = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'plant') deletePlantPerm.mutate(deleteConfirm.id);
    else if (deleteConfirm.type === 'line') deleteLinePerm.mutate(deleteConfirm.id);
    else deleteMachinePerm.mutate(deleteConfirm.id);
  };

  // Figure out the description for dialog level
  const getLevelDescription = () => {
    if (dialogLevel === 'plant') return 'เข้าถึง ทุก Line และ Machine ใน Plant ที่เลือก';
    if (dialogLevel === 'line') return 'เข้าถึง ทุก Machine ใน Line ที่เลือก';
    return 'เข้าถึง Machine ที่เลือกเพียงเครื่องเดียว';
  };

  const canSubmit = () => {
    if (dialogLevel === 'plant') return !!dialogPlantId;
    if (dialogLevel === 'line') return !!dialogPlantId && !!dialogLineId;
    return !!dialogPlantId && !!dialogLineId && !!dialogMachineId;
  };

  const selectedUser = users?.find(u => u.user_id === selectedUserId);
  const isLoading = loadingPlant || loadingLine || loadingMachine;
  const totalPerms = (plantPerms?.length || 0) + (linePerms?.length || 0) + (machinePerms?.length || 0);
  const isMutating = addPlantPerm.isPending || addLinePerm.isPending || addMachinePerm.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">จัดการสิทธิ์ผู้ใช้งาน</h3>
          <p className="text-sm text-muted-foreground">กำหนดสิทธิ์การเข้าถึง Plant / Line / Machine ให้กับ Staff</p>
        </div>
      </div>

      {/* User Selector */}
      <div className="space-y-2">
        <Label>เลือก Staff</Label>
        <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); }}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="เลือก Staff เพื่อจัดการสิทธิ์..." />
          </SelectTrigger>
          <SelectContent>
            {users?.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedUserId && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">เลือก Staff เพื่อดูและจัดการสิทธิ์</p>
        </div>
      )}

      {selectedUserId && (
        <div className="space-y-4">
          {/* User header + Add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{selectedUser?.full_name}</span>
              <Badge variant="outline">STAFF</Badge>
              <Badge variant="secondary">{totalPerms} สิทธิ์</Badge>
            </div>
            <Button size="sm" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มสิทธิ์
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalPerms === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Staff คนนี้ยังไม่มีสิทธิ์เข้าถึง Plant / Line / Machine ใดๆ กดปุ่ม "เพิ่มสิทธิ์" เพื่อกำหนดสิทธิ์
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {/* Plant permissions */}
              {plantPerms && plantPerms.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Factory className="h-4 w-4" />
                      Plant Level — ดูได้ทุก Line & Machine
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {plantPerms.map((perm) => (
                        <Badge 
                          key={perm.id} 
                          variant="secondary" 
                          className="gap-1.5 pl-3 pr-1 py-1.5 text-sm"
                        >
                          <Factory className="h-3.5 w-3.5 text-primary" />
                          {perm.plants?.name}
                          <button
                            onClick={() => setDeleteConfirm({ type: 'plant', id: perm.id, name: perm.plants?.name || '' })}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                          >
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
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      Line Level — ดูได้ทุก Machine ใน Line
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {linePerms.map((perm) => (
                        <Badge 
                          key={perm.id} 
                          variant="secondary" 
                          className="gap-1.5 pl-3 pr-1 py-1.5 text-sm"
                        >
                          <Layers className="h-3.5 w-3.5 text-blue-500" />
                          {perm.lines?.name}
                          <span className="text-muted-foreground text-xs">({perm.lines?.plants?.name})</span>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'line', id: perm.id, name: perm.lines?.name || '' })}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                          >
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
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-4 w-4" />
                      Machine Level — เข้าถึงเฉพาะเครื่อง
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {machinePerms.map((perm) => (
                        <Badge 
                          key={perm.id} 
                          variant="secondary" 
                          className="gap-1.5 pl-3 pr-1 py-1.5 text-sm"
                        >
                          <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                          {perm.machines?.name}
                          <span className="text-muted-foreground text-xs">
                            ({perm.machines?.lines?.name})
                          </span>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'machine', id: perm.id, name: perm.machines?.name || '' })}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                          >
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
        </div>
      )}

      {/* ─── Add Permission Dialog ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มสิทธิ์การเข้าถึง</DialogTitle>
            <DialogDescription>
              กำหนดสิทธิ์ให้ <span className="font-medium text-foreground">{selectedUser?.full_name}</span>
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

            {/* Step 1: Select Plant (always shown) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                เลือก Plant
              </Label>
              <Select 
                value={dialogPlantId} 
                onValueChange={(v) => { 
                  setDialogPlantId(v); 
                  setDialogLineId(''); 
                  setDialogMachineId(''); 
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Plant..." />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Select Line (shown for line/machine level) */}
            {dialogLevel !== 'plant' && dialogPlantId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  เลือก Line
                </Label>
                <Select 
                  value={dialogLineId} 
                  onValueChange={(v) => { 
                    setDialogLineId(v); 
                    setDialogMachineId(''); 
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก Line..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogLines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dialogLines.length === 0 && (
                  <p className="text-xs text-muted-foreground">ไม่มี Line ใน Plant นี้</p>
                )}
              </div>
            )}

            {/* Step 3: Select Machine (shown for machine level only) */}
            {dialogLevel === 'machine' && dialogLineId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-500" />
                  เลือก Machine
                </Label>
                <Select value={dialogMachineId} onValueChange={setDialogMachineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก Machine..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogMachines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dialogMachines.length === 0 && (
                  <p className="text-xs text-muted-foreground">ไม่มี Machine ใน Line นี้</p>
                )}
              </div>
            )}

            {/* Summary preview */}
            {canSubmit() && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">สรุปสิทธิ์ที่จะเพิ่ม:</p>
                <div className="flex items-center gap-1 text-sm">
                  <span className="font-medium">{selectedUser?.full_name}</span>
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
                      {dialogLines.find(l => l.id === dialogLineId)?.name} (ทุก Machine ใน Line)
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
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button 
              onClick={handleAddPermission} 
              disabled={!canSubmit() || isMutating}
            >
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
              ต้องการลบสิทธิ์ "{deleteConfirm?.name}" ของ {selectedUser?.full_name} หรือไม่? Staff จะไม่สามารถเข้าถึงข้อมูลนี้ได้อีก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePermission}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบสิทธิ์
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
