import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Cpu, Package, AlertTriangle, Factory, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/hooks/useAuth';
import { resolveTimeUnit, fromSeconds, toSeconds, TIME_UNIT_SHORT, getInputStep, getInputMin, toOutputRate, fromOutputRate } from '@/lib/timeUnitUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  exportMasterDataToExcel, exportMasterDataToCSV,
  parseImportFile,
} from '@/lib/masterDataExport';

interface ProductionStandard {
  id: string;
  machine_id: string;
  product_id: string;
  company_id: string;
  ideal_cycle_time_seconds: number;
  std_setup_time_seconds: number;
  target_quality: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  machines?: { name: string; code: string; ideal_cycle_time_seconds: number } | null;
  products?: { name: string; code: string } | null;
}

interface PlantOption {
  id: string;
  name: string;
  code: string;
}

interface MachineOption {
  id: string;
  name: string;
  code: string;
  ideal_cycle_time_seconds: number;
  time_unit?: string;
  plant_id?: string | null;
  lines?: { name: string; plant_id?: string | null; plants?: { id: string; name: string } | null } | null;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
}

export function ProductionStandardsManager() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const selectedCompanyId = company?.id;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('all');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingStandard, setEditingStandard] = useState<ProductionStandard | null>(null);
  const [deletingStandard, setDeletingStandard] = useState<ProductionStandard | null>(null);
  const [formData, setFormData] = useState({
    machine_id: '',
    product_id: '',
    ideal_cycle_time_seconds: 60,
    std_setup_time_seconds: 0,
    target_quality: 99,
    is_active: true,
  });

  // Fetch plants
  const { data: plants = [] } = useQuery({
    queryKey: ['ps-plants', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('plants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PlantOption[];
    },
  });

  // Fetch machines
  const { data: machines = [] } = useQuery({
    queryKey: ['ps-machines', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('machines')
        .select('id, name, code, ideal_cycle_time_seconds, time_unit, lines(name, plant_id, plants(id, name))')
        .eq('is_active', true)
        .order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MachineOption[];
    },
  });

  // Filter machines by selected plant
  const filteredMachines = useMemo(() => {
    if (selectedPlantFilter === 'all') return machines;
    return machines.filter(m => m.lines?.plants?.id === selectedPlantFilter);
  }, [machines, selectedPlantFilter]);

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['ps-products', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductOption[];
    },
  });

  // Fetch production standards (raw)
  const { data: rawStandards = [], isLoading } = useQuery({
    queryKey: ['production-standards', selectedCompanyId, selectedMachineFilter],
    queryFn: async () => {
      let query = supabase
        .from('production_standards')
        .select('*')
        .order('created_at', { ascending: false });
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedMachineFilter && selectedMachineFilter !== 'all') {
        query = query.eq('machine_id', selectedMachineFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Enrich standards with machine and product names reactively
  const standards: ProductionStandard[] = useMemo(() => {
    return rawStandards.map(s => ({
      ...s,
      machines: machines.find(m => m.id === s.machine_id)
        ? { name: machines.find(m => m.id === s.machine_id)!.name, code: machines.find(m => m.id === s.machine_id)!.code, ideal_cycle_time_seconds: machines.find(m => m.id === s.machine_id)!.ideal_cycle_time_seconds }
        : null,
      products: products.find(p => p.id === s.product_id)
        ? { name: products.find(p => p.id === s.product_id)!.name, code: products.find(p => p.id === s.product_id)!.code }
        : null,
    })) as ProductionStandard[];
  }, [rawStandards, machines, products]);

  // Validation: check if SKU cycle time is faster than machine capacity
  const selectedMachine = machines.find(m => m.id === formData.machine_id);
  const cycleTimeWarning = useMemo(() => {
    if (!selectedMachine || !formData.ideal_cycle_time_seconds) return null;
    if (formData.ideal_cycle_time_seconds < selectedMachine.ideal_cycle_time_seconds) {
      return `Warning: SKU output rate (${toOutputRate(formData.ideal_cycle_time_seconds).toFixed(1)} ชิ้น/นาที) เร็วกว่า Machine capacity (${toOutputRate(selectedMachine.ideal_cycle_time_seconds).toFixed(1)} ชิ้น/นาที)`;
    }
    return null;
  }, [formData.ideal_cycle_time_seconds, selectedMachine]);

  // Already assigned product IDs for the selected machine (to prevent duplicates)
  const assignedProductIds = useMemo(() => {
    if (!formData.machine_id) return new Set<string>();
    return new Set(
      standards
        .filter(s => s.machine_id === formData.machine_id && s.id !== editingStandard?.id)
        .map(s => s.product_id)
    );
  }, [standards, formData.machine_id, editingStandard]);

  const availableProducts = products.filter(p => !assignedProductIds.has(p.id));

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('production_standards').insert({
        machine_id: data.machine_id,
        product_id: data.product_id,
        company_id: selectedCompanyId!,
        ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
        std_setup_time_seconds: data.std_setup_time_seconds,
        target_quality: data.target_quality,
        is_active: data.is_active,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-standards'] });
      toast.success('สร้าง Production Standard สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        toast.error('Machine + SKU combination already exists');
      } else {
        toast.error(error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('production_standards').update({
        ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
        std_setup_time_seconds: data.std_setup_time_seconds,
        target_quality: data.target_quality,
        is_active: data.is_active,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-standards'] });
      toast.success('อัปเดต Production Standard สำเร็จ');
      handleCloseDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('production_standards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-standards'] });
      toast.success('ลบ Production Standard สำเร็จ');
      setIsDeleteOpen(false);
      setDeletingStandard(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from('production_standards').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-standards'] });
      toast.success(`นำเข้าข้อมูลสำเร็จ ${variables.length} รายการ`);
    },
    onError: (error: Error) => toast.error(`นำเข้าข้อมูลล้มเหลว: ${error.message}`),
  });

  const STANDARD_EXPORT_COLUMNS = [
    { key: 'machine_code', header: 'Machine Code', type: 'string' as const },
    { key: 'machine_name', header: 'Machine Name', type: 'string' as const },
    { key: 'product_code', header: 'Product Code', type: 'string' as const },
    { key: 'product_name', header: 'Product Name', type: 'string' as const },
    { key: 'ideal_cycle_time_seconds', header: 'Cycle Time (s)', type: 'number' as const },
    { key: 'std_setup_time_seconds', header: 'Setup Time (s)', type: 'number' as const },
    { key: 'target_quality', header: 'Target Quality (%)', type: 'number' as const },
    { key: 'is_active', header: 'Status', type: 'boolean' as const },
  ];

  const exportData = useMemo(() => {
    return standards.map(s => ({
      machine_code: s.machines?.code ?? '',
      machine_name: s.machines?.name ?? '',
      product_code: s.products?.code ?? '',
      product_name: s.products?.name ?? '',
      ideal_cycle_time_seconds: s.ideal_cycle_time_seconds,
      std_setup_time_seconds: s.std_setup_time_seconds,
      target_quality: s.target_quality,
      is_active: s.is_active,
    }));
  }, [standards]);

  const handleExportExcel = async () => {
    if (exportData.length === 0) { toast.error('ไม่มีข้อมูลให้ export'); return; }
    const companyName = company?.name || 'All';
    await exportMasterDataToExcel(exportData, STANDARD_EXPORT_COLUMNS, `production_standards_${companyName}`, 'Standards');
    toast.success('Export Excel สำเร็จ');
  };

  const handleExportCSV = () => {
    if (exportData.length === 0) { toast.error('ไม่มีข้อมูลให้ export'); return; }
    const companyName = company?.name || 'All';
    exportMasterDataToCSV(exportData, STANDARD_EXPORT_COLUMNS, `production_standards_${companyName}`);
    toast.success('Export CSV สำเร็จ');
  };

  const parseImportedRows = (parsed: Record<string, string>[]): { rows: any[]; errors: string[] } => {
    const machineByCode = new Map(machines.map(m => [m.code.toLowerCase(), m]));
    const productByCode = new Map(products.map(p => [p.code.toLowerCase(), p]));
    const rows: any[] = [];
    const errors: string[] = [];

    parsed.forEach((row, idx) => {
      // Normalize keys to lowercase for flexible matching
      const normalizedRow: Record<string, string> = {};
      Object.entries(row).forEach(([k, v]) => { normalizedRow[k.toLowerCase().trim()] = String(v ?? '').trim(); });

      const machineCode = (normalizedRow['machine code'] || normalizedRow['machine_code'] || '').toLowerCase();
      const productCode = (normalizedRow['product code'] || normalizedRow['product_code'] || '').toLowerCase();
      if (!machineCode || !productCode) {
        errors.push(`Row ${idx + 2}: Missing machine code or product code`);
        return;
      }
      const machine = machineByCode.get(machineCode);
      const product = productByCode.get(productCode);
      if (!machine) { errors.push(`Row ${idx + 2}: Machine "${machineCode}" not found`); return; }
      if (!product) { errors.push(`Row ${idx + 2}: Product "${productCode}" not found`); return; }

      const cycleTime = parseFloat(normalizedRow['cycle time (s)'] || normalizedRow['cycle_time'] || normalizedRow['ideal_cycle_time_seconds'] || '60');
      const setupTime = parseFloat(normalizedRow['setup time (s)'] || normalizedRow['setup_time'] || normalizedRow['std_setup_time_seconds'] || '0');
      const quality = parseFloat(normalizedRow['target quality (%)'] || normalizedRow['target_quality'] || '99');
      const statusVal = normalizedRow['status'];
      const status = statusVal ? statusVal.toLowerCase() === 'active' : true;

      rows.push({
        machine_id: machine.id,
        product_id: product.id,
        company_id: selectedCompanyId,
        ideal_cycle_time_seconds: isNaN(cycleTime) ? 60 : cycleTime,
        std_setup_time_seconds: isNaN(setupTime) ? 0 : setupTime,
        target_quality: isNaN(quality) ? 99 : quality,
        is_active: status,
      });
    });

    return { rows, errors };
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedCompanyId) { toast.error('กรุณาเลือกบริษัทก่อน import'); return; }
    setIsImporting(true);
    try {
      const parsed = await parseImportFile(file);

      if (parsed.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); setIsImporting(false); return; }

      const { rows, errors } = parseImportedRows(parsed);

      if (errors.length > 0) {
        toast.error(`พบข้อผิดพลาด ${errors.length} รายการ: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      }
      if (rows.length === 0) { toast.error('ไม่พบข้อมูลที่ถูกต้อง'); setIsImporting(false); return; }
      await bulkInsertMutation.mutateAsync(rows);
    } catch { toast.error('ไม่สามารถอ่านไฟล์ได้'); }
    finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenCreate = () => {
    setEditingStandard(null);
    setFormData({
      machine_id: selectedMachineFilter !== 'all' ? selectedMachineFilter : '',
      product_id: '',
      ideal_cycle_time_seconds: 60,
      std_setup_time_seconds: 0,
      target_quality: 99,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (standard: ProductionStandard) => {
    setEditingStandard(standard);
    setFormData({
      machine_id: standard.machine_id,
      product_id: standard.product_id,
      ideal_cycle_time_seconds: standard.ideal_cycle_time_seconds,
      std_setup_time_seconds: standard.std_setup_time_seconds,
      target_quality: standard.target_quality,
      is_active: standard.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStandard(null);
  };

  const handleSubmit = () => {
    if (!formData.machine_id || !formData.product_id) {
      toast.error('กรุณาเลือก Machine และ SKU');
      return;
    }
    if (editingStandard) {
      updateMutation.mutate({ id: editingStandard.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Group standards by machine for display
  const groupedByMachine = useMemo(() => {
    const map = new Map<string, ProductionStandard[]>();
    for (const s of standards) {
      const key = s.machine_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [standards]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Production Standards (Machine × SKU)</h3>
          {company && <p className="text-sm text-muted-foreground">บริษัท: {company.name}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            กำหนด Cycle Time, Setup Time, Target Quality สำหรับแต่ละคู่ Machine-SKU
          </p>
        </div>
        {selectedCompanyId ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedPlantFilter} onValueChange={(v) => { setSelectedPlantFilter(v); setSelectedMachineFilter('all'); }}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Factory className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Filter by Plant" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plants</SelectItem>
                {plants.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMachineFilter} onValueChange={setSelectedMachineFilter}>
              <SelectTrigger className="w-[200px]">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Filter by Machine" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Machines</SelectItem>
                {filteredMachines.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleImportFile} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting || !selectedCompanyId}>
              {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={standards.length === 0}>
                  <Download className="h-4 w-4 mr-2" />Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel}>Export Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>Export CSV (.csv)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Assign SKU
            </Button>
          </div>
        ) : (
          <Alert className="max-w-sm">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">กรุณาเลือกบริษัทก่อนจัดการ Standards</AlertDescription>
          </Alert>
        )}
      </div>

      {!selectedCompanyId ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">กรุณาเลือกบริษัทจากเมนูด้านซ้ายก่อนจัดการ Standards</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : standards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
          <Cpu className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {selectedMachineFilter !== 'all'
              ? 'ไม่พบ Production Standard สำหรับเครื่องจักรนี้'
              : 'ยังไม่มี Production Standard — กด "Assign SKU" เพื่อเริ่มต้น'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Setup Time</TableHead>
              <TableHead>Output Rate</TableHead>
              <TableHead>Target Quality</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standards.map((standard) => (
              <TableRow key={standard.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{standard.machines?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{standard.machines?.code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{standard.products?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{standard.products?.code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const machine = machines.find(m => m.id === standard.machine_id);
                    const unit = resolveTimeUnit(machine?.time_unit);
                    const unitLabel = TIME_UNIT_SHORT[unit];
                    return <span className="font-mono text-sm">{fromSeconds(standard.std_setup_time_seconds, unit).toFixed(unit === 'minutes' ? 2 : 1)}{unitLabel}</span>;
                  })()}
                </TableCell>
                <TableCell>
                  <>
                    <span className="font-mono text-sm">{toOutputRate(standard.ideal_cycle_time_seconds).toFixed(1)} ชิ้น/นาที</span>
                    {standard.machines && standard.ideal_cycle_time_seconds < standard.machines.ideal_cycle_time_seconds && (
                      <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-destructive" />
                    )}
                  </>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {standard.target_quality}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={standard.is_active ? 'text-status-running' : 'text-muted-foreground'}>
                    {standard.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(standard)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingStandard(standard); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStandard ? 'แก้ไข Production Standard' : 'Assign SKU to Machine'}
            </DialogTitle>
            <DialogDescription>
              {editingStandard
                ? 'แก้ไข benchmark สำหรับคู่ Machine-SKU นี้'
                : 'กำหนด benchmark เฉพาะสำหรับ SKU บนเครื่องจักรที่เลือก'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Machine selector (disabled when editing) */}
            <div className="space-y-2">
              <Label>Machine *</Label>
              <Select
                value={formData.machine_id}
                onValueChange={(v) => setFormData({ ...formData, machine_id: v, product_id: '' })}
                disabled={!!editingStandard}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเครื่องจักร" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMachines.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.code}) — {toOutputRate(m.ideal_cycle_time_seconds).toFixed(1)} ชิ้น/นาที
                      {m.lines?.plants?.name ? ` [${m.lines.plants.name}]` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product selector (disabled when editing) */}
            <div className="space-y-2">
              <Label>SKU / Product *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                disabled={!!editingStandard || !formData.machine_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.machine_id ? 'เลือก SKU' : 'เลือก Machine ก่อน'} />
                </SelectTrigger>
                <SelectContent>
                  {(editingStandard ? products : availableProducts).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Benchmarks */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              {(() => {
                const unit = resolveTimeUnit(selectedMachine?.time_unit);
                const unitLabel = TIME_UNIT_SHORT[unit];
                return (
                  <>
                    <Label className="text-sm font-semibold">📊 Performance Benchmarks</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Std. Setup Time ({unitLabel})</Label>
                        <Input
                          type="number"
                          min="0"
                          step={getInputStep(unit)}
                          value={fromSeconds(formData.std_setup_time_seconds, unit)}
                          onChange={(e) => setFormData({ ...formData, std_setup_time_seconds: toSeconds(parseFloat(e.target.value) || 0, unit) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Output Rate (ชิ้น/นาที)</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={parseFloat(toOutputRate(formData.ideal_cycle_time_seconds).toFixed(2))}
                          onChange={(e) => setFormData({ ...formData, ideal_cycle_time_seconds: fromOutputRate(parseFloat(e.target.value) || 1) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Target Quality (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.target_quality}
                          onChange={(e) => setFormData({ ...formData, target_quality: parseFloat(e.target.value) || 99 })}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}

              {cycleTimeWarning && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{cycleTimeWarning}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ps_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="ps_is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingStandard ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Production Standard</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ benchmark สำหรับ "{deletingStandard?.products?.name}" บน "{deletingStandard?.machines?.name}" ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStandard && deleteMutation.mutate(deletingStandard.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
