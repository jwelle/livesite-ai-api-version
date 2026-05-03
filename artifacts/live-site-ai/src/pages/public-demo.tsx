import { useGetPublicDemo, useTrackDemoView, useTrackDemoCallClick, useTrackDemoCalendarClick, useTrackDemoWebsiteOpenClick, getGetPublicDemoQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Phone, Calendar, ExternalLink, ShieldAlert, Globe } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";

export default function PublicDemo() {
  const { slug } = useParams();
  const { data: demo, isLoading } = useGetPublicDemo(slug as string, {
    query: {
      enabled: !!slug,
      retry: false,
      queryKey: getGetPublicDemoQueryKey(slug as string),
    }
  });

  const trackView = useTrackDemoView();
  const trackCall = useTrackDemoCallClick();
  const trackCalendar = useTrackDemoCalendarClick();
  const trackOpen = useTrackDemoWebsiteOpenClick();

  const [iframeFailed, setIframeFailed] = useState(false);
  const trackedView = useRef(false);

  // Track view once
  useEffect(() => {
    if (demo && !trackedView.current) {
      trackedView.current = true;
      trackView.mutate({ slug: slug as string });
    }
  }, [demo, slug, trackView]);

  useEffect(() => {
    if (!demo?.resolvedChatWidgetId) return;
    const existingScript = document.querySelector('script[src="https://beta.leadconnectorhq.com/loader.js"]');
    if (existingScript) return;
    const script = document.createElement("script");
    script.src = "https://beta.leadconnectorhq.com/loader.js";
    script.setAttribute("data-resources-url", "https://beta.leadconnectorhq.com/chat-widget/loader.js");
    script.setAttribute("data-widget-id", demo.resolvedChatWidgetId);
    script.async = true;
    document.body.appendChild(script);
  }, [demo?.resolvedChatWidgetId]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner className="h-8 w-8 text-primary" /></div>;
  }

  if (!demo || demo.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Demo Unavailable</h1>
          <p className="text-muted-foreground">This AI demo is currently inactive or does not exist.</p>
        </div>
      </div>
    );
  }

  const handleCallClick = () => {
    trackCall.mutate({ slug: slug as string });
    if (demo.voiceAiPhoneNumber) {
      window.location.href = `tel:${demo.voiceAiPhoneNumber}`;
    }
  };

  const handleCalendarClick = () => {
    trackCalendar.mutate({ slug: slug as string });
    if (demo.ctaCalendarLink) {
      window.open(demo.ctaCalendarLink, "_blank");
    }
  };

  const handleOpenWebsite = () => {
    trackOpen.mutate({ slug: slug as string });
    window.open(demo.websiteUrl, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-primary truncate max-w-[150px] sm:max-w-xs">{demo.companyName}</span>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">Live AI Demo Preview</span>
        </div>
        <div className="flex items-center gap-2">
          {demo.voiceAiPhoneNumber && (
            <Button variant="outline" size="sm" onClick={handleCallClick} className="hidden sm:flex" data-testid="btn-top-call">
              <Phone className="mr-2 h-4 w-4" /> Call AI Voice Demo
            </Button>
          )}
          {demo.ctaCalendarLink && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleCalendarClick} data-testid="btn-top-book">
              <Calendar className="mr-2 h-4 w-4" /> Book Setup Call
            </Button>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative bg-muted/20">
        {!iframeFailed ? (
          <iframe 
            src={demo.websiteUrl} 
            className="w-full h-full border-none"
            onError={() => setIframeFailed(true)}
            // Sandbox needs allow-scripts allow-same-origin at least for many sites
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`${demo.companyName} Website`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-card border border-border rounded-xl shadow-xl p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Preview Restricted</h2>
                <p className="text-muted-foreground">Some websites block live previews via X-Frame-Options, but your AI demo is still active and ready to test.</p>
              </div>
              <Button onClick={handleOpenWebsite} variant="outline" className="w-full" data-testid="btn-fallback-open">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Website in New Tab
              </Button>
            </div>
          </div>
        )}

        {/* Floating Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="absolute bottom-6 right-6 sm:bottom-24 sm:right-8 w-80 bg-card rounded-xl shadow-2xl border border-border/50 overflow-hidden z-[40]"
        >
          <div className="bg-primary/10 border-b border-primary/10 p-4 flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-primary">{demo.chatPersonaName || "AI Assistant"} Demo</div>
              <div className="text-xs text-muted-foreground">Live integration active</div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {demo.customDemoMessage || `Experience how an AI assistant can transform customer engagement for ${demo.companyName}.`}
            </p>
            <div className="space-y-2 pt-2">
              {demo.voiceAiPhoneNumber && (
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-white" onClick={handleCallClick} data-testid="btn-float-call">
                  <Phone className="mr-2 h-4 w-4" /> Test Voice AI
                </Button>
              )}
              {demo.ctaCalendarLink && (
                <Button variant="outline" className="w-full border-border/50" onClick={handleCalendarClick} data-testid="btn-float-book">
                  <Calendar className="mr-2 h-4 w-4" /> Discuss Implementation
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
