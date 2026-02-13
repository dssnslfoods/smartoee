import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Plus, Trash2, CalendarOff, RefreshCw, Palmtree, Download, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import oeeApi from '@/services/oeeApi';
import { exportMasterDataToExcel, parseImportFile, HOLIDAY_COLUMNS } from '@/lib/masterDataExport';

interface Holiday {
  id: string;
  company_id: string;
  plant_id: string | null;
  holiday_date: string;
  name: string;
  description: string | null;
  is_recurring: boolean;
  created_at: string;
}

export function HolidayManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { company, user } = useAuth();
  const companyId = company?.id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPlantId, setFormPlantId] = useState<string>('all');
  const [formRecurring, setFormRecurring] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => oeeApi.getPlants(companyId),
  });

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', companyId, filterYear],
    queryFn: async () => {
      const startDate = `${filterYear}-01-01`;
      const endDate = `${filterYear}-12-31`;
      
      let query = supabase
        .from('holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      // For recurring, show all. For non-recurring, filter by year
      query = query.or(`is_recurring.eq.true,and(holiday_date.gte.${startDate},holiday_date.lte.${endDate})`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Holiday[];
    },
    enabled: !!companyId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !formName || !formDate) throw new Error('Missing fields');
      const { error } = await supabase.from('holidays').insert({
        company_id: companyId,
        plant_id: formPlantId === 'all' ? null : formPlantId,
        holiday_date: formDate,
        name: formName,
        description: formDescription || null,
        is_recurring: formRecurring,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'เพิ่มวันหยุดพิเศษเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      resetForm();
    },
    onError: (e: Error) => {
      const msg = e.message.includes('unique') ? 'วันหยุดซ้ำ — วันนี้ถูกกำหนดไว้แล้ว' : e.message;
      toast({ title: 'ผิดพลาด', description: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ลบวันหยุดเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (e: Error) => toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormName('');
    setFormDate('');
    setFormDescription('');
    setFormPlantId('all');
    setFormRecurring(false);
    setIsDialogOpen(false);
  };

  const handleExport = async () => {
    const exportData = holidays.map(h => ({
      ...h,
      plant_name: h.plant_id ? (plants.find(p => p.id === h.plant_id)?.name || '') : 'ทุกโรงงาน',
    }));
    await exportMasterDataToExcel(exportData, HOLIDAY_COLUMNS, `holidays_${filterYear}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) {
        toast({ title: 'ไม่พบข้อมูล', description: 'ไฟล์ว่างหรือรูปแบบไม่ถูกต้อง', variant: 'destructive' });
        return;
      }

      // Build plant name -> id map
      const plantMap = new Map(plants.map(p => [p.name.toLowerCase(), p.id]));

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        const name = row['name'] || '';
        const dateStr = row['date'] || '';
        if (!name || !dateStr) { skipped++; continue; }

        // Normalize date (accept YYYY-MM-DD or DD/MM/YYYY)
        let holiday_date = dateStr;
        const slashMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
        if (slashMatch) {
          holiday_date = `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
        }

        const plantName = (row['plant'] || '').toLowerCase().trim();
        const plantId = plantName && plantName !== 'ทุกโรงงาน' && plantName !== 'all'
          ? plantMap.get(plantName) || null
          : null;

        const recurring = row['recurring'] || '';
        const is_recurring = recurring.toLowerCase() === 'active' || recurring === 'true' || recurring === '1' || recurring === 'ใช่';

        const { error } = await supabase.from('holidays').insert({
          company_id: companyId,
          plant_id: plantId,
          holiday_date,
          name,
          description: row['description'] || null,
          is_recurring,
          created_by: user?.id,
        });
        if (error) { skipped++; } else { inserted++; }
      }

      toast({
        title: 'นำเข้าสำเร็จ',
        description: `เพิ่ม ${inserted} รายการ${skipped ? `, ข้าม ${skipped} รายการ` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    } catch (err: any) {
      toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
              <Palmtree className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <CardTitle>วันหยุดพิเศษ</CardTitle>
              <CardDescription>กำหนดวันหยุดนักขัตฤกษ์และวันหยุดพิเศษล่วงหน้า</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={holidays.length === 0}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  เพิ่มวันหยุด
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>เพิ่มวันหยุดพิเศษ</DialogTitle>
                  <DialogDescription>กำหนดวันหยุดที่จะไม่ถูกนำมาคำนวณ OEE</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>ชื่อวันหยุด *</Label>
                    <Input
                      placeholder="เช่น วันสงกรานต์"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>วันที่ *</Label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>โรงงาน</Label>
                    <Select value={formPlantId} onValueChange={setFormPlantId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกโรงงาน</SelectItem>
                        {plants.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>รายละเอียด</Label>
                    <Input
                      placeholder="หมายเหตุเพิ่มเติม (ไม่จำเป็น)"
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">วันหยุดประจำปี</p>
                      <p className="text-xs text-muted-foreground">ซ้ำทุกปีในวันเดียวกัน</p>
                    </div>
                    <Switch checked={formRecurring} onCheckedChange={setFormRecurring} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>ยกเลิก</Button>
                  <Button
                    onClick={() => addMutation.mutate()}
                    disabled={!formName || !formDate || addMutation.isPending}
                  >
                    {addMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarOff className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">ยังไม่มีวันหยุดพิเศษ</p>
            <p className="text-xs text-muted-foreground mt-1">กด "เพิ่มวันหยุด" เพื่อกำหนดวันหยุดนักขัตฤกษ์</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ชื่อวันหยุด</TableHead>
                  <TableHead className="hidden sm:table-cell">โรงงาน</TableHead>
                  <TableHead className="hidden sm:table-cell">ประเภท</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map(h => {
                  const plantName = h.plant_id
                    ? plants.find(p => p.id === h.plant_id)?.name || '—'
                    : 'ทุกโรงงาน';
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        {format(new Date(h.holiday_date + 'T00:00:00'), 'd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span>{h.name}</span>
                          {h.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {plantName}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {h.is_recurring ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <RefreshCw className="h-3 w-3" />
                            ประจำปี
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">ครั้งเดียว</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(h.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
