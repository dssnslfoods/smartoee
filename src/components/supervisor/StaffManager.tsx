import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, User, Loader2, Settings, KeyRound, Pencil, ShieldCheck } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MachinePermissionManager } from './MachinePermissionManager';

interface StaffUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
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
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', newPassword: '', newEmail: '' });
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'STAFF' as 'STAFF' | 'SUPERVISOR',
  });

  // Fetch staff + supervisor users in the same company
  const { data: teamUsers = [], isLoading } = useQuery({
    queryKey: ['team-users', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .in('role', ['STAFF', 'SUPERVISOR'])
        .order('role')
        .order('full_name');
      
      if (error) throw error;
      return data as StaffUser[];
    },
    enabled: !!profile?.company_id,
  });

  // Create staff user mutation via edge function (doesn't affect current session)
  const createStaffMutation = useMutation({
    mutationFn: async ({ email, password, fullName, role }: { email: string; password: string; fullName: string; role: string }) => {
      if (!profile?.company_id) throw new Error('ไม่พบข้อมูลบริษัท');

      const response = await supabase.functions.invoke<{ success: boolean; message?: string; error?: string; user?: { id: string; email: string } }>('create-staff-user', {
        body: { email, password, fullName, role },
      });
      
      // Handle edge function errors - check data first as it may contain error info
      if (response.data && !response.data.success) {
        throw new Error(response.data.message || 'ไม่สามารถสร้างผู้ใช้ได้');
      }
      
      if (response.error) {
        // FunctionsHttpError contains error response body
        let errMessage = 'ไม่สามารถสร้างผู้ใช้ได้';
        try {
          // The error.context may contain the response body
          const context = response.error as unknown as { message?: string };
          if (context.message) {
            errMessage = context.message;
          }
        } catch {
          // Ignore parse error
        }
        throw new Error(errMessage);
      }
      
      if (!response.data) throw new Error('ไม่ได้รับข้อมูลตอบกลับจากเซิร์ฟเวอร์');

      return response.data.user;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'สร้างผู้ใช้เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      setIsAddDialogOpen(false);
      setNewUserForm({ email: '', password: '', fullName: '', role: 'STAFF' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Update staff user mutation
  const updateStaffMutation = useMutation({
    mutationFn: async ({ userId, fullName, newPassword, newEmail }: { userId: string; fullName: string; newPassword?: string; newEmail?: string }) => {
      // Update profile name
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName })
        .eq('user_id', userId);
      
      if (profileError) throw profileError;

      // Update password/email if provided
      if ((newPassword && newPassword.length >= 6) || newEmail) {
        const { data, error } = await supabase.functions.invoke('update-user-password', {
          body: { targetUserId: userId, newPassword: newPassword || undefined, newEmail: newEmail || undefined },
        });
        
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.message || 'ไม่สามารถอัปเดตบัญชีได้');
      }
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      setEditUser(null);
      setEditForm({ fullName: '', newPassword: '', newEmail: '' });
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
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
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
      role: newUserForm.role,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editUser || !editForm.fullName) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณากรอกชื่อ-นามสกุล', variant: 'destructive' });
      return;
    }

    if (editForm.newPassword && editForm.newPassword.length > 0 && editForm.newPassword.length < 6) {
      toast({ title: 'ข้อผิดพลาด', description: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', variant: 'destructive' });
      return;
    }

    if (editForm.newEmail && !editForm.newEmail.includes('@')) {
      toast({ title: 'ข้อผิดพลาด', description: 'รูปแบบอีเมลไม่ถูกต้อง', variant: 'destructive' });
      return;
    }

    updateStaffMutation.mutate({
      userId: editUser.user_id,
      fullName: editForm.fullName,
      newPassword: editForm.newPassword || undefined,
      newEmail: editForm.newEmail || undefined,
    });
  };

  const openEditDialog = (user: StaffUser) => {
    setEditUser(user);
    setEditForm({ fullName: user.full_name, newPassword: '', newEmail: '' });
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
            จัดการทีมงาน
          </CardTitle>
          <CardDescription>
            จัดการผู้ใช้ระดับ Staff และ Supervisor ใน {company.name}
          </CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มผู้ใช้
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teamUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            ยังไม่มีผู้ใช้ในระบบ
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[200px]">{user.email || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'SUPERVISOR' ? 'default' : 'secondary'} className="gap-1">
                      {user.role === 'SUPERVISOR' && <ShieldCheck className="h-3 w-3" />}
                      {user.role}
                    </Badge>
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
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>แก้ไขข้อมูล / รหัสผ่าน</TooltipContent>
                      </Tooltip>
                      {user.role === 'STAFF' && (
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
                      )}
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
            <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
            <DialogDescription>
              สร้างบัญชีผู้ใช้ใน {company.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">ตำแหน่ง</Label>
                <Select
                  value={newUserForm.role}
                  onValueChange={(v) => setNewUserForm(prev => ({ ...prev, role: v as 'STAFF' | 'SUPERVISOR' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              แก้ไขข้อมูลพนักงาน
            </DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลและรหัสผ่านของ {editUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">ชื่อ-นามสกุล</Label>
                <Input
                  id="editFullName"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPassword" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  รหัสผ่านใหม่ (ไม่บังคับ)
                </Label>
                <Input
                  id="editPassword"
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
                />
                <p className="text-xs text-muted-foreground">
                  หากต้องการเปลี่ยนรหัสผ่าน กรอกรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  อีเมลใหม่ (ไม่บังคับ)
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editForm.newEmail}
                  onChange={(e) => setEditForm(prev => ({ ...prev, newEmail: e.target.value }))}
                  placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
                />
                <p className="text-xs text-muted-foreground">
                  หากต้องการเปลี่ยนอีเมล กรอกอีเมลใหม่ที่ต้องการ
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateStaffMutation.isPending}>
                {updateStaffMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
