import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Code2, Sparkles, Zap, Bot, ArrowRight, BarChart3, Presentation, Settings } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Live Site AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-medium" data-testid="btn-nav-login">Log in</Button>
            </Link>
            <Link href="/login">
              <Button className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="btn-nav-get-started">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6">
                <Sparkles className="mr-2 h-4 w-4" />
                The Ultimate GoHighLevel Sales Tool
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
                Turn Any Business Website Into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Live AI Demo</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Close more agency clients by showing them a working AI voice and chat assistant directly on their own website in minutes. Precise, credible, and immediately impressive.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="h-12 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" data-testid="btn-hero-cta">
                    Start Building Demos <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base border-border hover:bg-muted" data-testid="btn-hero-secondary">
                    View Example
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Mockup */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-16 mx-auto max-w-5xl rounded-xl border border-border/50 bg-card/50 shadow-2xl p-2 backdrop-blur-sm"
            >
              <div className="rounded-lg overflow-hidden border border-border bg-background aspect-[16/9] relative">
                <div className="absolute top-0 w-full h-10 bg-muted/50 border-b border-border flex items-center px-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="mx-auto bg-background/50 rounded text-xs text-muted-foreground px-24 py-1">prospect-website.com</div>
                </div>
                <div className="mt-10 w-full h-full bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                
                {/* Floating Widget Mockup */}
                <div className="absolute bottom-6 right-6 w-72 bg-card rounded-xl shadow-xl border border-border overflow-hidden">
                  <div className="bg-primary p-3 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                    <span className="font-semibold text-primary-foreground text-sm">AI Assistant Demo</span>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">Try the live AI assistant tailored for this business.</p>
                    <Button size="sm" className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-sm">
                      Call AI Voice Demo
                    </Button>
                    <Button size="sm" variant="outline" className="w-full border-border">
                      Book Setup Call
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-24 bg-card/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Create a compelling sales asset in three simple steps.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Enter Prospect Details",
                  desc: "Input the prospect's website URL, industry, and contact info into your dashboard.",
                  icon: <Presentation className="h-6 w-6 text-primary" />
                },
                {
                  step: "02",
                  title: "Configure AI Personas",
                  desc: "Set up the GHL chat widget ID and Voice AI phone number for a tailored experience.",
                  icon: <Settings className="h-6 w-6 text-secondary" />
                },
                {
                  step: "03",
                  title: "Share the Live Link",
                  desc: "Send the generated preview link. They see their own site overlaid with your AI tools.",
                  icon: <Zap className="h-6 w-6 text-yellow-500" />
                }
              ].map((item, i) => (
                <div key={i} className="relative p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                  <div className="absolute top-6 right-6 text-4xl font-black text-muted/20">
                    {item.step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Built for Closers</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to demonstrate value and track engagement.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="p-6 rounded-xl border border-border bg-card/50">
                <BarChart3 className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Engagement Tracking</h3>
                <p className="text-muted-foreground text-sm">Know exactly when prospects view the demo, click to call the Voice AI, or book a setup calendar appointment.</p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50">
                <Bot className="h-8 w-8 text-secondary mb-4" />
                <h3 className="text-lg font-semibold mb-2">GHL Native</h3>
                <p className="text-muted-foreground text-sm">Designed specifically to showcase GoHighLevel's conversational AI and Voice AI capabilities.</p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50">
                <Zap className="h-8 w-8 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Instant Previews</h3>
                <p className="text-muted-foreground text-sm">No coding required. Just paste a URL and generate a shareable, branded demo link instantly.</p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50">
                <Code2 className="h-8 w-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Fallback Safe</h3>
                <p className="text-muted-foreground text-sm">If a website blocks iframe embedding, the system automatically falls back to a clean presentation mode.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-card/30">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Live Site AI</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Live Site AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
