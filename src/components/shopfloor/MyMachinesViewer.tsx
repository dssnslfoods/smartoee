import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Monitor, Users, Wrench } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Machine {
  id: string;
  name: string;
  code: string;
  line_name: string;
  plant_name: string;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  machines: Machine[];
}

interface DirectPermission {
  machine: Machine;
}

export function MyMachinesViewer() {
  const { user } = useAuth();
  const [directPermissions, setDirectPermissions] = useState<DirectPermission[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    }
  }, [user]);

  const fetchPermissions = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch direct machine permissions
      const { data: directData, error: directError } = await supabase
        .from('user_machine_permissions')
        .select(`
          machine_id,
          machines!inner (
            id,
            name,
            code,
            lines!inner (
              name,
              plants!inner (
                name
              )
            )
          )
        `)
        .eq('user_id', user.id);

      if (directError) throw directError;

      const directMachines: DirectPermission[] = (directData || []).map((item: any) => ({
        machine: {
          id: item.machines.id,
          name: item.machines.name,
          code: item.machines.code,
          line_name: item.machines.lines.name,
          plant_name: item.machines.lines.plants.name,
        },
      }));
      setDirectPermissions(directMachines);

      // Fetch group-based permissions
      const { data: groupData, error: groupError } = await supabase
        .from('user_permission_groups')
        .select(`
          group_id,
          machine_permission_groups!inner (
            id,
            name,
            description,
            machine_permission_group_machines (
              machine_id,
              machines!inner (
                id,
                name,
                code,
                lines!inner (
                  name,
                  plants!inner (
                    name
                  )
                )
              )
            )
          )
        `)
        .eq('user_id', user.id);

      if (groupError) throw groupError;

      const groups: PermissionGroup[] = (groupData || []).map((item: any) => ({
        id: item.machine_permission_groups.id,
        name: item.machine_permission_groups.name,
        description: item.machine_permission_groups.description,
        machines: (item.machine_permission_groups.machine_permission_group_machines || []).map((gm: any) => ({
          id: gm.machines.id,
          name: gm.machines.name,
          code: gm.machines.code,
          line_name: gm.machines.lines.name,
          plant_name: gm.machines.lines.plants.name,
        })),
      }));
      setPermissionGroups(groups);

    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all unique machines (combining direct and group-based)
  const getAllMachines = (): Machine[] => {
    const machineMap = new Map<string, Machine>();
    
    directPermissions.forEach((dp) => {
      machineMap.set(dp.machine.id, dp.machine);
    });
    
    permissionGroups.forEach((group) => {
      group.machines.forEach((machine) => {
        machineMap.set(machine.id, machine);
      });
    });
    
    return Array.from(machineMap.values());
  };

  const allMachines = getAllMachines();
  const totalGroups = permissionGroups.length;
  const totalDirect = directPermissions.length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">กำลังโหลดข้อมูล...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">เครื่องจักรทั้งหมด</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allMachines.length}</div>
            <p className="text-xs text-muted-foreground">เครื่องที่มีสิทธิ์เข้าถึง</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">กลุ่มสิทธิ์</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGroups}</div>
            <p className="text-xs text-muted-foreground">กลุ่มที่ได้รับมอบหมาย</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">สิทธิ์โดยตรง</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDirect}</div>
            <p className="text-xs text-muted-foreground">เครื่องที่ได้รับสิทธิ์โดยตรง</p>
          </CardContent>
        </Card>
      </div>

      {/* All Machines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            เครื่องจักรทั้งหมดที่มีสิทธิ์เข้าถึง
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allMachines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ยังไม่มีเครื่องจักรที่ได้รับสิทธิ์เข้าถึง
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อเครื่องจักร</TableHead>
                  <TableHead>ไลน์</TableHead>
                  <TableHead>โรงงาน</TableHead>
                  <TableHead>ประเภทสิทธิ์</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMachines.map((machine) => {
                  const isDirect = directPermissions.some((dp) => dp.machine.id === machine.id);
                  const fromGroups = permissionGroups
                    .filter((g) => g.machines.some((m) => m.id === machine.id))
                    .map((g) => g.name);

                  return (
                    <TableRow key={machine.id}>
                      <TableCell className="font-mono">{machine.code}</TableCell>
                      <TableCell className="font-medium">{machine.name}</TableCell>
                      <TableCell>{machine.line_name}</TableCell>
                      <TableCell>{machine.plant_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isDirect && (
                            <Badge variant="default">โดยตรง</Badge>
                          )}
                          {fromGroups.map((groupName) => (
                            <Badge key={groupName} variant="secondary">
                              {groupName}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permission Groups Detail */}
      {permissionGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              รายละเอียดกลุ่มสิทธิ์
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {permissionGroups.map((group) => (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{group.name}</span>
                      <Badge variant="outline">{group.machines.length} เครื่อง</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-4">{group.description}</p>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>รหัส</TableHead>
                          <TableHead>ชื่อเครื่องจักร</TableHead>
                          <TableHead>ไลน์</TableHead>
                          <TableHead>โรงงาน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.machines.map((machine) => (
                          <TableRow key={machine.id}>
                            <TableCell className="font-mono">{machine.code}</TableCell>
                            <TableCell className="font-medium">{machine.name}</TableCell>
                            <TableCell>{machine.line_name}</TableCell>
                            <TableCell>{machine.plant_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Direct Permissions */}
      {directPermissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              เครื่องจักรที่ได้รับสิทธิ์โดยตรง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อเครื่องจักร</TableHead>
                  <TableHead>ไลน์</TableHead>
                  <TableHead>โรงงาน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directPermissions.map((dp) => (
                  <TableRow key={dp.machine.id}>
                    <TableCell className="font-mono">{dp.machine.code}</TableCell>
                    <TableCell className="font-medium">{dp.machine.name}</TableCell>
                    <TableCell>{dp.machine.line_name}</TableCell>
                    <TableCell>{dp.machine.plant_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
