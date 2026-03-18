# Site Improvements — Applying negative-support.md Feedback

Based on ~/documents/negative-support.md review. No changes made yet — this is the proposal.

---

## 1. Hero Section (Landing.tsx lines 40–86)

### Current
- Headline: "Negative-space supports that fit perfectly"
- Subhead: "Generate volumetric supports that follow the curvature..."
- CTAs: "Generate now" + "Documentation"

### Proposed Changes

**Subhead** — Replace the abstract description with pain-forward copy:
> Generate custom-fit 3D print supports that reduce scarring, follow complex geometry, and peel off clean — for STEP, STL, and OBJ files.

**Add proof bullets** below the subhead (before CTAs):
- Better for curved surfaces, cavities, and threads
- Supports that peel off in one piece
- Configurable air gap — no fusing to the surface
- Slicer-ready 3MF export

**CTA** — Change "Generate now" to "Try 10 free runs" (stronger conversion hook)

---

## 2. "What is this?" Section (lines 138–291)

### Current
- Generic "Supports that are shaped like your model"
- "Who it's for" / "Also for" / "How it works" cards
- Comparison: tree vs negative-space (abstract benefits)

### Proposed Changes

**Replace comparison bullet copy** with more visceral, specific pain:

Tree supports (current → proposed):
- "Fuse to the model" → "Scar threads, mating faces, and smooth finishes"
- "Struggle with complex geometry" → "Miss curved overhangs and internal cavities"
- "Are difficult to remove" → "Snap unevenly, leave stubs — especially PETG and nylon"

Negative-space supports:
- "Have less contact damage" → "Save surface finish on cosmetic parts"
- "Cover on any shape" → "Follow overhangs, undercuts, and cavities uniformly"
- "Are easier to remove" → "Peel off in one piece — PLA, PETG, ABS, nylon"

---

## 3. NEW: "When to use it" Section

**This section is missing entirely** — the review calls it out specifically.

Add between the comparison and features sections. Simple grid of use cases:

- Figurines and organic shapes
- Threaded parts and mating faces
- Internal cavities and undercuts
- Cosmetic surfaces (visible curved areas)
- PETG/nylon parts where cleanup is painful
- Models you sell or share (ship with pre-made supports)

Each with a one-line explanation. No cards/borders — keep it lightweight.

---

## 4. Features Section (lines 293–361)

### Current
- "What's in the box" heading
- 4 feature cards: STEP+Mesh, 3MF, Gap control, Cross-platform

### Proposed Changes

Minor copy sharpening only:
- "Smart overhang detection" → "Overhang detection that reads your model"
- "Slicer-ready 3MF output" → "Open in Bambu/Prusa/Orca and print"
- "Precision air gap" → "Configurable air gap — no fusing"
- "Web, CLI, and API" → "Same result everywhere"

---

## 5. Pricing Section (lines 363–486)

### Current
- "Simple, one-time pricing" heading
- Long apologetic subhead about "helping us keep improving"

### Proposed Changes

**Subhead** — Less apologetic, more value-forward:
> Start free with 10 runs. Go unlimited with a one-time payment — no subscriptions, no per-run fees.

**Free tier CTA** — "Get started" → "Try 10 free runs" (matches hero)

---

## 6. NEW: Social Proof Section

**Currently missing.** Add below pricing or between features and pricing.

Options (depends on what's available):
- GitHub stars count (if meaningful)
- npm weekly downloads
- "Used by X creators" (once we have data)
- Placeholder for user quotes/screenshots once collected

For launch, even minimal proof helps:
- "Open source on GitHub" + star count
- npm download badge

---

## 7. Hero Subtitle / Permanent Translation

The review says "negative support" isn't self-explanatory and needs a permanent subhead:

> Generate model-shaped 3D print supports that reduce scarring and remove cleanly.

This is essentially what the current subhead does, but it should be shorter and punchier. Current version is 25 words; aim for ~15.

---

## Summary of Proposed Sections (top to bottom)

1. **Hero** — pain-forward subhead, proof bullets, "Try 10 free runs" CTA
2. **Install strip** — unchanged (already good)
3. **What is this?** — sharper comparison copy, more visceral pain language
4. **When to use it** — NEW section with specific use cases
5. **What's in the box** — minor copy sharpening
6. **Pricing** — less apologetic, value-forward
7. **Social proof** — NEW, minimal for now (GitHub + npm)

---

## What NOT to change

- Overall design/layout — "looks premium" per review, don't touch structure
- Pricing amounts — $0 / $19 is correct for early adoption
- Technical accuracy — all claims are real, no puffery needed
- Install strip — already strong
- Comparison images (model/supports/combined) — these are good visual proof
