import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, Loader2, Clock, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChangeHistory } from './ChangeHistory';
import { format } from 'date-fns';
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

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  effective_from: string;
  created_at: string;
}

function calcDurationMinutes(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60; // overnight shift
  return diff;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ShiftManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '08:00',
    end_time: '16:00',
    is_active: true,
    effective_from: new Date().toISOString().slice(0, 10),
  });

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['admin-shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time');
      if (error) throw error;
      return data as Shift[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('shifts')
        .insert({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
          is_active: data.is_active,
          effective_from: data.effective_from,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('Shift created successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('shifts')
        .update({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
          is_active: data.is_active,
          effective_from: data.effective_from,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success('Shift updated successfully');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Soft-delete (deactivate) for active shifts
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: runningEvents, error: checkError } = await supabase
        .from('production_events')
        .select('id, shift_calendar_id')
        .is('end_ts', null)
        .in(
          'shift_calendar_id',
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
      toast.success('ปิดกะเรียบร้อยแล้ว — ข้อมูลที่บันทึกไปแล้วไม่ได้รับผลกระทบ');
      setIsDeleteOpen(false);
      setDeletingShift(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Hard-delete for inactive shifts only
  const hardDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Double-check: only allow deleting inactive shifts
      const target = shifts?.find(s => s.id === id);
      if (target?.is_active) {
        throw new Error('ไม่สามารถลบกะที่ยัง Active ได้ — กรุณาปิดการใช้งานก่อน');
      }

      // Check if there are any shift_calendar entries referencing this shift
      const { count, error: countError } = await supabase
        .from('shift_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('shift_id', id);
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error('ไม่สามารถลบกะนี้ได้ เนื่องจากมีข้อมูล Shift Calendar อ้างอิงอยู่');
      }

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

  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormData({ name: '', start_time: '08:00', end_time: '16:00', is_active: true, effective_from: new Date().toISOString().slice(0, 10) });
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
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingShift(null);
    setFormData({ name: '', start_time: '08:00', end_time: '16:00', is_active: true, effective_from: new Date().toISOString().slice(0, 10) });
  };

  const handleDuplicate = (shift: Shift) => {
    setEditingShift(null);
    setFormData({
      name: `${shift.name} (สำเนา)`,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      is_active: true,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setIsDialogOpen(true);
  };

  // Check if two time ranges overlap (handles overnight shifts)
  const checkTimeOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => {
    const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const s1m = toMinutes(s1), e1m = toMinutes(e1), s2m = toMinutes(s2), e2m = toMinutes(e2);

    // Normalize to ranges that may wrap around midnight
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
    if (!formData.name.trim()) {
      toast.error('Shift name is required');
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      toast.error('Start and end time are required');
      return;
    }

    // Validate no overlap with other active shifts
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Shifts</h3>
          <p className="text-sm text-muted-foreground">
            Define standard shifts per day. These shifts are used for Planned Production Time templates and OEE calculations.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

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
                  shifts
                    .filter(s => s.is_active)
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
              <TableHead>เริ่มใช้ตั้งแต่</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
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
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(shift)} title="คัดลอกกะ">
                        <Copy className="h-4 w-4" />
                      </Button>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No shifts defined yet. Add your first shift to get started.
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
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
            <DialogDescription>
              {editingShift ? 'Update shift details' : 'Define a new standard shift'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift-name">Shift Name *</Label>
              <Input
                id="shift-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Morning Shift, Day Shift, Night Shift"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time *</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time *</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            {/* Duration preview */}
            {duration != null && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Shift Duration</span>
                  <span className="text-sm font-semibold">
                    {formatDuration(duration)} ({duration} minutes)
                  </span>
                </div>
                {formData.start_time > formData.end_time && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⏰ Overnight shift detected (crosses midnight)
                  </p>
                )}
              </div>
            )}

            {/* Effective From */}
            <div className="space-y-2">
              <Label htmlFor="effective-from">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  เริ่มใช้ตั้งแต่วันที่ *
                </div>
              </Label>
              <Input
                id="effective-from"
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                การเปลี่ยนแปลงจะมีผลตั้งแต่วันที่นี้เป็นต้นไป — ไม่กระทบข้อมูลที่บันทึกไปแล้ว
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="shift-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="shift-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingShift ? 'Update' : 'Create'}
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
                ? `ต้องการปิดกะ "${deletingShift?.name}" หรือไม่? กะจะถูกเปลี่ยนสถานะเป็น Inactive — ข้อมูลที่บันทึกไปแล้วจะไม่ได้รับผลกระทบ\n\nหากมี Event ที่กำลัง Run อยู่ในกะนี้ ระบบจะไม่อนุญาตให้ปิด`
                : `ต้องการลบกะ "${deletingShift?.name}" ออกจากระบบถาวรหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้\n\nหากมีข้อมูล Shift Calendar อ้างอิงอยู่ ระบบจะไม่อนุญาตให้ลบ`
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
        }}
      />
    </div>
  );
}
