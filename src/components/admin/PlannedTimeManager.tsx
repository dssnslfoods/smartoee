import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, Loader2, Clock, Factory, CalendarDays, PauseCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChangeHistory } from './ChangeHistory';

interface PlannedTimeTemplate {
  id: string;
  company_id: string;
  plant_id: string;
  shift_id: string;
  break_minutes: number;
  meal_minutes: number;
  meeting_minutes: number;
  maintenance_minutes: number;
  other_minutes: number;
  other_label: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  is_active: boolean;
  effective_from: string;
  plants?: { id: string; name: string; code: string | null } | null;
  shifts?: { id: string; name: string; start_time: string; end_time: string } | null;
}

const emptyForm = {
  plant_id: '',
  shift_id: '',
  break_minutes: 0,
  meal_minutes: 0,
  meeting_minutes: 0,
  maintenance_minutes: 0,
  other_minutes: 0,
  other_label: '',
  break_start_time: '',
  is_active: true,
  effective_from: new Date().toISOString().slice(0, 10),
};

export function PlannedTimeManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const selectedCompanyId = company?.id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<PlannedTimeTemplate | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copySourcePlantId, setCopySourcePlantId] = useState('');
  const [copyTargetPlantId, setCopyTargetPlantId] = useState('');

  // Fetch plants for the selected company
  const { data: plants } = useQuery({
    queryKey: ['admin-plants-dropdown', selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from('plants').select('id, name, code').eq('is_active', true).order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch shifts
  const { data: shifts } = useQuery({
    queryKey: ['admin-shifts-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('id, name, start_time, end_time').eq('is_active', true).order('start_time');
      if (error) throw error;
      return data;
    },
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['planned-time-templates', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('planned_time_templates')
        .select('*, plants(id, name, code), shifts(id, name, start_time, end_time)')
        .order('created_at', { ascending: false });
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PlannedTimeTemplate[];
    },
  });

  const totalDeduction = formData.break_minutes + formData.meal_minutes + formData.meeting_minutes + formData.maintenance_minutes + formData.other_minutes;

  // Get shift planned time for preview
  const selectedShift = shifts?.find(s => s.id === formData.shift_id);
  const shiftDurationMinutes = selectedShift
    ? (() => {
        const [sh, sm] = selectedShift.start_time.split(':').map(Number);
        const [eh, em] = selectedShift.end_time.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff <= 0) diff += 24 * 60; // overnight
        return diff;
      })()
    : null;

  const plannedProductionTime = shiftDurationMinutes != null ? shiftDurationMinutes - totalDeduction : null;

  // Helper to calculate break_end_time from break_start_time + break_minutes
  const calcBreakEndTime = (startTime: string, breakMin: number): string | null => {
    if (!startTime) return null;
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + breakMin;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const upsertMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!selectedCompanyId) throw new Error('กรุณาเลือกบริษัทก่อน');

      const breakEndTime = calcBreakEndTime(data.break_start_time, data.break_minutes);

      const payload = {
        company_id: selectedCompanyId,
        plant_id: data.plant_id,
        shift_id: data.shift_id,
        break_minutes: data.break_minutes,
        meal_minutes: data.meal_minutes,
        meeting_minutes: data.meeting_minutes,
        maintenance_minutes: data.maintenance_minutes,
        other_minutes: data.other_minutes,
        other_label: data.other_label || null,
        break_start_time: data.break_start_time || null,
        break_end_time: breakEndTime,
        is_active: data.is_active,
        effective_from: data.effective_from,
      };

      if (data.id) {
        const { error } = await supabase.from('planned_time_templates').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('planned_time_templates').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-time-templates'] });
      toast.success(editingId ? 'อัปเดตสำเร็จ' : 'สร้างสำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key') || error.message.includes('unique')) {
        toast.error('มีข้อมูลสำหรับ Plant + Shift นี้อยู่แล้ว');
      } else {
        toast.error(error.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: PlannedTimeTemplate) => {
      if (template.is_active) {
        // Active template: soft-delete (set is_active = false)
        // Check for running events first
        const { data: scIds } = await supabase
          .from('shift_calendar')
          .select('id')
          .eq('plant_id', template.plant_id)
          .eq('shift_id', template.shift_id);

        const calendarIds = scIds?.map(sc => sc.id) || [];

        if (calendarIds.length > 0) {
          const { data: runningEvents, error: checkError } = await supabase
            .from('production_events')
            .select('id')
            .is('end_ts', null)
            .in('shift_calendar_id', calendarIds)
            .limit(1);

          if (checkError) throw checkError;

          if (runningEvents && runningEvents.length > 0) {
            throw new Error('ไม่สามารถปิด Template ได้ เนื่องจากยังมี Event ที่กำลัง Run อยู่ใน Plant + Shift นี้');
          }
        }

        const { error } = await supabase
          .from('planned_time_templates')
          .update({ is_active: false })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        // Inactive template: hard-delete
        const { error } = await supabase
          .from('planned_time_templates')
          .delete()
          .eq('id', template.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, template) => {
      queryClient.invalidateQueries({ queryKey: ['planned-time-templates'] });
      toast.success(
        template.is_active
          ? 'ปิด Template เรียบร้อยแล้ว — ข้อมูลที่บันทึกไปแล้วไม่ได้รับผลกระทบ'
          : 'ลบ Template ถาวรเรียบร้อยแล้ว'
      );
      setIsDeleteOpen(false);
      setDeletingTemplate(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyFromPlantMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      if (!selectedCompanyId) throw new Error('กรุณาเลือกบริษัทก่อน');
      if (sourceId === targetId) throw new Error('ต้นทางและปลายทางต้องเป็นคนละ Plant');

      // Fetch source templates
      const { data: sourceTemplates, error: fetchErr } = await supabase
        .from('planned_time_templates')
        .select('*')
        .eq('plant_id', sourceId)
        .eq('company_id', selectedCompanyId)
        .eq('is_active', true);
      if (fetchErr) throw fetchErr;
      if (!sourceTemplates || sourceTemplates.length === 0) {
        throw new Error('ไม่พบ Template ที่ Active ใน Plant ต้นทาง');
      }

      // Insert copies for target plant
      const newRows = sourceTemplates.map(t => ({
        company_id: selectedCompanyId,
        plant_id: targetId,
        shift_id: t.shift_id,
        break_minutes: t.break_minutes,
        meal_minutes: t.meal_minutes,
        meeting_minutes: t.meeting_minutes,
        maintenance_minutes: t.maintenance_minutes,
        other_minutes: t.other_minutes,
        other_label: t.other_label,
        break_start_time: t.break_start_time,
        break_end_time: t.break_end_time,
        is_active: true,
        effective_from: new Date().toISOString().slice(0, 10),
      }));

      const { error: insertErr } = await supabase.from('planned_time_templates').insert(newRows);
      if (insertErr) throw insertErr;

      return sourceTemplates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['planned-time-templates'] });
      toast.success(`คัดลอก ${count} Template สำเร็จ`);
      setIsCopyDialogOpen(false);
      setCopySourcePlantId('');
      setCopyTargetPlantId('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDuplicateRow = (t: PlannedTimeTemplate) => {
    setEditingId(null);
    setFormData({
      plant_id: t.plant_id,
      shift_id: t.shift_id,
      break_minutes: t.break_minutes,
      meal_minutes: t.meal_minutes,
      meeting_minutes: t.meeting_minutes,
      maintenance_minutes: t.maintenance_minutes,
      other_minutes: t.other_minutes,
      other_label: t.other_label || '',
      break_start_time: t.break_start_time?.slice(0, 5) || '',
      is_active: true,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setIsDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (t: PlannedTimeTemplate) => {
    setEditingId(t.id);
    setFormData({
      plant_id: t.plant_id,
      shift_id: t.shift_id,
      break_minutes: t.break_minutes,
      meal_minutes: t.meal_minutes,
      meeting_minutes: t.meeting_minutes,
      maintenance_minutes: t.maintenance_minutes,
      other_minutes: t.other_minutes,
      other_label: t.other_label || '',
      break_start_time: t.break_start_time?.slice(0, 5) || '',
      is_active: t.is_active,
      effective_from: t.effective_from || new Date().toISOString().slice(0, 10),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = () => {
    if (!formData.plant_id) { toast.error('กรุณาเลือก Plant'); return; }
    if (!formData.shift_id) { toast.error('กรุณาเลือก Shift'); return; }
    if (totalDeduction < 0) { toast.error('เวลาหักต้องไม่ติดลบ'); return; }
    if (plannedProductionTime != null && plannedProductionTime < 0) {
      toast.error('เวลาหักรวมมากกว่าเวลากะทั้งหมด');
      return;
    }
    // Validate break_start_time only if break_minutes > 0
    // break_end_time is auto-calculated
    upsertMutation.mutate(editingId ? { ...formData, id: editingId } : formData);
  };

  const getTotalDeduction = (t: PlannedTimeTemplate) =>
    t.break_minutes + t.meal_minutes + t.meeting_minutes + t.maintenance_minutes + t.other_minutes;

  const getShiftDuration = (t: PlannedTimeTemplate) => {
    if (!t.shifts) return null;
    const [sh, sm] = t.shifts.start_time.split(':').map(Number);
    const [eh, em] = t.shifts.end_time.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  };

  const formatTime = (timeStr: string) => timeStr?.slice(0, 5) || '';

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Factory className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold">เลือกบริษัทก่อน</h3>
        <p className="text-muted-foreground text-sm mt-1">
          กรุณาเลือกบริษัทจาก sidebar เพื่อจัดการ Planned Production Time
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Planned Production Time</h3>
          <p className="text-sm text-muted-foreground">กำหนดเวลาหัก (Deductions) ต่อ Plant + Shift เพื่อคำนวณ Availability</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsCopyDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />
            คัดลอกจาก Plant อื่น
          </Button>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่ม Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plant</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>เริ่มใช้ตั้งแต่</TableHead>
              <TableHead className="text-right">พักเบรค</TableHead>
              <TableHead className="text-right">พักทานอาหาร</TableHead>
              <TableHead className="text-right">ประชุม</TableHead>
              <TableHead className="text-right">บำรุงรักษา</TableHead>
              <TableHead className="text-right">อื่นๆ</TableHead>
              <TableHead className="text-right">รวมหัก</TableHead>
              <TableHead>Auto-Stop พัก</TableHead>
              <TableHead className="text-right">Planned Prod. Time</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates?.map((t) => {
              const ded = getTotalDeduction(t);
              const shiftDur = getShiftDuration(t);
              const ppt = shiftDur != null ? shiftDur - ded : null;
              return (
                <TableRow key={t.id}>
                <TableCell className="font-medium">{t.plants?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t.shifts?.name || '-'}</span>
                      {t.shifts && (
                        <span className="text-xs text-muted-foreground">
                          ({formatTime(t.shifts.start_time)}-{formatTime(t.shifts.end_time)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm tabular-nums">
                        {t.effective_from ? format(new Date(t.effective_from + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.break_minutes}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.meal_minutes}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.meeting_minutes}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.maintenance_minutes}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.other_minutes > 0 ? (
                      <span title={t.other_label || undefined}>{t.other_minutes}</span>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{ded} นาที</TableCell>
                  <TableCell>
                    {t.break_start_time ? (() => {
                      const endTime = calcBreakEndTime((t.break_start_time as string).slice(0, 5), t.break_minutes);
                      return (
                        <Badge variant="outline" className="gap-1">
                          <PauseCircle className="h-3 w-3" />
                          {(t.break_start_time as string).slice(0, 5)}-{endTime}
                        </Badge>
                      );
                    })() : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-primary">
                    {ppt != null ? `${ppt} นาที` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicateRow(t)} title="คัดลอก Template">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingTemplate(t); setIsDeleteOpen(true); }}
                        title={t.is_active ? 'ปิดใช้งาน (Soft Delete)' : 'ลบถาวร (Hard Delete)'}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {templates?.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  ยังไม่มี Template — กดปุ่ม "เพิ่ม Template" เพื่อเริ่มกำหนดเวลาหัก
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไข Template' : 'เพิ่ม Planned Production Time'}</DialogTitle>
            <DialogDescription>
              กำหนดเวลาหักต่างๆ ที่จะถูกนำไปหักจากเวลากะทั้งหมด
            </DialogDescription>
          </DialogHeader>

          {/* Plant + Shift selectors - full width */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plant *</Label>
              <Select value={formData.plant_id} onValueChange={v => setFormData(p => ({ ...p, plant_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Plant" />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.code && `(${p.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={formData.shift_id} onValueChange={v => setFormData(p => ({ ...p, shift_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({formatTime(s.start_time)}-{formatTime(s.end_time)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2-column landscape layout */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Left column: Deduction fields */}
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-muted-foreground">รายการเวลาหัก (นาที)</h4>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">พักเบรค (Break)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.break_minutes}
                    onChange={e => setFormData(p => ({ ...p, break_minutes: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">พักทานอาหาร (Meal)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.meal_minutes}
                    onChange={e => setFormData(p => ({ ...p, meal_minutes: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ประชุม (Meeting)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.meeting_minutes}
                    onChange={e => setFormData(p => ({ ...p, meeting_minutes: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">บำรุงรักษาตามแผน (Maintenance)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.maintenance_minutes}
                    onChange={e => setFormData(p => ({ ...p, maintenance_minutes: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">อื่นๆ (Other)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.other_minutes}
                      onChange={e => setFormData(p => ({ ...p, other_minutes: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ชื่อรายการอื่นๆ</Label>
                    <Input
                      value={formData.other_label}
                      onChange={e => setFormData(p => ({ ...p, other_label: e.target.value }))}
                      placeholder="เช่น ทำความสะอาด"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Auto-Stop + Settings + Summary */}
            <div className="space-y-4">
              {/* Auto-Break Stop Schedule */}
              <div className="space-y-3 rounded-lg border border-dashed border-orange-300 dark:border-orange-700 p-4">
                <div className="flex items-center gap-2">
                  <PauseCircle className="h-4 w-4 text-orange-500" />
                  <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Auto-Stop พักกลางวัน</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  ระบบจะหยุดเครื่องจักรอัตโนมัติเมื่อถึงเวลาพัก (ไม่บังคับ)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">เวลาเริ่มพัก</Label>
                    <Input
                      type="time"
                      value={formData.break_start_time}
                      onChange={e => setFormData(p => ({ ...p, break_start_time: e.target.value }))}
                      placeholder="12:00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">สิ้นสุด (อัตโนมัติ)</Label>
                    <Input
                      type="time"
                      value={calcBreakEndTime(formData.break_start_time, formData.break_minutes) || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                {formData.break_start_time && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    ⏸ หยุดอัตโนมัติ {formData.break_start_time} น. (พัก {formData.break_minutes} นาที ถึง {calcBreakEndTime(formData.break_start_time, formData.break_minutes)} น.)
                  </p>
                )}
              </div>

              {/* Effective From + Active */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      เริ่มใช้ตั้งแต่ *
                    </div>
                  </Label>
                  <Input
                    type="date"
                    value={formData.effective_from}
                    onChange={e => setFormData(p => ({ ...p, effective_from: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id="template-active"
                    checked={formData.is_active}
                    onCheckedChange={checked => setFormData(p => ({ ...p, is_active: checked }))}
                  />
                  <Label htmlFor="template-active">Active</Label>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">เวลากะทั้งหมด</span>
                  <span className="font-medium tabular-nums">
                    {shiftDurationMinutes != null ? `${shiftDurationMinutes} นาที` : '— เลือก Shift —'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">รวมเวลาหัก</span>
                  <span className="font-medium tabular-nums text-destructive">- {totalDeduction} นาที</span>
                </div>
                <div className="border-t my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Planned Production Time</span>
                  <span className={`tabular-nums ${plannedProductionTime != null && plannedProductionTime < 0 ? 'text-destructive' : 'text-primary'}`}>
                    {plannedProductionTime != null ? `${plannedProductionTime} นาที` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'อัปเดต' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingTemplate?.is_active ? 'ปิดการใช้งาน Template' : 'ลบ Template ถาวร'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTemplate?.is_active ? (
                <>
                  ต้องการปิด Template สำหรับ "{deletingTemplate?.plants?.name}" / "{deletingTemplate?.shifts?.name}" หรือไม่?
                  Template จะถูกเปลี่ยนสถานะเป็น Inactive — ข้อมูลที่บันทึกไปแล้วจะไม่ได้รับผลกระทบ
                  {'\n\n'}หากมี Event ที่กำลัง Run อยู่ใน Plant + Shift นี้ ระบบจะไม่อนุญาตให้ปิด
                </>
              ) : (
                <>
                  ต้องการลบ Template สำหรับ "{deletingTemplate?.plants?.name}" / "{deletingTemplate?.shifts?.name}" ออกจากระบบถาวรหรือไม่?
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplate && deleteMutation.mutate(deletingTemplate)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {deletingTemplate?.is_active ? 'ปิดการใช้งาน' : 'ลบถาวร'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy from Plant Dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>คัดลอก Template จาก Plant อื่น</DialogTitle>
            <DialogDescription>
              คัดลอก Planned Time Templates ทั้งหมดที่ Active จาก Plant ต้นทาง ไปยัง Plant ปลายทาง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plant ต้นทาง (คัดลอกจาก)</Label>
              <Select value={copySourcePlantId} onValueChange={setCopySourcePlantId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Plant ต้นทาง" />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.code && `(${p.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plant ปลายทาง (คัดลอกไปยัง)</Label>
              <Select value={copyTargetPlantId} onValueChange={setCopyTargetPlantId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Plant ปลายทาง" />
                </SelectTrigger>
                <SelectContent>
                  {plants?.filter(p => p.id !== copySourcePlantId).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.code && `(${p.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {copySourcePlantId && copyTargetPlantId && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p>Templates ที่ Active ทั้งหมดจาก <strong>{plants?.find(p => p.id === copySourcePlantId)?.name}</strong> จะถูกคัดลอกไปยัง <strong>{plants?.find(p => p.id === copyTargetPlantId)?.name}</strong></p>
                <p className="mt-1">วันที่เริ่มใช้จะถูกตั้งเป็นวันนี้</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCopyDialogOpen(false); setCopySourcePlantId(''); setCopyTargetPlantId(''); }}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => copyFromPlantMutation.mutate({ sourceId: copySourcePlantId, targetId: copyTargetPlantId })}
              disabled={!copySourcePlantId || !copyTargetPlantId || copyFromPlantMutation.isPending}
            >
              {copyFromPlantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              คัดลอก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change History */}
      <ChangeHistory
        entityType="planned_time_templates"
        title="ประวัติการเปลี่ยนแปลง Planned Time"
        displayFields={{
          break_minutes: 'พักเบรค (นาที)',
          meal_minutes: 'พักทานอาหาร (นาที)',
          meeting_minutes: 'ประชุม (นาที)',
          maintenance_minutes: 'บำรุงรักษา (นาที)',
          other_minutes: 'อื่นๆ (นาที)',
          other_label: 'ชื่อรายการอื่นๆ',
          break_start_time: 'เวลาเริ่มพัก (Auto-Stop)',
          break_end_time: 'เวลาสิ้นสุดพัก (Auto-Stop)',
          is_active: 'สถานะ',
          effective_from: 'เริ่มใช้ตั้งแต่',
        }}
      />
    </div>
  );
}
