import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, Building2, ArrowLeft, Shield, Activity, Gauge } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { CompanySelector } from "@/components/auth/CompanySelector";
import { motion } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

/* ── Shared Branding Panel (left side on desktop) ── */
function IndustrialBrandingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden lg:flex w-1/2 relative overflow-hidden">
      {/* Dark industrial background */}
      <div className="absolute inset-0 bg-sidebar" />
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--sidebar-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sidebar-foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Accent top bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-primary" />

      <div className="relative z-10 flex flex-col justify-between p-12 w-full">
        {children}
      </div>
    </div>
  );
}

/* ── Login Branding Content ── */
function LoginBranding() {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <img src="/favicon.png" alt="PNF OEE Logo" className="h-7 w-7 object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">PNF OEE System</h1>
          <p className="text-xs text-sidebar-foreground/50 font-medium tracking-wider uppercase">Manufacturing Excellence</p>
        </div>
      </div>

      {/* Hero content */}
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary tracking-wider uppercase">Production Intelligence</p>
          <h2 className="text-4xl font-bold text-sidebar-foreground leading-tight">
            Monitor. Analyze.
            <br />
            Optimize.
          </h2>
          <p className="text-base text-sidebar-foreground/60 leading-relaxed max-w-md">
            Real-time Overall Equipment Effectiveness tracking across all production lines. Built for the factory floor.
          </p>
        </div>

        {/* OEE Metric indicators */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Availability", letter: "A", color: "text-oee-availability", borderColor: "border-oee-availability/30", bgColor: "bg-oee-availability/10" },
            { label: "Performance", letter: "P", color: "text-oee-performance", borderColor: "border-oee-performance/30", bgColor: "bg-oee-performance/10" },
            { label: "Quality", letter: "Q", color: "text-oee-quality", borderColor: "border-oee-quality/30", bgColor: "bg-oee-quality/10" },
          ].map((m) => (
            <div
              key={m.letter}
              className={`rounded-lg border ${m.borderColor} ${m.bgColor} p-4 text-center`}
            >
              <p className={`text-3xl font-bold ${m.color}`}>{m.letter}</p>
              <p className="text-[11px] text-sidebar-foreground/50 font-medium mt-1 tracking-wide uppercase">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Activity, text: "Real-time Monitoring" },
            { icon: Gauge, text: "OEE Analytics" },
            { icon: Shield, text: "Secure Access" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-1.5">
              <f.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-sidebar-foreground/70 font-medium">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-sidebar-foreground/30">
        © 2026 PNF OEE System. Designed and Developed by Arnon Arpaket. All rights reserved.
      </p>
    </>
  );
}

/* ── Admin Company Selection Branding ── */
function AdminBranding() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <img src="/favicon.png" alt="PNF OEE Logo" className="h-7 w-7 object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">PNF OEE System</h1>
          <p className="text-xs text-sidebar-foreground/50 font-medium tracking-wider uppercase">Manufacturing Excellence</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary tracking-wider uppercase">Administrator</p>
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            Multi-Company
            <br />
            Access
          </h2>
          <p className="text-base text-sidebar-foreground/60 leading-relaxed max-w-md">
            As an administrator, you can manage multiple companies. Please select which company you'd like to work with.
          </p>
        </div>
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sidebar-foreground text-sm">Multi-Company Access</p>
              <p className="text-xs text-sidebar-foreground/50">
                Switch between companies anytime from the sidebar
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-sidebar-foreground/30">
        © 2026 PNF OEE System. Designed and Developed by Arnon Arpaket. All rights reserved.
      </p>
    </>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signOut, needsCompanySelection, selectCompanyForAdmin, isAdmin, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelectingCompany, setIsSelectingCompany] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is logged in and is an admin that needs to select a company
  if (user && isAdmin() && needsCompanySelection) {
    return (
      <div className="flex min-h-screen bg-background">
        <IndustrialBrandingPanel>
          <AdminBranding />
        </IndustrialBrandingPanel>

        {/* Right side - Company Selection */}
        <div className="flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <Card className="border-border/60 shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 lg:hidden">
                  <img src="/favicon.png" alt="PNF OEE Logo" className="h-9 w-9 object-contain" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">Select Company</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Welcome, {profile?.full_name || 'Administrator'}! Choose a company to manage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompanySelector
                  onSelectCompany={(company) => {
                    setIsSelectingCompany(true);
                    setTimeout(() => {
                      selectCompanyForAdmin(company);
                      toast.success(`Working as ${company.name}`);
                      navigate("/dashboard");
                    }, 300);
                  }}
                  isLoading={isSelectingCompany}
                />
                
                <div className="mt-6 border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => signOut()}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Sign out and use different account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // User is logged in and doesn't need company selection
  if (user && !needsCompanySelection) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast.error(error.message || "Failed to sign in");
      } else {
        toast.success("Welcome back!");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side - Industrial Branding */}
      <IndustrialBrandingPanel>
        <LoginBranding />
      </IndustrialBrandingPanel>

      {/* Right side - Login form */}
      <div className="flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2">
        {/* Subtle background pattern for right side */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="border-border/60 shadow-lg">
            {/* Card top accent line */}
            <div className="h-1 rounded-t-[var(--radius)] bg-primary" />

            <CardHeader className="text-center pt-8 pb-2">
              {/* Mobile logo */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 lg:hidden">
                <img src="/favicon.png" alt="PNF OEE Logo" className="h-9 w-9 object-contain" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">ยินดีต้อนรับ</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sign in to access the OEE dashboard
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 pb-8 px-6 sm:px-8">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="you@company.com"
                              className="pl-10 h-11 border-input bg-background transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="••••••••"
                              className="pl-10 h-11 border-input bg-background transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-sm tracking-wide transition-all duration-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </Form>

              {/* Security note */}
              <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground/60">
                <Shield className="h-3.5 w-3.5" />
                <span className="text-xs">Secure, encrypted connection</span>
              </div>
            </CardContent>
          </Card>

          {/* Mobile footer */}
          <p className="mt-6 text-center text-xs text-muted-foreground/40 lg:hidden">
            © 2026 PNF OEE System
          </p>
        </motion.div>
      </div>
    </div>
  );
}
