import { useState, useRef, useEffect } from 'react';
import { FretboardDiagram } from './FretboardDiagram';

// Single, page-level hint that diagrams are tappable to zoom — meant to
// appear ONCE per page, not once per diagram.
export function ZoomHint() {
  return (
    <p style={{ textAlign: 'center', fontSize: '12px', color: '#888', margin: '4px 0 14px' }}>
      🔍 Click to zoom
    </p>
  );
}

// Wraps the standalone fretboard render — the diagram itself is the
// click target (no icon button), matching the original "make the
// diagrams clickable" instruction. Discoverability comes from the
// page-level ZoomHint, not a per-diagram badge.
export function ZoomableFretboard({ selectedKey, onOpenDetail }) {
  return (
    <div
      onClick={() => onOpenDetail({
        title: `Fretboard — ${selectedKey}`, subtitle: '', difficulty: null,
        content: <FretboardDiagram selectedKey={selectedKey} />,
      })}
      style={{ cursor: 'pointer' }}
    >
      <FretboardDiagram selectedKey={selectedKey} />
    </div>
  );
}

// Standard large-format wrapper for monospace tab content (box licks,
// free licks, double stops, chord-riff tabs) inside the detail view —
// exported so callers don't have to repeat this styling by hand.
export function BigTabDisplay({ children }) {
  return (
    <pre style={{
      fontFamily: '"Courier New",monospace', fontSize: '16px', lineHeight: '2',
      backgroundColor: '#000', color: '#e0e0e0', padding: '18px 22px', borderRadius: '10px',
      whiteSpace: 'pre', margin: 0,
    }}>
      {children}
    </pre>
  );
}

const DIFF_COLORS = {
  Beginner:     { bg: '#e8f5e2', color: '#2a6b17', border: '#b5d9a5' },
  Intermediate: { bg: '#fff8e1', color: '#7a5000', border: '#f0c040' },
  Advanced:     { bg: '#fde8e8', color: '#8b1a1a', border: '#f0b8b8' },
};

// Full-screen detail view for ANY diagram in the app — box licks, free
// licks, double stops, chord-riff tabs, the fretboard, and Key Finder's
// per-degree chord shape diagrams. Content is fully generic (any JSX),
// not tied to one diagram type, so new diagram kinds can use this
// without changes here. Supports:
// - two-finger pinch-to-zoom (fit-to-screen up to 6x that)
// - single-finger drag-to-pan once zoomed in
// - double-tap to reset back to the fit-to-screen size
// - auto-fit on open: measured at natural size, scaled to fill the
//   available screen space, not just centered at whatever size it
//   happened to render at
// - landscape support: re-measures and re-fits on resize/orientation
//   change, so flipping the phone actually resizes the diagram
// - an optional toggle to switch to a second related diagram (e.g. a
//   lick <-> the fretboard for its key, or a chord shape <-> the
//   fretboard for its key) when one is supplied
// - only the back button is fixed on screen — title, subtitle, the
//   toggle, and the footer hint all live inside the same pinch-zoom/pan
//   frame as the diagram itself, so zooming in can push that chrome
//   off-screen and let the diagram genuinely fill the display (this
//   matters most in landscape, where vertical space is already tight)
export function DiagramDetailView({
  title, subtitle, difficulty,
  content, secondaryContent, secondaryLabel = 'Show fretboard', primaryLabel = 'Show diagram',
  initialShowSecondary = false, onClose,
}) {
  const diff = difficulty ? DIFF_COLORS[difficulty] : null;
  const canToggle = !!(content && secondaryContent);
  const [showSecondary, setShowSecondary] = useState(initialShowSecondary);
  const active = showSecondary && secondaryContent ? secondaryContent : content;

  const [fitScale, setFitScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const fitScaleRef = useRef(1);
  const scaleRef = useRef(1);
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const pinchRef = useRef({ startDist: 0, startScale: 1 });
  const panRef = useRef({ startX: 0, startY: 0, startTranslate: { x: 0, y: 0 }, panning: false });
  const lastTapRef = useRef(0);

  useEffect(() => { fitScaleRef.current = fitScale; }, [fitScale]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Measures the content at its natural (unscaled) size and computes a
  // scale that fits it into the available viewport, then applies that
  // as both the floor for pinch-zoom and the starting scale. Re-running
  // this on resize/orientationchange is what makes flipping the phone
  // actually resize the diagram instead of leaving it as-is. Dividing
  // the currently-rendered size by the currently-applied scale recovers
  // the true natural size regardless of whatever zoom level was active
  // when this runs (transform:scale is purely visual — it doesn't
  // change the element's own intrinsic size).
  useEffect(() => {
    const fit = () => {
      if (!viewportRef.current || !contentRef.current) return;
      const currentScale = scaleRef.current || 1;
      const contentRect = contentRef.current.getBoundingClientRect();
      const naturalWidth = contentRect.width / currentScale;
      const naturalHeight = contentRect.height / currentScale;
      if (!naturalWidth || !naturalHeight) return;
      const viewportRect = viewportRef.current.getBoundingClientRect();
      const availW = viewportRect.width * 0.94;
      const availH = viewportRect.height * 0.94;
      const newFit = Math.min(availW / naturalWidth, availH / naturalHeight);
      if (newFit > 0 && isFinite(newFit)) {
        setFitScale(newFit);
        setScale(newFit);
        setTranslate({ x: 0, y: 0 });
      }
    };
    const raf = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [showSecondary]); // content changes size when toggling, so re-fit then too

  const getDistance = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const resetZoom = () => { setScale(fitScaleRef.current); setTranslate({ x: 0, y: 0 }); };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: getDistance(e.touches), startScale: scaleRef.current };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) resetZoom();
      lastTapRef.current = now;
      panRef.current = {
        startX: e.touches[0].clientX, startY: e.touches[0].clientY,
        startTranslate: translate, panning: true,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const ratio = getDistance(e.touches) / pinchRef.current.startDist;
      const min = fitScaleRef.current;
      const max = fitScaleRef.current * 6; // generous — "zoom in to their heart's content"
      setScale(Math.min(max, Math.max(min, pinchRef.current.startScale * ratio)));
    } else if (e.touches.length === 1 && panRef.current.panning && scaleRef.current > fitScaleRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      setTranslate({
        x: panRef.current.startTranslate.x + dx,
        y: panRef.current.startTranslate.y + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    panRef.current.panning = false;
    if (scaleRef.current <= fitScaleRef.current) resetZoom();
  };

  const iconBtnStyle = {
    background: 'none', border: '1px solid #555', borderRadius: '8px',
    height: '36px', color: '#fff', fontSize: '14px', cursor: 'pointer',
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 12px', gap: '6px',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.97)', zIndex: 1000,
      touchAction: 'none',
    }}>
      {/* Only the back button stays fixed outside the zoomable frame —
          everything else (title, toggle, diagram, hint text) zooms and
          pans together as one page, so zooming in can push the chrome
          off-screen and let the diagram genuinely fill the display,
          especially useful in landscape where vertical space is tight. */}
      <button onClick={onClose} aria-label="Back" style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        background: 'rgba(20,20,20,0.85)', border: '1px solid #555', borderRadius: '50%',
        width: '40px', height: '40px', color: '#fff', fontSize: '18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}>
        ←
      </button>
      <div
        ref={viewportRef}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={resetZoom}
      >
        <div ref={contentRef} style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: scale === fitScale ? 'transform 0.2s ease' : 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
          padding: '0 16px',
        }}>
          {(canToggle || title || subtitle || diff) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              {canToggle && (
                <button
                  // Stops the tap from also being interpreted as the
                  // start of a pan gesture by the viewport's touch
                  // handlers, since this button now lives inside that
                  // same touch-tracked area.
                  onClick={(e) => { e.stopPropagation(); setShowSecondary(v => !v); }}
                  style={iconBtnStyle}>
                  {showSecondary ? `🎸 ${primaryLabel}` : `🎼 ${secondaryLabel}`}
                </button>
              )}
              {(title || subtitle || diff) && (
                <div style={{ color: '#fff', minWidth: 0, textAlign: 'center' }}>
                  {title && <div style={{ fontWeight: '600', fontSize: '16px' }}>{title}</div>}
                  {(subtitle || diff) && (
                    <div style={{ fontSize: '13px', color: '#aaa', marginTop: '2px' }}>
                      {subtitle}
                      {diff && (
                        <span style={{
                          marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                          fontWeight: '600', backgroundColor: diff.bg, color: diff.color,
                        }}>
                          {difficulty}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {active}
          <p style={{ textAlign: 'center', color: '#666', fontSize: '12px', margin: 0 }}>
            Pinch to zoom · drag to pan when zoomed · double-tap to reset
          </p>
        </div>
      </div>
    </div>
  );
}
