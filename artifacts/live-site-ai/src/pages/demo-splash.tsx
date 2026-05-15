import {
  getGetPublicDemoQueryKey,
  useGetPublicDemo,
} from "@workspace/api-client-react";
import { ArrowRight, Check, MessageCircle, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const benefits = [
  "Answers visitors instantly",
  "Captures and qualifies leads",
  "Guides visitors to the next step",
];

export default function DemoSplashPage() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const [previewSourceIndex, setPreviewSourceIndex] = useState(0);
  const { data: demo, isLoading } = useGetPublicDemo(slug as string, {
    query: {
      enabled: !!slug,
      retry: false,
      queryKey: getGetPublicDemoQueryKey(slug as string),
    },
  });

  const previewImageUrl =
    typeof (demo as { previewImageUrl?: unknown } | undefined)?.previewImageUrl === "string" &&
    (demo as { previewImageUrl?: string }).previewImageUrl?.trim()
      ? (demo as { previewImageUrl?: string }).previewImageUrl!.trim()
      : null;

  const previewSources = useMemo(
    () => [
      ...(previewImageUrl ? [previewImageUrl] : []),
      `/demo-previews/${slug}.png`,
      "/demo-previews/default-placeholder.png",
    ],
    [previewImageUrl, slug],
  );

  useEffect(() => {
    setPreviewSourceIndex(0);
  }, [previewSources]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!demo || demo.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4 text-center text-slate-950">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="h-12 w-12 text-slate-400 mx-auto" />
          <h1 className="text-2xl font-bold">Demo Unavailable</h1>
          <p className="text-slate-600">
            This AI demo is currently inactive or does not exist.
          </p>
        </div>
      </div>
    );
  }

  const companyName = demo.companyName || "Your Business";
  const industry = demo.industry || "business";
  const previewSource = previewSources[previewSourceIndex] ?? null;

  const handleStartDemo = () => {
    setLocation(`/demo/${slug}/live`);
  };

  const handlePreviewImageError = () => {
    setPreviewSourceIndex((current) => current + 1);
  };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-normal text-slate-950">
            LiveSite AI
          </span>
        </div>
        <div className="min-w-0 text-right">
          <p className="hidden text-xs font-medium uppercase tracking-normal text-primary sm:block">
            Never miss another lead again.
          </p>
          <p className="truncate text-sm font-semibold text-slate-700">
            {companyName} | Personalized Demo
          </p>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-12 pt-8 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_0.82fr] lg:px-10 lg:pb-20">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-primary">
            {companyName} | Personalized Demo
          </div>

          <h1 className="max-w-xl text-5xl font-bold leading-[1.02] tracking-normal text-slate-950 sm:text-6xl">
            Meet Your AI Assistant
          </h1>

          <p className="mt-6 max-w-xl text-xl leading-8 text-slate-700">
            Chat with it. Call it. Test it with real customer questions.
          </p>

          <ul className="mt-8 grid gap-3 text-base text-slate-800">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-2xl text-base leading-7 text-slate-600">
            This is a personalized preview of your AI assistant. A full setup can
            be trained on your business, services, FAQs, offers, and booking
            process.
          </p>

          <Button
            size="lg"
            onClick={handleStartDemo}
            className="mt-9 h-12 rounded-lg px-7 text-base shadow-lg shadow-blue-600/20"
            data-testid="btn-tap-to-demo"
          >
            Tap to Demo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-auto w-full max-w-[390px] lg:max-w-[430px]">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-slate-900/20">
            <div className="overflow-hidden rounded-[1.5rem] bg-white">
              <div className="flex h-8 items-center justify-center border-b border-slate-100 bg-slate-50">
                <div className="h-1.5 w-20 rounded-full bg-slate-300" />
              </div>

              {previewSource ? (
                <div className="relative h-[560px] overflow-hidden bg-slate-50">
                  <img
                    src={previewSource}
                    alt={`${companyName} preview`}
                    className="h-full w-full object-cover"
                    onError={handlePreviewImageError}
                  />
                  <div className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-blue-600/30">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </div>
              ) : (
                <div className="relative min-h-[560px] bg-slate-50 p-5">
                  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-normal text-primary">
                      {industry}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-950">
                      {companyName}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Helpful answers, quick lead capture, and next-step guidance
                      for every visitor.
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="h-28 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-24 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
                      <div className="h-24 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
                    </div>
                    <div className="h-32 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
                  </div>

                  <div className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-blue-600/30">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            Tap to start your personalized demo.
          </p>
        </div>
      </section>
    </main>
  );
}
