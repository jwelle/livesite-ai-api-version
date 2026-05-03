import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Code2,
  Sparkles,
  Zap,
  Bot,
  ArrowRight,
  BarChart3,
  Presentation,
  Settings,
  Globe,
  Mic,
  Rocket,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";
import heroImg from "@assets/livesite_image_1777809410308.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Live Site AI</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-sm font-medium"
                data-testid="btn-nav-login"
              >
                Log in
              </Button>
            </Link>
            <Link href="/login">
              <Button
                className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--primary))]"
                data-testid="btn-nav-get-started"
              >
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-0">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16 md:pt-24 pb-20 md:pb-28">
          {/* Backdrop glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_85%_15%,_hsl(var(--primary)/0.25),_transparent_60%),radial-gradient(50%_50%_at_15%_85%,_hsl(var(--secondary)/0.18),_transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"
          />

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: copy */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center lg:text-left"
              >
                <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6">
                  <Sparkles className="mr-2 h-4 w-4" />
                  The Ultimate GoHighLevel Sales Tool
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
                  Turn Any Business Website Into a
                  <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-300 to-secondary">
                    Live AI Demo
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                  Close more agency clients by showing them a working AI voice
                  and chat assistant directly on their own website — in
                  minutes. Precise, credible, and immediately impressive.
                </p>

                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4">
                  <Link href="/login">
                    <Button
                      size="lg"
                      className="h-12 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_32px_-8px_hsl(var(--primary))] w-full sm:w-auto"
                      data-testid="btn-hero-cta"
                    >
                      Start Building Demos
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 px-8 text-base border-border hover:bg-muted w-full sm:w-auto"
                      data-testid="btn-hero-secondary"
                    >
                      View Example
                    </Button>
                  </Link>
                </div>

                {/* Trust strip */}
                <div className="mt-10 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <span className="ml-2 text-foreground/80 font-medium">
                      Trusted by GHL agencies
                    </span>
                  </div>
                  <div className="hidden sm:block h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    No coding required
                  </div>
                  <div className="hidden sm:block h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Demo ready in minutes
                  </div>
                </div>
              </motion.div>

              {/* Right: hero image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="relative"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  {/* Glow ring */}
                  <div
                    aria-hidden
                    className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-primary/30 via-cyan-400/20 to-secondary/30 blur-2xl"
                  />
                  <div className="relative rounded-2xl border border-primary/20 bg-card/40 backdrop-blur-sm p-2 shadow-2xl ring-1 ring-primary/10">
                    <img
                      src={heroImg}
                      alt="Live Site AI demo showing AI assistant overlaid on a business website"
                      className="w-full h-auto rounded-xl object-contain"
                      loading="eager"
                    />
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Capability strip */}
        <section className="border-y border-border/60 bg-card/30">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Analyze Any Website</div>
                  <div className="text-sm text-muted-foreground">
                    Paste a URL, get a tailored demo
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                  <Mic className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <div className="font-semibold">AI Chat + Voice</div>
                  <div className="text-sm text-muted-foreground">
                    Powered by GoHighLevel
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                  <Rocket className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <div className="font-semibold">Launch Better Demos</div>
                  <div className="text-sm text-muted-foreground">
                    Branded, trackable, shareable
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Create a compelling sales asset in three simple steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Enter Prospect Details",
                  desc: "Input the prospect's website URL, industry, and contact info into your dashboard.",
                  icon: <Presentation className="h-6 w-6 text-primary" />,
                },
                {
                  step: "02",
                  title: "Configure AI Personas",
                  desc: "Set up the GHL chat widget ID and Voice AI phone number for a tailored experience.",
                  icon: <Settings className="h-6 w-6 text-secondary" />,
                },
                {
                  step: "03",
                  title: "Share the Live Link",
                  desc: "Send the generated preview link. They see their own site overlaid with your AI tools.",
                  icon: <Zap className="h-6 w-6 text-yellow-500" />,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group relative p-6 rounded-2xl border border-border bg-card/60 hover:border-primary/50 hover:bg-card hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.4)]"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/20 group-hover:ring-primary/40 transition">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                  <div className="absolute top-6 right-6 text-4xl font-black text-muted-foreground/15">
                    {item.step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section className="py-20 md:py-24 bg-card/30 border-y border-border/60">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Outcomes Agencies Actually Care About
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A demo that does the selling for you.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: <TrendingUp className="h-6 w-6 text-primary" />,
                  title: "Close more retainers",
                  desc: "Walk into discovery calls with a working demo on the prospect's own site, not slides.",
                },
                {
                  icon: <Clock className="h-6 w-6 text-secondary" />,
                  title: "Shorter sales cycles",
                  desc: "Replace weeks of back-and-forth with one share link prospects can play with today.",
                },
                {
                  icon: <ShieldCheck className="h-6 w-6 text-yellow-400" />,
                  title: "No coding required",
                  desc: "Paste a URL, plug in your GHL widget and Voice AI, send the link. That's it.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl border border-border bg-background/60 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 ring-1 ring-primary/20">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Closers</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Everything you need to demonstrate value and track engagement.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="p-6 rounded-xl border border-border bg-card/50 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300">
                <BarChart3 className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Engagement Tracking</h3>
                <p className="text-muted-foreground text-sm">
                  Know exactly when prospects view the demo, click to call the
                  Voice AI, or book a setup calendar appointment.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50 hover:border-secondary/40 hover:-translate-y-1 transition-all duration-300">
                <Bot className="h-8 w-8 text-secondary mb-4" />
                <h3 className="text-lg font-semibold mb-2">GHL Native</h3>
                <p className="text-muted-foreground text-sm">
                  Designed specifically to showcase GoHighLevel's
                  conversational AI and Voice AI capabilities.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50 hover:border-yellow-500/40 hover:-translate-y-1 transition-all duration-300">
                <Zap className="h-8 w-8 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Instant Previews</h3>
                <p className="text-muted-foreground text-sm">
                  No coding required. Just paste a URL and generate a
                  shareable, branded demo link instantly.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card/50 hover:border-blue-400/40 hover:-translate-y-1 transition-all duration-300">
                <Code2 className="h-8 w-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Fallback Safe</h3>
                <p className="text-muted-foreground text-sm">
                  If a website blocks iframe embedding, the system
                  automatically falls back to a clean presentation mode.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA band */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-secondary/15 p-8 md:p-16 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/25 blur-3xl"
              />
              <div className="relative">
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                  Ready to close your next agency client?
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-base md:text-lg">
                  Spin up a personalized AI demo on their site in minutes.
                  Watch them say yes.
                </p>
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-12 px-10 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_32px_-8px_hsl(var(--primary))]"
                    data-testid="btn-final-cta"
                  >
                    Start Building Demos
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile sticky CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
        <Link href="/login">
          <Button
            className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            data-testid="btn-mobile-sticky-cta"
          >
            Start Building Demos
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>

      <footer className="border-t border-border py-12 bg-card/30">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Live Site AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Live Site AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
