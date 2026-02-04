import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Factory, Loader2, Mail, Lock, User, Gauge } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast.error(error.message || 'Failed to sign in');
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message || 'Failed to create account');
        }
      } else {
        toast.success('Account created! Please check your email to verify.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-8 lg:p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 shadow-lg">
            <Gauge className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">PNF OEE System</h1>
            <p className="text-xs text-sidebar-foreground/50 font-medium">Manufacturing Excellence</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold text-sidebar-foreground leading-tight">
              Monitor. Analyze.<br />Optimize.
            </h2>
            <p className="text-lg text-sidebar-foreground/70 mt-4 max-w-md">
              Track Overall Equipment Effectiveness in real-time across all production lines.
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div className="rounded-xl bg-sidebar-accent/60 p-4 backdrop-blur-sm">
              <p className="text-2xl font-bold text-oee-availability">A</p>
              <p className="text-xs text-sidebar-foreground/50 font-medium mt-1">Availability</p>
            </div>
            <div className="rounded-xl bg-sidebar-accent/60 p-4 backdrop-blur-sm">
              <p className="text-2xl font-bold text-oee-performance">P</p>
              <p className="text-xs text-sidebar-foreground/50 font-medium mt-1">Performance</p>
            </div>
            <div className="rounded-xl bg-sidebar-accent/60 p-4 backdrop-blur-sm">
              <p className="text-2xl font-bold text-oee-quality">Q</p>
              <p className="text-xs text-sidebar-foreground/50 font-medium mt-1">Quality</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-sidebar-foreground/30 font-medium">
          © 2024 PNF Manufacturing. All rights reserved.
        </p>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2 bg-background">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 lg:hidden shadow-lg">
              <Factory className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to access the OEE dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1">
                <TabsTrigger 
                  value="login"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                placeholder="you@company.com" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-11 font-medium" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                placeholder="John Doe" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                placeholder="you@company.com" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="pl-10 h-11 bg-background" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-11 font-medium" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
