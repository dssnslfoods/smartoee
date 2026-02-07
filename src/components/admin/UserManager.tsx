import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Loader2, Pencil, UserPlus, Shield, Mail, 
  Search, MoreHorizontal, UserCog, Building2, KeyRound
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Company {
  id: string;
  name: string;
  code: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  companies?: Company | null;
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
  const { company } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Use the admin's selected company context
  const selectedCompanyId = company?.id;
  
  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('STAFF');
  const [newCompanyId, setNewCompanyId] = useState<string>('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('STAFF');
  const [editCompanyId, setEditCompanyId] = useState<string>('');
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Set default company_id when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      setNewCompanyId(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  // Fetch companies for dropdown
  const { data: companies } = useQuery({
    queryKey: ['admin-companies-dropdown'],
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

  // Fetch users filtered by company
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-all-users', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('user_profiles')
        .select('*, companies(id, name, code)')
        .order('created_at', { ascending: false });
      
      // Filter by selected company if available
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, fullName, role, companyId }: { 
      email: string; 
      password: string; 
      fullName: string; 
      role: AppRole;
      companyId: string | null;
    }) => {
      // Use edge function to create user without affecting current session
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { email, password, fullName, role, companyId },
      });
      
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message || 'ไม่สามารถสร้างผู้ใช้ได้');

      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      toast.success('สร้างผู้ใช้สำเร็จ');
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
    mutationFn: async ({ userId, fullName, role, companyId }: { 
      userId: string; 
      fullName: string; 
      role: AppRole;
      companyId: string | null;
    }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName, role, company_id: companyId })
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

  // Update account mutation (email/password)
  const updateAccountMutation = useMutation({
    mutationFn: async ({ userId, newPassword, newEmail }: { userId: string; newPassword?: string; newEmail?: string }) => {
      if (!newPassword && !newEmail) return;
      
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { targetUserId: userId, newPassword: newPassword || undefined, newEmail: newEmail || undefined },
      });
      
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message || 'ไม่สามารถอัปเดตบัญชีได้');
    },
    onSuccess: () => {
      toast.success('อัปเดตบัญชีสำเร็จ');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('user_plant_permissions').delete().eq('user_id', userId);
      await supabase.from('user_line_permissions').delete().eq('user_id', userId);
      await supabase.from('user_machine_permissions').delete().eq('user_id', userId);
      
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
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.companies?.name && user.companies.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
    setNewCompanyId(selectedCompanyId || '');
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('STAFF');
    setNewCompanyId('');
  };

  const handleOpenEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditFullName(user.full_name);
    setEditRole(user.role);
    setEditCompanyId(user.company_id || '');
    setEditPassword('');
    setEditEmail('');
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedUser(null);
    setEditFullName('');
    setEditRole('STAFF');
    setEditCompanyId('');
    setEditPassword('');
    setEditEmail('');
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
    if (!newCompanyId) {
      toast.error('กรุณาเลือกบริษัท');
      return;
    }
    createUserMutation.mutate({ 
      email: newEmail, 
      password: newPassword, 
      fullName: newFullName, 
      role: newRole,
      companyId: newCompanyId,
    });
  };

  const handleUpdateUser = () => {
    if (!selectedUser || !editFullName) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (editPassword && editPassword.length > 0 && editPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    updateUserMutation.mutate({ 
      userId: selectedUser.user_id, 
      fullName: editFullName, 
      role: editRole,
      companyId: editCompanyId || null,
    }, {
      onSuccess: () => {
        // If password or email was provided, update account
        if ((editPassword && editPassword.length >= 6) || editEmail) {
          updateAccountMutation.mutate({ 
            userId: selectedUser.user_id, 
            newPassword: editPassword || undefined,
            newEmail: editEmail || undefined,
          });
        }
      }
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
                <TableHead>อีเมล</TableHead>
                <TableHead>บริษัท</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">สร้างเมื่อ</TableHead>
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
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[200px]">{user.email || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.companies ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{user.companies.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
              <Label htmlFor="company">บริษัท *</Label>
              <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                <SelectTrigger className={!newCompanyId ? "border-destructive" : ""}>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.code && `(${company.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!newCompanyId && (
                <p className="text-xs text-destructive">กรุณาเลือกบริษัท</p>
              )}
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
                      {option.label}
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
              <Label htmlFor="editCompany">บริษัท</Label>
              <Select value={editCompanyId || "none"} onValueChange={(v) => setEditCompanyId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.code && `(${company.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_OPTIONS.find(r => r.value === editRole)?.description}
              </p>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="editPassword" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                รหัสผ่านใหม่ (ไม่บังคับ)
              </Label>
              <Input
                id="editPassword"
                type="password"
                placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
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
                placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                หากต้องการเปลี่ยนอีเมล กรอกอีเมลใหม่ที่ต้องการ
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleUpdateUser} 
              disabled={updateUserMutation.isPending || updateAccountMutation.isPending}
            >
              {(updateUserMutation.isPending || updateAccountMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
