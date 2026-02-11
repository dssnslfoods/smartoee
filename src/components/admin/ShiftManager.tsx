import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, Loader2, Clock, CalendarDays, Factory } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChangeHistory } from './ChangeHistory';
import { format } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  effective_from: string;
  created_at: string;
  working_days: number[];
  plant_id: string;
  company_id: string;
}

interface Plant {
  id: string;
  name: string;
  company_id: string;
}

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function formatWorkingDays(days: number[]): string {
  if (!days || days.length === 0) return 'ไม่ระบุ';
  if (days.length === 7) return 'ทุกวัน';
  const sorted = [...days].sort();
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'จ-ศ';
  if (sorted.length === 6 && sorted.join(',') === '1,2,3,4,5,6') return 'จ-ส';
  return sorted.map(d => DAY_LABELS[d]).join(', ');
}

function calcDurationMinutes(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ShiftManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const selectedCompanyId = company?.id;

  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDuplicateToPlantOpen, setIsDuplicateToPlantOpen] = useState(false);
  const [duplicatingShift, setDuplicatingShift] = useState<Shift | null>(null);
  const [duplicateTargetPlantId, setDuplicateTargetPlantId] = useState<string>('');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '08:00',
    end_time: '16:00',
    is_active: true,
    effective_from: new Date().toISOString().slice(0, 10),
    working_days: [1, 2, 3, 4, 5, 6] as number[],
  });

  // Fetch plants for selector
  const { data: plants } = useQuery({
    queryKey: ['admin-plants-for-shifts', selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from('plants').select('id, name, company_id').eq('is_active', true).order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Plant[];
    },
  });

  // Auto-select first plant
  useEffect(() => {
    if (plants && plants.length > 0 && !selectedPlantId) {
      setSelectedPlantId(plants[0].id);
    }
  }, [plants, selectedPlantId]);

  // Reset plant selection when company changes
  useEffect(() => {
    setSelectedPlantId('');
  }, [selectedCompanyId]);

  const selectedPlant = plants?.find(p => p.id === selectedPlantId);

  // Fetch shifts filtered by plant
  const { data: shifts, isLoading } = useQuery({
    queryKey: ['admin-shifts', selectedPlantId],
    queryFn: async () => {
      if (!selectedPlantId) return [];
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('plant_id', selectedPlantId)
        .order('start_time');
      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!selectedPlantId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!selectedPlant) throw new Error('กรุณาเลือกโรงงานก่อน');
      const { error } = await supabase.from('shifts').insert({
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        is_active: data.is_active,
        effective_from: data.effective_from,
        working_days: data.working_days,
        plant_id: selectedPlantId,
        company_id: selectedPlant.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('สร้างกะเรียบร้อยแล้ว');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('shifts').update({
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        is_active: data.is_active,
        effective_from: data.effective_from,
        working_days: data.working_days,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('อัปเดตกะเรียบร้อยแล้ว');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: runningEvents, error: checkError } = await supabase
        .from('production_events')
        .select('id, shift_calendar_id')
        .is('end_ts', null)
        .in('shift_calendar_id',
          (await supabase.from('shift_calendar').select('id').eq('shift_id', id)).data?.map(sc => sc.id) || []
        )
        .limit(1);
      if (checkError) throw checkError;
      if (runningEvents && runningEvents.length > 0) {
        throw new Error('ไม่สามารถปิดกะได้ เนื่องจากยังมี Event ที่กำลัง Run อยู่ในกะนี้');
      }
      const { error } = await supabase.from('shifts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('ปิดกะเรียบร้อยแล้ว');
      setIsDeleteOpen(false);
      setDeletingShift(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = shifts?.find(s => s.id === id);
      if (target?.is_active) throw new Error('ไม่สามารถลบกะที่ยัง Active ได้');
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('ลบกะเรียบร้อยแล้ว');
      setIsDeleteOpen(false);
      setDeletingShift(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Duplicate shift to another plant
  const duplicateToPlantMutation = useMutation({
    mutationFn: async ({ shift, targetPlantId }: { shift: Shift; targetPlantId: string }) => {
      const targetPlant = plants?.find(p => p.id === targetPlantId);
      if (!targetPlant) throw new Error('ไม่พบโรงงานปลายทาง');
      const { error } = await supabase.from('shifts').insert({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        is_active: shift.is_active,
        effective_from: shift.effective_from,
        working_days: shift.working_days,
        plant_id: targetPlantId,
        company_id: targetPlant.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('คัดลอกกะไปยังโรงงานอื่นเรียบร้อยแล้ว');
      setIsDuplicateToPlantOpen(false);
      setDuplicatingShift(null);
      setDuplicateTargetPlantId('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormData({ name: '', start_time: '08:00', end_time: '16:00', is_active: true, effective_from: new Date().toISOString().slice(0, 10), working_days: [1, 2, 3, 4, 5, 6] });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      is_active: shift.is_active,
      effective_from: shift.effective_from || new Date().toISOString().slice(0, 10),
      working_days: shift.working_days || [1, 2, 3, 4, 5, 6],
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingShift(null);
    setFormData({ name: '', start_time: '08:00', end_time: '16:00', is_active: true, effective_from: new Date().toISOString().slice(0, 10), working_days: [1, 2, 3, 4, 5, 6] });
  };

  const handleDuplicate = (shift: Shift) => {
    setEditingShift(null);
    setFormData({
      name: `${shift.name} (สำเนา)`,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      is_active: true,
      effective_from: new Date().toISOString().slice(0, 10),
      working_days: shift.working_days || [1, 2, 3, 4, 5, 6],
    });
    setIsDialogOpen(true);
  };

  const handleDuplicateToPlant = (shift: Shift) => {
    setDuplicatingShift(shift);
    setDuplicateTargetPlantId('');
    setIsDuplicateToPlantOpen(true);
  };

  const checkTimeOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => {
    const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const s1m = toMinutes(s1), e1m = toMinutes(e1), s2m = toMinutes(s2), e2m = toMinutes(e2);
    const ranges1 = e1m > s1m ? [[s1m, e1m]] : [[s1m, 1440], [0, e1m]];
    const ranges2 = e2m > s2m ? [[s2m, e2m]] : [[s2m, 1440], [0, e2m]];
    for (const r1 of ranges1) {
      for (const r2 of ranges2) {
        if (r1[0] < r2[1] && r2[0] < r1[1]) return true;
      }
    }
    return false;
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('กรุณาระบุชื่อกะ'); return; }
    if (!formData.start_time || !formData.end_time) { toast.error('กรุณาระบุเวลาเริ่ม-สิ้นสุด'); return; }

    // Validate overlap within same plant only
    const activeShifts = shifts?.filter(s => s.is_active && s.id !== editingShift?.id) || [];
    const overlapping = activeShifts.find(s =>
      checkTimeOverlap(formData.start_time, formData.end_time, s.start_time.slice(0, 5), s.end_time.slice(0, 5))
    );
    if (overlapping && formData.is_active) {
      toast.error(`ช่วงเวลาซ้อนทับกับกะ "${overlapping.name}" (${overlapping.start_time.slice(0, 5)} - ${overlapping.end_time.slice(0, 5)})`);
      return;
    }

    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const duration = calcDurationMinutes(formData.start_time, formData.end_time);
  const otherPlants = plants?.filter(p => p.id !== duplicatingShift?.plant_id) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Shifts</h3>
          <p className="text-sm text-muted-foreground">
            จัดการกะทำงานแยกตามโรงงาน — สามารถคัดลอกกะไปยังโรงงานอื่นได้
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" disabled={!selectedPlantId}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

      {/* Plant Selector */}
      <div className="flex items-center gap-3">
        <Factory className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="เลือกโรงงาน" />
          </SelectTrigger>
          <SelectContent>
            {plants?.map(plant => (
              <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPlantId && (
        <div className="text-center text-muted-foreground py-8">
          กรุณาเลือกโรงงานเพื่อจัดการกะ
        </div>
      )}

      {selectedPlantId && (
        <>
          {/* Summary card */}
          {shifts && shifts.filter(s => s.is_active).length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active Shifts Summary</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total shifts/day: </span>
                  <span className="font-semibold">{shifts.filter(s => s.is_active).length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total hours/day: </span>
                  <span className="font-semibold">
                    {formatDuration(
                      shifts.filter(s => s.is_active)
                        .reduce((sum, s) => sum + (calcDurationMinutes(s.start_time, s.end_time) || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>วันทำงาน</TableHead>
                  <TableHead>เริ่มใช้ตั้งแต่</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts?.map((shift) => {
                  const dur = calcDurationMinutes(shift.start_time, shift.end_time);
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>{shift.start_time.slice(0, 5)}</TableCell>
                      <TableCell>{shift.end_time.slice(0, 5)}</TableCell>
                      <TableCell>
                        {dur != null ? (
                          <span className="text-muted-foreground">{formatDuration(dur)} ({dur} min)</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatWorkingDays(shift.working_days)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm tabular-nums">
                            {shift.effective_from ? format(new Date(shift.effective_from + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={shift.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                          {shift.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(shift)} title="คัดลอกกะ (โรงงานเดิม)">
                            <Copy className="h-4 w-4" />
                          </Button>
                          {(plants?.length || 0) > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicateToPlant(shift)} title="คัดลอกไปโรงงานอื่น">
                              <Factory className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(shift)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingShift(shift); setIsDeleteOpen(true); }}
                            title={shift.is_active ? 'ปิดการใช้งานกะ' : 'ลบกะ'}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {shifts?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      ยังไม่มีกะสำหรับโรงงานนี้ กด Add Shift เพื่อเพิ่มกะ หรือคัดลอกจากโรงงานอื่น
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'แก้ไขกะ' : 'เพิ่มกะ'}</DialogTitle>
            <DialogDescription>
              {editingShift ? 'แก้ไขรายละเอียดกะ' : `เพิ่มกะใหม่สำหรับ ${selectedPlant?.name || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift-name">ชื่อกะ *</Label>
              <Input
                id="shift-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น กะเช้า, กะบ่าย, กะดึก"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">เวลาเริ่ม *</Label>
                <Input id="start-time" type="time" value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">เวลาสิ้นสุด *</Label>
                <Input id="end-time" type="time" value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
              </div>
            </div>

            {duration != null && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ระยะเวลากะ</span>
                  <span className="text-sm font-semibold">{formatDuration(duration)} ({duration} นาที)</span>
                </div>
                {formData.start_time > formData.end_time && (
                  <p className="text-xs text-muted-foreground mt-1">⏰ กะข้ามคืน (ข้ามเที่ยงคืน)</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="effective-from">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  เริ่มใช้ตั้งแต่วันที่ *
                </div>
              </Label>
              <Input id="effective-from" type="date" value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                การเปลี่ยนแปลงจะมีผลตั้งแต่วันที่นี้เป็นต้นไป — ไม่กระทบข้อมูลที่บันทึกไปแล้ว
              </p>
            </div>

            <div className="space-y-2">
              <Label>วันทำงาน *</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const isSelected = formData.working_days.includes(idx);
                  return (
                    <button key={idx} type="button"
                      onClick={() => {
                        const next = isSelected
                          ? formData.working_days.filter(d => d !== idx)
                          : [...formData.working_days, idx].sort();
                        setFormData({ ...formData, working_days: next });
                      }}
                      className={cn(
                        'h-9 w-9 rounded-full text-xs font-medium border transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:bg-accent',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => setFormData({ ...formData, working_days: [1, 2, 3, 4, 5] })}>จ-ศ</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => setFormData({ ...formData, working_days: [1, 2, 3, 4, 5, 6] })}>จ-ส</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => setFormData({ ...formData, working_days: [0, 1, 2, 3, 4, 5, 6] })}>ทุกวัน</Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="shift-active" checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              <Label htmlFor="shift-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingShift ? 'อัปเดต' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate to Plant Dialog */}
      <Dialog open={isDuplicateToPlantOpen} onOpenChange={setIsDuplicateToPlantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คัดลอกกะไปโรงงานอื่น</DialogTitle>
            <DialogDescription>
              คัดลอกกะ "{duplicatingShift?.name}" ไปยังโรงงานที่เลือก
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>โรงงานปลายทาง *</Label>
              <Select value={duplicateTargetPlantId} onValueChange={setDuplicateTargetPlantId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกโรงงาน" />
                </SelectTrigger>
                <SelectContent>
                  {otherPlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {duplicatingShift && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">กะ:</span> {duplicatingShift.name}</div>
                <div><span className="text-muted-foreground">เวลา:</span> {duplicatingShift.start_time.slice(0, 5)} - {duplicatingShift.end_time.slice(0, 5)}</div>
                <div><span className="text-muted-foreground">วันทำงาน:</span> {formatWorkingDays(duplicatingShift.working_days)}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDuplicateToPlantOpen(false)}>ยกเลิก</Button>
            <Button
              disabled={!duplicateTargetPlantId || duplicateToPlantMutation.isPending}
              onClick={() => {
                if (duplicatingShift && duplicateTargetPlantId) {
                  duplicateToPlantMutation.mutate({ shift: duplicatingShift, targetPlantId: duplicateTargetPlantId });
                }
              }}
            >
              {duplicateToPlantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              คัดลอก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Deactivate Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingShift?.is_active ? 'ปิดการใช้งานกะ' : 'ลบกะถาวร'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingShift?.is_active
                ? `ต้องการปิดกะ "${deletingShift?.name}" หรือไม่? กะจะถูกเปลี่ยนสถานะเป็น Inactive — ข้อมูลที่บันทึกไปแล้วจะไม่ได้รับผลกระทบ การเปลี่ยนแปลงนี้กระทบเฉพาะโรงงานนี้เท่านั้น`
                : `ต้องการลบกะ "${deletingShift?.name}" ออกจากระบบถาวรหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้ และกระทบเฉพาะโรงงานนี้เท่านั้น`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingShift) return;
                if (deletingShift.is_active) {
                  deactivateMutation.mutate(deletingShift.id);
                } else {
                  hardDeleteMutation.mutate(deletingShift.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deactivateMutation.isPending || hardDeleteMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {deletingShift?.is_active ? 'ปิดการใช้งาน' : 'ลบถาวร'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change History */}
      <ChangeHistory
        entityType="shifts"
        title="ประวัติการเปลี่ยนแปลงกะ"
        displayFields={{
          name: 'ชื่อกะ',
          start_time: 'เวลาเริ่ม',
          end_time: 'เวลาสิ้นสุด',
          is_active: 'สถานะ',
          effective_from: 'เริ่มใช้ตั้งแต่',
          working_days: 'วันทำงาน',
          plant_id: 'โรงงาน',
        }}
      />
    </div>
  );
}
