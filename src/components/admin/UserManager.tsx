import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Loader2, Pencil, UserPlus, Shield, Mail, 
  Search, MoreHorizontal, UserCog, CheckCircle, XCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

interface UserWithEmail extends UserProfile {
  email?: string;
}

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: 'STAFF', label: 'Staff', description: 'พนักงานทั่วไป - สามารถบันทึกข้อมูลในหน้า Shopfloor' },
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'หัวหน้างาน - สามารถ approve และ lock shift ได้' },
  { value: 'EXECUTIVE', label: 'Executive', description: 'ผู้บริหาร - สามารถดูรายงานภาพรวมได้' },
  { value: 'ADMIN', label: 'Admin', description: 'ผู้ดูแลระบบ - สามารถจัดการทุกอย่างได้' },
];

const getRoleBadgeVariant = (role: AppRole): "default" | "secondary" | "destructive" | "outline" => {
  switch (role) {
    case 'ADMIN': return 'destructive';
    case 'EXECUTIVE': return 'default';
    case 'SUPERVISOR': return 'secondary';
    default: return 'outline';
  }
};

export function UserManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('STAFF');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('STAFF');

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Create user mutation (using edge function would be ideal, but for now we'll update profile)
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, fullName, role }: { 
      email: string; 
      password: string; 
      fullName: string; 
      role: AppRole 
    }) => {
      // First, sign up the user via Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // The trigger should create the profile, but we need to update the role
      // Wait a moment for the trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the role
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role, full_name: fullName })
        .eq('user_id', authData.user.id);

      if (updateError) throw updateError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      toast.success('สร้างผู้ใช้สำเร็จ - กรุณาให้ผู้ใช้ยืนยันอีเมล');
      handleCloseCreateDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('already registered')) {
        toast.error('อีเมลนี้ถูกใช้งานแล้ว');
      } else {
        toast.error(error.message);
      }
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, fullName, role }: { 
      userId: string; 
      fullName: string; 
      role: AppRole 
    }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName, role })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('อัปเดตผู้ใช้สำเร็จ');
      handleCloseEditDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete user mutation (deletes profile, cascade should handle permissions)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // First delete all permissions
      await supabase.from('user_plant_permissions').delete().eq('user_id', userId);
      await supabase.from('user_line_permissions').delete().eq('user_id', userId);
      await supabase.from('user_machine_permissions').delete().eq('user_id', userId);
      
      // Delete the profile
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('ลบผู้ใช้สำเร็จ');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Filter users by search
  const filteredUsers = users?.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count by role
  const roleCounts = users?.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleOpenCreateDialog = () => {
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('STAFF');
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('STAFF');
  };

  const handleOpenEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditFullName(user.full_name);
    setEditRole(user.role);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedUser(null);
    setEditFullName('');
    setEditRole('STAFF');
  };

  const handleOpenDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateUser = () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    createUserMutation.mutate({ 
      email: newEmail, 
      password: newPassword, 
      fullName: newFullName, 
      role: newRole 
    });
  };

  const handleUpdateUser = () => {
    if (!selectedUser || !editFullName) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    updateUserMutation.mutate({ 
      userId: selectedUser.user_id, 
      fullName: editFullName, 
      role: editRole 
    });
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.user_id);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ทั้งหมด</CardDescription>
            <CardTitle className="text-2xl">{users?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admin</CardDescription>
            <CardTitle className="text-2xl text-destructive">{roleCounts['ADMIN'] || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Supervisor</CardDescription>
            <CardTitle className="text-2xl">{roleCounts['SUPERVISOR'] || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Staff</CardDescription>
            <CardTitle className="text-2xl">{roleCounts['STAFF'] || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Header with Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาผู้ใช้..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <UserPlus className="h-4 w-4 mr-2" />
          เพิ่มผู้ใช้ใหม่
        </Button>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">สร้างเมื่อ</TableHead>
                <TableHead className="hidden md:table-cell">อัปเดตล่าสุด</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {user.user_id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {new Date(user.updated_at).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          แก้ไข
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleOpenDeleteDialog(user)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          ลบผู้ใช้
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {searchQuery ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้ในระบบ'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              เพิ่มผู้ใช้ใหม่
            </DialogTitle>
            <DialogDescription>
              สร้างบัญชีผู้ใช้ใหม่ในระบบ ผู้ใช้จะต้องยืนยันอีเมลก่อนเข้าใช้งาน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน *</Label>
              <Input
                id="password"
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">ชื่อ-นามสกุล *</Label>
              <Input
                id="fullName"
                placeholder="ชื่อ นามสกุล"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_OPTIONS.find(r => r.value === newRole)?.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCreateDialog}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateUser} 
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              สร้างผู้ใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              แก้ไขผู้ใช้
            </DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลและ role ของผู้ใช้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName">ชื่อ-นามสกุล *</Label>
              <Input
                id="editFullName"
                placeholder="ชื่อ นามสกุล"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_OPTIONS.find(r => r.value === editRole)?.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleUpdateUser} 
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบผู้ใช้
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบผู้ใช้ <span className="font-semibold">{selectedUser?.full_name}</span> ใช่หรือไม่?
              <br /><br />
              การดำเนินการนี้จะลบข้อมูลผู้ใช้และสิทธิ์การเข้าถึงทั้งหมดออกจากระบบ และไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ลบผู้ใช้
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
