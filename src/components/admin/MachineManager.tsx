import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Clock, Download, Upload } from 'lucide-react';
import { type TimeUnit, TIME_UNIT_LABELS, TIME_UNIT_SHORT, fromSeconds, toSeconds, getInputStep, getInputMin, resolveTimeUnit, toOutputRate, fromOutputRate } from '@/lib/timeUnitUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { exportMasterDataToExcel, parseImportFile } from '@/lib/masterDataExport';
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
  time_unit: string;
  target_oee: number;
  target_availability: number;
  target_performance: number;
  target_quality: number;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [filterLineId, setFilterLineId] = useState<string>('all');
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    line_id: '', 
    company_id: '',
    ideal_cycle_time_seconds: 60,
    time_unit: 'minutes' as string,
    target_oee: 85,
    target_availability: 90,
    target_performance: 95,
    target_quality: 99,
    is_active: true 
  });
  // Display value for output rate (pieces per minute)
  const [outputRateDisplay, setOutputRateDisplay] = useState<number>(1);
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
        .order('code');
      
      // Filter by selected company if available
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Also fetch lines for filter dropdown (using the main company context)
  const { data: filterLines } = useQuery({
    queryKey: ['admin-lines-filter', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('lines')
        .select('id, name, plant_id, company_id, plants(name)')
        .eq('is_active', true)
        .order('name');
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Line[];
    },
  });

  const filteredMachines = machines?.filter((m) => {
    if (filterLineId && filterLineId !== 'all') {
      return m.line_id === filterLineId;
    }
    return true;
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
          time_unit: data.time_unit,
          target_oee: data.target_oee,
          target_availability: data.target_availability,
          target_performance: data.target_performance,
          target_quality: data.target_quality,
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
          time_unit: data.time_unit,
          target_oee: data.target_oee,
          target_availability: data.target_availability,
          target_performance: data.target_performance,
          target_quality: data.target_quality,
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
    setFormData({ name: '', code: '', line_id: '', company_id: selectedCompanyId || companies?.[0]?.id || '', ideal_cycle_time_seconds: 60, time_unit: 'minutes', target_oee: 85, target_availability: 90, target_performance: 95, target_quality: 99, is_active: true });
    setOutputRateDisplay(1);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setSelectedCompanyIdForForm(machine.company_id);
    const unit = resolveTimeUnit(machine.time_unit);
    setFormData({ 
      name: machine.name, 
      code: machine.code, 
      line_id: machine.line_id, 
      company_id: machine.company_id,
      ideal_cycle_time_seconds: machine.ideal_cycle_time_seconds,
      time_unit: unit,
      target_oee: machine.target_oee ?? 85,
      target_availability: machine.target_availability ?? 90,
      target_performance: machine.target_performance ?? 95,
      target_quality: machine.target_quality ?? 99,
      is_active: machine.is_active 
    });
    setOutputRateDisplay(Math.round(toOutputRate(machine.ideal_cycle_time_seconds)));
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMachine(null);
    setSelectedCompanyIdForForm(selectedCompanyId || '');
    setFormData({ name: '', code: '', line_id: '', company_id: selectedCompanyId || '', ideal_cycle_time_seconds: 60, time_unit: 'minutes', target_oee: 85, target_availability: 90, target_performance: 95, target_quality: 99, is_active: true });
    setOutputRateDisplay(1);
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

  const MACHINE_EXPORT_COLUMNS = [
    { key: 'code', header: 'Code', type: 'string' as const },
    { key: 'name', header: 'Name', type: 'string' as const },
    { key: 'line_name', header: 'Line', type: 'string' as const },
    { key: 'plant_name', header: 'Plant', type: 'string' as const },
    { key: 'output_rate', header: 'Output Rate (pcs/min)', type: 'number' as const },
    { key: 'ideal_cycle_time_seconds', header: 'Cycle Time (s)', type: 'number' as const },
    { key: 'target_oee', header: 'Target OEE (%)', type: 'number' as const },
    { key: 'target_availability', header: 'Target Availability (%)', type: 'number' as const },
    { key: 'target_performance', header: 'Target Performance (%)', type: 'number' as const },
    { key: 'target_quality', header: 'Target Quality (%)', type: 'number' as const },
    { key: 'is_active', header: 'Status', type: 'boolean' as const },
  ];

  const handleExport = async () => {
    if (!filteredMachines?.length) { toast.error('ไม่มีข้อมูลให้ export'); return; }
    const exportData = filteredMachines.map((m: any) => ({
      code: m.code,
      name: m.name,
      line_name: m.lines?.name || '',
      plant_name: m.lines?.plants?.name || '',
      output_rate: Math.round(toOutputRate(m.ideal_cycle_time_seconds)),
      ideal_cycle_time_seconds: m.ideal_cycle_time_seconds,
      target_oee: m.target_oee ?? 85,
      target_availability: m.target_availability ?? 90,
      target_performance: m.target_performance ?? 95,
      target_quality: m.target_quality ?? 99,
      is_active: m.is_active,
    }));
    await exportMasterDataToExcel(exportData, MACHINE_EXPORT_COLUMNS, `machines_${company?.name || 'all'}`);
    toast.success('Export สำเร็จ');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;
    setIsImporting(true);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); return; }

      // Build line lookup: "lineName (plantName)" or just lineName -> line_id
      const lineMap = new Map<string, string>();
      (filterLines || []).forEach(l => {
        lineMap.set(l.name.toLowerCase(), l.id);
        if (l.plants?.name) {
          lineMap.set(`${l.name} (${l.plants.name})`.toLowerCase(), l.id);
        }
      });

      let inserted = 0, updated = 0, skipped = 0;

      for (const row of parsed) {
        const code = (row['code'] || '').trim();
        const name = (row['name'] || '').trim();
        if (!code || !name) { skipped++; continue; }

        const lineName = (row['line'] || '').toLowerCase().trim();
        const lineId = lineMap.get(lineName);
        if (!lineId) { skipped++; continue; }

        const cycleTimeRaw = parseFloat(row['cycle time (s)'] || row['ideal_cycle_time_seconds'] || '');
        const outputRateRaw = parseFloat(row['output rate (pcs/min)'] || row['output_rate'] || '');
        let cycleTime = 60;
        if (!isNaN(cycleTimeRaw) && cycleTimeRaw > 0) cycleTime = cycleTimeRaw;
        else if (!isNaN(outputRateRaw) && outputRateRaw > 0) cycleTime = fromOutputRate(outputRateRaw);

        const targetOee = parseFloat(row['target oee (%)'] || row['target_oee'] || '85');
        const targetAvail = parseFloat(row['target availability (%)'] || row['target_availability'] || '90');
        const targetPerf = parseFloat(row['target performance (%)'] || row['target_performance'] || '95');
        const targetQual = parseFloat(row['target quality (%)'] || row['target_quality'] || '99');
        const statusVal = row['status'] || '';
        const isActive = statusVal ? statusVal.toLowerCase() === 'active' : true;

        // Check if machine already exists by code
        const existing = machines?.find(m => m.code.toLowerCase() === code.toLowerCase());
        if (existing) {
          const { error } = await supabase.from('machines').update({
            name, line_id: lineId,
            ideal_cycle_time_seconds: cycleTime,
            target_oee: isNaN(targetOee) ? 85 : targetOee,
            target_availability: isNaN(targetAvail) ? 90 : targetAvail,
            target_performance: isNaN(targetPerf) ? 95 : targetPerf,
            target_quality: isNaN(targetQual) ? 99 : targetQual,
            is_active: isActive,
          }).eq('id', existing.id);
          if (error) skipped++; else updated++;
        } else {
          const { error } = await supabase.from('machines').insert({
            code, name, line_id: lineId,
            company_id: selectedCompanyId,
            ideal_cycle_time_seconds: cycleTime,
            target_oee: isNaN(targetOee) ? 85 : targetOee,
            target_availability: isNaN(targetAvail) ? 90 : targetAvail,
            target_performance: isNaN(targetPerf) ? 95 : targetPerf,
            target_quality: isNaN(targetQual) ? 99 : targetQual,
            is_active: isActive,
          });
          if (error) skipped++; else inserted++;
        }
      }

      toast.success(`นำเข้าสำเร็จ: เพิ่ม ${inserted}, อัปเดต ${updated}${skipped ? `, ข้าม ${skipped}` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] });
    } catch { toast.error('ไม่สามารถอ่านไฟล์ได้'); }
    finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">Machines</h3>
        <div className="flex-1" />
        <Select value={filterLineId} onValueChange={setFilterLineId}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="กรองตามไลน์" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกไลน์</SelectItem>
            {filterLines?.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                {line.name} ({line.plants?.name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={!filteredMachines?.length}>
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          <Upload className="h-4 w-4" />
          {isImporting ? 'กำลังนำเข้า...' : 'Import'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
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
              <TableHead>Output Rate</TableHead>
              <TableHead>Target OEE</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMachines?.map((machine) => {
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
                  <TableCell>
                    {Math.round(toOutputRate(machine.ideal_cycle_time_seconds))} ชิ้น/นาที
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{machine.target_oee ?? 85}%</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      (A:{machine.target_availability ?? 90} P:{machine.target_performance ?? 95} Q:{machine.target_quality ?? 99})
                    </span>
                  </TableCell>
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
            {filteredMachines?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
              <Label>หน่วยเวลา (Time Unit)</Label>
              <Select
                value={formData.time_unit}
                onValueChange={(v) => {
                  const newUnit = v as TimeUnit;
                  setFormData({ ...formData, time_unit: newUnit });
                }}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">{TIME_UNIT_LABELS.seconds}</SelectItem>
                  <SelectItem value="minutes">{TIME_UNIT_LABELS.minutes}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="output_rate">Output Rate (ชิ้น/นาที)</Label>
              <Input
                id="output_rate"
                type="number"
                min="0.01"
                step="0.1"
                value={outputRateDisplay}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setOutputRateDisplay(val);
                  setFormData({ ...formData, ideal_cycle_time_seconds: fromOutputRate(val) });
                }}
              />
            </div>

            {/* Target OEE Section */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-sm font-semibold">🎯 Target OEE (%)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="target_oee" className="text-xs text-muted-foreground">OEE</Label>
                  <Input
                    id="target_oee"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.target_oee}
                    onChange={(e) => setFormData({ ...formData, target_oee: parseFloat(e.target.value) || 85 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="target_availability" className="text-xs text-muted-foreground">Availability</Label>
                  <Input
                    id="target_availability"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.target_availability}
                    onChange={(e) => setFormData({ ...formData, target_availability: parseFloat(e.target.value) || 90 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="target_performance" className="text-xs text-muted-foreground">Performance</Label>
                  <Input
                    id="target_performance"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.target_performance}
                    onChange={(e) => setFormData({ ...formData, target_performance: parseFloat(e.target.value) || 95 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="target_quality" className="text-xs text-muted-foreground">Quality</Label>
                  <Input
                    id="target_quality"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.target_quality}
                    onChange={(e) => setFormData({ ...formData, target_quality: parseFloat(e.target.value) || 99 })}
                  />
                </div>
              </div>
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
