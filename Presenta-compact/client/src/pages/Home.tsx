/* Editorial Control Room: Swiss editorial layout, warm paper surfaces, ink-black hierarchy, burnt-coral action signal. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Download, FileText, Loader2, LogIn, Menu, MoreHorizontal, Plus, Save, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const themes = [
  { name: "Corporate Blue", tone: "calm / credible", swatches: ["#20364D", "#5D93B8", "#EEF4F6"] },
  { name: "Vibrant Purple", tone: "bold / expressive", swatches: ["#35254D", "#B76AD4", "#F7EFFE"] },
  { name: "Forest Green", tone: "grounded / clear", swatches: ["#233C32", "#6F997E", "#EEF5EF"] },
  { name: "Minimal Dark", tone: "focused / sharp", swatches: ["#171717", "#E85D4A", "#2C2C2C"] },
];

const sampleSlides = [
  { title: "The healthcare system is ready for a more intelligent layer", bullets: ["AI is moving from isolated pilots to embedded clinical workflows", "The opportunity is not replacement — it is better timing, context, and care", "Three forces are creating a window for meaningful change"] },
  { title: "The bottleneck is not data. It is the distance to a decision.", bullets: ["Clinicians already navigate high-volume, high-variance information", "Signal gets buried when context arrives too late", "The most valuable systems make the next step easier to see"] },
  { title: "A practical model: intelligence around the moment of care", bullets: ["Predict risk before it becomes a crisis", "Surface the right evidence inside existing workflows", "Build feedback loops that improve with every interaction"] },
  { title: "The standard for success is trust, not novelty", bullets: ["Explain the recommendation in language people can challenge", "Design for handoffs between humans, teams, and systems", "Measure outcomes patients can actually feel"] },
  { title: "The next chapter is already being written", bullets: ["Start with one high-value workflow and a clear owner", "Earn trust through small, visible wins", "Scale the operating model — not just the model"] },
];

const progressSteps = ["Generating structure...", "Creating slides...", "Building PPTX..."];

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.

  const [topic, setTopic] = useState("Artificial Intelligence in Healthcare");
  const [numSlides, setNumSlides] = useState(5);
  const [theme, setTheme] = useState("Corporate Blue");
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [slides, setSlides] = useState(sampleSlides);
  const [mobileNav, setMobileNav] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBullets, setDraftBullets] = useState("");
  const generatePreview = trpc.presentation.generatePreview.useMutation();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [customization, setCustomization] = useState({ accent: "#E85D4A", font: "editorial" as "editorial" | "modern" | "classic", density: "airy" as "airy" | "compact", footer: "Presenta Studio" });
  const [currentPresentationId, setCurrentPresentationId] = useState<number | null>(null);
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const savedPresentations = trpc.presentation.listSaved.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const savePresentation = trpc.presentation.save.useMutation({ onSuccess: () => savedPresentations.refetch() });
  const removeSavedPresentation = trpc.presentation.removeSaved.useMutation({ onSuccess: () => savedPresentations.refetch() });
  const previewRef = useRef<HTMLElement>(null);

  const selectedTheme = useMemo(() => themes.find((item) => item.name === theme) ?? themes[0], [theme]);
  const visibleSlides = showAll ? slides : slides.slice(0, 3);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("deckcraft-draft-v1");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as { topic?: string; theme?: string; customization?: typeof customization; slides?: Array<{ title: string; bullets: string[] }> };
        if (parsed.topic !== undefined) setTopic(parsed.topic);
        if (parsed.theme && themes.some((item) => item.name === parsed.theme)) setTheme(parsed.theme);
        if (parsed.customization?.accent && parsed.customization?.font && parsed.customization?.density) setCustomization({ accent: parsed.customization.accent, font: parsed.customization.font, density: parsed.customization.density, footer: parsed.customization.footer === "Deckcraft Studio" ? "Presenta Studio" : parsed.customization.footer || "Presenta Studio" });
        if (parsed.slides?.length && parsed.slides.every((slide) => slide.title && slide.bullets?.length >= 2)) setSlides(parsed.slides);
      }
    } catch {
      localStorage.removeItem("deckcraft-draft-v1");
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      localStorage.setItem("deckcraft-draft-v1", JSON.stringify({ topic, theme, customization, slides }));
    } catch {
      // Local persistence is best-effort when browser storage is unavailable.
    }
  }, [draftHydrated, topic, theme, customization, slides]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = window.setInterval(() => setStep((current) => Math.min(current + 1, 2)), 700);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  const generatePresentation = () => {
    if (!topic.trim()) {
      toast.error("Add a topic before generating your deck.");
      return;
    }
    setIsGenerating(true);
    setStep(0);
    generatePreview.mutate({ topic, num_slides: numSlides, theme: theme as "Corporate Blue" | "Vibrant Purple" | "Forest Green" | "Minimal Dark" }, {
      onSuccess: (result) => {
        setSlides(result.slides.map((slide) => ({ title: slide.title, bullets: slide.bullet_points })));
        setCurrentPresentationId(null);
        setSelectedSlide(0);
        setIsGenerating(false);
        setShowAll(false);
        toast.success("Your presentation is ready to review.");
        window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      },
      onError: (error) => {
        setIsGenerating(false);
        toast.error(error.message || "Could not generate the outline.");
      },
    });
  };

  const beginEdit = (index: number) => {
    const slide = slides[index];
    if (!slide) return;
    setEditingSlide(index);
    setDraftTitle(slide.title);
    setDraftBullets(slide.bullets.join("\\n"));
  };

  const saveEdit = () => {
    if (editingSlide === null || !draftTitle.trim()) return;
    const bullets = draftBullets.split("\\n").map((bullet) => bullet.trim()).filter(Boolean).slice(0, 6);
    if (bullets.length < 2) {
      toast.error("Add at least two bullet points.");
      return;
    }
    setSlides((current) => current.map((slide, index) => index === editingSlide ? { title: draftTitle.trim(), bullets } : slide));
    setEditingSlide(null);
    toast.success("Slide updated.");
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 3) {
      toast.error("A presentation needs at least three slides.");
      return;
    }
    setSlides((current) => current.filter((_, slideIndex) => slideIndex !== index));
    setSelectedSlide((current) => index < current ? current : Math.max(0, current - 1));
    if (editingSlide === index) setEditingSlide(null);
    toast.success("Slide removed from the outline.");
  };

  const startNewDraft = () => {
    setTopic("");
    setTheme("Corporate Blue");
    setCustomization({ accent: "#E85D4A", font: "editorial", density: "airy", footer: "Presenta Studio" });
    setSlides(sampleSlides);
    setCurrentPresentationId(null);
    setSelectedSlide(0);
    setEditingSlide(null);
    setShowAll(false);
    setShowMoreMenu(false);
    try { localStorage.removeItem("deckcraft-draft-v1"); } catch {}

    toast.success("New draft started.");
    document.getElementById("compose")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addSlide = () => {
    if (slides.length >= 10) {
      toast.error("Presenta supports up to 10 slides.");
      return;
    }
    setSlides((current) => [...current, { title: "New point of view", bullets: ["Add the clearest supporting idea", "Add the useful implication", "Add the next step"] }]);
    setSelectedSlide(slides.length);
    setShowAll(true);
    toast.success("New slide added to the outline.");
  };

  const saveCurrentPresentation = async () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    try {
      const result = await savePresentation.mutateAsync({ id: currentPresentationId ?? undefined, topic, theme: theme as "Corporate Blue" | "Vibrant Purple" | "Forest Green" | "Minimal Dark", customization, slides: slides.map((slide) => ({ title: slide.title, bullet_points: slide.bullets })) });
      setCurrentPresentationId(result.id);
      toast.success(currentPresentationId ? "Presentation updated in your workspace." : "Presentation saved to your workspace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this presentation.");
    }
  };

  const loadSavedPresentation = (saved: NonNullable<typeof savedPresentations.data>[number]) => {
    setTopic(saved.topic);
    setCurrentPresentationId(saved.id);
    setTheme(saved.theme as typeof theme);
    setCustomization(saved.customization);
    setSlides(saved.slides.map((slide: { title: string; bullet_points: string[] }) => ({ title: slide.title, bullets: slide.bullet_points })));
    setSelectedSlide(0);
    setEditingSlide(null);
    setShowAll(false);
    toast.success("Saved presentation loaded.");
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const deleteSavedPresentation = async (id: number) => {
    try {
      await removeSavedPresentation.mutateAsync({ id });
      if (currentPresentationId === id) setCurrentPresentationId(null);
      toast.success("Saved presentation removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the presentation.");
    }
  };

  const downloadDeck = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export-pptx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, theme, customization, slides: slides.map((slide) => ({ title: slide.title, bullet_points: slide.bullets })) }) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Could not export the PowerPoint." }));
        throw new Error(error.error || "Could not export the PowerPoint.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "presenta-presentation"}.pptx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("PowerPoint downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export the PowerPoint.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="masthead border-b border-ink/10 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <img src="/manus-storage/editorial-mark_31adb5c1.png" alt="Presenta mark" className="h-9 w-9 object-contain" />
            <div className="leading-none"><span className="font-display text-xl font-semibold tracking-tight">presenta</span><span className="ml-2 hidden font-mono text-[9px] uppercase tracking-[0.24em] text-ink/45 sm:inline">studio / 01</span></div>
          </div>
          <div className="hidden items-center gap-8 md:flex"><a className="nav-link active" href="#compose">Compose</a><a className="nav-link" href="#preview">Preview</a><button className="nav-link" onClick={() => document.getElementById("customize")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Export settings</button></div>
          <div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-ink/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#E85D4A]" />Draft mode</span><div className="more-menu-wrap"><button className="icon-button" aria-label="More options" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu((current) => !current)}><MoreHorizontal size={18} /></button>{showMoreMenu && <div className="more-menu"><button onClick={() => { setShowMoreMenu(false); saveCurrentPresentation(); }}>{isAuthenticated ? "Save current draft" : "Sign in to save"}</button><button onClick={() => { setShowMoreMenu(false); document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Jump to preview</button><button onClick={startNewDraft}>Start a new draft</button></div>}</div><button className="icon-button md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={18} /></button></div>
        </div>
        {mobileNav && <div className="border-t border-ink/10 px-5 py-3 md:hidden"><div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.16em]"><a href="#compose" onClick={() => setMobileNav(false)}>Compose</a><a href="#preview" onClick={() => setMobileNav(false)}>Preview</a></div></div>}
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-16 lg:px-10">
        <section className="hero-grid border-b border-ink/10 py-10 lg:py-16">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> Presentation generator <span className="text-ink/35">/</span> 2026</div><h1>Turn the rough idea into a deck <em>worth sharing.</em></h1><p className="hero-lede">Give us the subject. Keep the editorial control. Presenta turns a starting point into a clear, reviewable presentation outline in moments.</p><div className="hero-meta"><div><span className="meta-label">Built for</span><span>Strategists · Educators · Operators</span></div><div><span className="meta-label">Output</span><span>Outline → slide deck</span></div></div></div>
          <div className="hero-art"><img src="/manus-storage/editorial-hero_bcf49676.png" alt="Paper presentation proofs on a studio desk" /><div className="art-caption"><span>Fig. 01</span><span>Ideas, organized.</span></div></div>
        </section>

        <section id="compose" className="workspace-grid py-10 lg:py-14">
          <aside className="workflow-rail"><div className="eyebrow"><span className="eyebrow-line" /> Workflow</div><ol><li className="workflow-item active"><span className="step-no">01</span><span><strong>Shape the brief</strong><small>Topic, tone, and scope</small></span></li><li className="workflow-item"><span className="step-no">02</span><span><strong>Review the proof</strong><small>Titles and talking points</small></span></li><li className="workflow-item"><span className="step-no">03</span><span><strong>Take it further</strong><small>Export when it feels right</small></span></li></ol><div className="rail-note"><img src="/manus-storage/abstract-grid_8f8de039.png" alt="Abstract registration mark" /><p>Good decks are not just generated. They are edited.</p></div></aside>
          <div className="composer-panel"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> 01 / Compose</div><h2>Start with the idea.</h2></div><span className="small-status"><span className="status-dot" /> {draftHydrated ? "Draft saved locally" : "Preparing draft"}</span></div><div className="brief-form"><label className="field-label" htmlFor="topic">What should this presentation make clear?</label><textarea id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} placeholder="e.g. Artificial Intelligence in Healthcare" /><div className="field-foot"><span>Be specific or stay broad — the structure will follow.</span><span>{topic.length}/120</span></div><div className="form-row"><div className="field-wrap"><label className="field-label" htmlFor="slides">Number of slides</label><div className="select-wrap"><select id="slides" value={numSlides} onChange={(event) => setNumSlides(Number(event.target.value))}>{[3,4,5,6,7,8,9,10].map((number) => <option key={number} value={number}>{number} slides</option>)}</select><ChevronDown size={16} /></div></div><div className="field-wrap"><label className="field-label" htmlFor="theme">Visual direction</label><div className="select-wrap"><select id="theme" value={theme} onChange={(event) => setTheme(event.target.value)}>{themes.map((item) => <option key={item.name}>{item.name}</option>)}</select><ChevronDown size={16} /></div></div></div><div className="theme-preview"><div className="theme-swatches">{selectedTheme.swatches.map((swatch) => <span key={swatch} style={{ backgroundColor: swatch }} />)}</div><span><strong>{selectedTheme.name}</strong> · {selectedTheme.tone}</span><button onClick={() => toast.info("Use the customization panel below to tune this deck.")}><ArrowUpRight size={14} /></button></div><div id="customize" className="customize-panel"><div className="customize-heading"><span className="field-label">Customize the deck</span><span className="customize-note">Live preview</span></div><div className="customize-grid"><label><span>Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value)}>{themes.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label><span>Accent</span><input type="color" value={customization.accent} onChange={(event) => setCustomization((current) => ({ ...current, accent: event.target.value }))} /></label><label><span>Font pairing</span><select value={customization.font} onChange={(event) => setCustomization((current) => ({ ...current, font: event.target.value as "editorial" | "modern" | "classic" }))}><option value="editorial">Editorial</option><option value="modern">Modern</option><option value="classic">Classic</option></select></label><label><span>Content density</span><select value={customization.density} onChange={(event) => setCustomization((current) => ({ ...current, density: event.target.value as "airy" | "compact" }))}><option value="airy">Airy</option><option value="compact">Compact</option></select></label></div><label className="footer-field"><span>Footer label</span><input maxLength={40} value={customization.footer} onChange={(event) => setCustomization((current) => ({ ...current, footer: event.target.value }))} placeholder="Presenta Studio" /></label></div><div className="workspace-save"><div className="workspace-save-heading"><span className="field-label">Workspace</span>{authLoading ? <span className="workspace-state">Checking session...</span> : isAuthenticated ? <span className="workspace-state signed-in">Signed in as {user?.name || user?.email || "you"}</span> : <span className="workspace-state">Sign in to save</span>}</div><div className="workspace-save-actions"><button className="save-workspace-button" onClick={saveCurrentPresentation} disabled={savePresentation.isPending}>{isAuthenticated ? <Save size={14} /> : <LogIn size={14} />} {savePresentation.isPending ? "Saving" : isAuthenticated ? "Save presentation" : "Sign in to save"}</button>{isAuthenticated && <button className="logout-workspace-button" onClick={() => logout().catch((error) => toast.error(error instanceof Error ? error.message : "Could not sign out."))}>Sign out</button>}</div>{isAuthenticated && <div className="saved-list">{savedPresentations.isLoading ? <span className="workspace-state">Loading saved decks...</span> : savedPresentations.data?.length ? savedPresentations.data.map((saved) => <div className="saved-row" key={saved.id}><button onClick={() => loadSavedPresentation(saved)}><span>{saved.topic}</span><small>{saved.theme}</small></button><button className="saved-delete" aria-label={`Delete ${saved.topic}`} onClick={() => deleteSavedPresentation(saved.id)}><Trash2 size={13} /></button></div>) : <span className="workspace-state">No saved decks yet.</span>}</div>}</div><button className="generate-button" onClick={generatePresentation} disabled={isGenerating}>{isGenerating ? <><Loader2 size={17} className="animate-spin" /> Working through the brief</> : <><WandSparkles size={17} /> Generate presentation <span className="button-arrow">↗</span></>}</button>{isGenerating && <div className="progress-box"><div className="progress-track"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div><div className="progress-steps">{progressSteps.map((label, index) => <span key={label} className={index <= step ? "done" : ""}>{index < step ? <Check size={11} /> : <span className="progress-number">0{index + 1}</span>}{label}</span>)}</div></div>}</div></div>
        </section>

        <section id="preview" ref={previewRef} className="preview-section border-t border-ink/10 pt-10 lg:pt-14"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> 02 / Preview</div><h2>Your outline is ready for a <em>considered pass.</em></h2></div><div className="preview-actions"><span className="small-status"><FileText size={14} /> {slides.length} slides</span><button className="save-preview-button" onClick={saveCurrentPresentation} disabled={savePresentation.isPending}>{isAuthenticated ? <Save size={14} /> : <LogIn size={14} />} {isAuthenticated ? "Save" : "Sign in to save"}</button><button className="download-button" onClick={downloadDeck} disabled={isExporting || slides.length < 3}><Download size={15} /> {isExporting ? "Building PowerPoint" : "Download PowerPoint"} <span>↗</span></button></div></div><div className="deck-viewer"><div className="viewer-main"><div className="viewer-toolbar"><span className="viewer-label"><span className="status-dot" /> Live slide view</span><span className="viewer-hint">Click a thumbnail to inspect the story</span></div>{slides[selectedSlide] && <div className="slide-canvas" style={{ backgroundColor: selectedTheme.swatches[0], color: selectedTheme.swatches[2], borderColor: customization.accent }}><div className="canvas-top"><span className="canvas-index">{String(selectedSlide + 1).padStart(2, "0")}</span><span className="canvas-topic">{topic}</span></div><div className="canvas-content"><div className="canvas-kicker" style={{ color: customization.accent }}>PRESENTA / {theme.toUpperCase()}</div><h3 className={`canvas-font-${customization.font}`}>{slides[selectedSlide].title}</h3><div className="canvas-rule" style={{ backgroundColor: customization.accent }} /><ul className={customization.density === "compact" ? "canvas-bullets-compact" : ""}>{slides[selectedSlide].bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div><div className="canvas-footer"><span>{customization.footer || "Presentation preview"}</span><span>{String(selectedSlide + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span></div></div>}</div><div className={`slide-thumbnails thumbnails-${customization.density}`}>{slides.map((slide, index) => <button key={`${slide.title}-${index}`} className={`slide-thumbnail slide-thumbnail-${customization.font} ${selectedSlide === index ? "selected" : ""}`} style={{ borderLeftColor: customization.accent }} onClick={() => setSelectedSlide(index)}><span className="thumbnail-number" style={{ color: customization.accent }}>{String(index + 1).padStart(2, "0")}</span><span>{slide.title}</span></button>)}</div></div><div className="preview-layout"><div className="preview-intro"><span className="slide-count">{String(slides.length).padStart(2, "0")}</span><p>Each card is a moment to pause, sharpen, or move on. The story is yours to edit.</p><button className="text-button" onClick={addSlide}><Plus size={14} /> Add a slide</button></div><div className="slides-stack">{visibleSlides.map((slide, index) => <article className="slide-card" key={slide.title} style={{ animationDelay: `${index * 60}ms` }}><div className="slide-card-top"><span className="card-number">{String(index + 1).padStart(2, "0")}</span><span className="card-type">Content slide</span><button className="card-menu" aria-label={`Edit slide ${index + 1}`} onClick={() => editingSlide === index ? saveEdit() : beginEdit(index)}>{editingSlide === index ? <Check size={16} /> : <MoreHorizontal size={16} />}</button></div>{editingSlide === index ? <div className="slide-editor"><input aria-label="Slide title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /><textarea aria-label="Slide bullet points" value={draftBullets} onChange={(event) => setDraftBullets(event.target.value)} rows={6} /><div className="edit-actions"><button className="save-edit" onClick={saveEdit}>Save slide</button><button className="remove-edit" onClick={() => removeSlide(index)}><Trash2 size={12} /> Remove</button></div></div> : <><h3>{slide.title}</h3><ul>{slide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></>}<div className="slide-card-foot"><span>{editingSlide === index ? "Editing outline" : "Presenta outline"}</span><span>↗</span></div></article>)}</div></div>{slides.length > 3 && <button className="show-more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : `Show ${slides.length - 3} more slides`} <span>{showAll ? "↑" : "↓"}</span></button>}</section>

        <section className="bottom-callout"><div><div className="eyebrow"><span className="eyebrow-line" /> A note from the studio</div><p>Structure is a form of generosity. Make the next idea easier to follow.</p></div><div className="callout-mark"><Sparkles size={18} /><span>DC / 01</span></div></section>
      </main>
      <footer className="border-t border-ink/10"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-3 px-5 py-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 sm:flex-row lg:px-10"><span>Presenta studio / Presentation generator</span><span>Made for the first clear version.</span></div></footer>
    </div>
  );
}
