import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Plus, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [isInitialized, setIsInitialized] = useState(false);

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
      
      // Transform nested data
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

  // Fetch current permissions for this staff
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

  // Initialize selected machines when data loads
  if (!isInitialized && currentPermissions.length > 0 && !loadingPermissions) {
    setSelectedMachines(new Set(currentPermissions.map(p => p.machine_id)));
    setIsInitialized(true);
  }
  
  // Reset when dialog opens
  if (!isOpen && isInitialized) {
    setIsInitialized(false);
  }

  // Save permissions mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentMachineIds = new Set(currentPermissions.map(p => p.machine_id));
      const toAdd = [...selectedMachines].filter(id => !currentMachineIds.has(id));
      const toRemove = currentPermissions.filter(p => !selectedMachines.has(p.machine_id));

      // Remove permissions
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('user_machine_permissions')
          .delete()
          .in('id', toRemove.map(p => p.id));
        
        if (removeError) throw removeError;
      }

      // Add permissions
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('user_machine_permissions')
          .insert(toAdd.map(machine_id => ({
            user_id: staffUserId,
            machine_id,
          })));
        
        if (addError) throw addError;
      }
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'บันทึกสิทธิเครื่องจักรเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['staff-machine-permissions', staffUserId] });
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

  const selectAll = () => {
    setSelectedMachines(new Set(machines.map(m => m.id)));
  };

  const deselectAll = () => {
    setSelectedMachines(new Set());
  };

  const isLoading = loadingMachines || loadingPermissions;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            กำหนดสิทธิเครื่องจักร
          </DialogTitle>
          <DialogDescription>
            เลือกเครื่องจักรที่ <span className="font-medium">{staffName}</span> สามารถควบคุมได้
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            ไม่พบเครื่องจักรในบริษัท
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">
                เลือก {selectedMachines.size} / {machines.length} เครื่อง
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  เลือกทั้งหมด
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  ยกเลิกทั้งหมด
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-3">
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
