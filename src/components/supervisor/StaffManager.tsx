import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, User, Loader2, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MachinePermissionManager } from './MachinePermissionManager';

interface StaffUser {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  company_id: string;
  created_at: string;
}

export function StaffManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, company } = useAuth();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [permissionUser, setPermissionUser] = useState<{ userId: string; name: string } | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  // Fetch staff users in the same company
  const { data: staffUsers = [], isLoading } = useQuery({
    queryKey: ['staff-users', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('role', 'STAFF')
        .order('full_name');
      
      if (error) throw error;
      return data as StaffUser[];
    },
    enabled: !!profile?.company_id,
  });

  // Create staff user mutation
  const createStaffMutation = useMutation({
    mutationFn: async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
      if (!profile?.company_id) throw new Error('ไม่พบข้อมูลบริษัท');

      // Sign up the user with metadata
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'STAFF',
            company_id: profile.company_id,
          },
        },
      });
      
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('ไม่สามารถสร้างผู้ใช้ได้');

      return authData.user;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'สร้างผู้ใช้ Staff เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      setIsAddDialogOpen(false);
      setNewUserForm({ email: '', password: '', fullName: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Delete staff user mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ลบผู้ใช้เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserForm.email || !newUserForm.password || !newUserForm.fullName) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }

    if (newUserForm.password.length < 6) {
      toast({ title: 'ข้อผิดพลาด', description: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', variant: 'destructive' });
      return;
    }

    createStaffMutation.mutate({
      email: newUserForm.email,
      password: newUserForm.password,
      fullName: newUserForm.fullName,
    });
  };

  if (!company) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">ไม่พบข้อมูลบริษัท</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            จัดการพนักงาน (Staff)
          </CardTitle>
          <CardDescription>
            จัดการผู้ใช้ระดับ Staff ใน {company.name}
          </CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มพนักงาน
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : staffUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            ยังไม่มีพนักงานในระบบ
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">STAFF</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPermissionUser({ userId: user.user_id, name: user.full_name })}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>กำหนดสิทธิเครื่องจักร</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ลบผู้ใช้</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
            <DialogDescription>
              สร้างบัญชีผู้ใช้ระดับ Staff ใน {company.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
                <Input
                  id="fullName"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="example@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={createStaffMutation.isPending}>
                {createStaffMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้? การดำเนินการนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteStaffMutation.mutate(deleteUserId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteStaffMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'ลบ'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Machine Permission Manager */}
      {permissionUser && (
        <MachinePermissionManager
          staffUserId={permissionUser.userId}
          staffName={permissionUser.name}
          isOpen={!!permissionUser}
          onClose={() => setPermissionUser(null)}
        />
      )}
    </Card>
  );
}
