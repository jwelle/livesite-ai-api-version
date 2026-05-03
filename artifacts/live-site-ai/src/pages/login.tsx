import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { Redirect } from "wouter";

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-card/80 backdrop-blur border border-border rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
            <Code2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your Live Site AI dashboard</p>
        </div>

        <Button 
          onClick={() => login()} 
          className="w-full h-12 text-base font-medium"
          data-testid="btn-login"
        >
          Log in
        </Button>
      </motion.div>
    </div>
  );
}
