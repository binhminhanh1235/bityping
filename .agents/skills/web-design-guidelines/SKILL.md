---
name: web-design-guidelines
description: >-
  Review UI code for Web Interface Guidelines compliance. Use when asked to
  "review my UI", "check accessibility", "audit design", "review UX", or
  "check my site against best practices". Covers a11y, focus states, forms,
  touch interaction, typography, and layout.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: "<file-or-pattern>"
---

# Web Interface Guidelines & Audit Skill

Review frontend files for compliance with the Web Interface Guidelines (Vercel Labs standard).

## Core Review Checklist

### 1. Accessibility (a11y)
- [ ] **Icon-only buttons**: MUST have an explicit `aria-label`.
- [ ] **Form controls**: MUST have an associated `<label>` (via `htmlFor` or wrapping) or `aria-label`.
- [ ] **Semantic elements**: Use `<button>` for actions and `<a>`/`<Link>` for navigation. NEVER `<div onClick>`.
- [ ] **Keyboard navigation**: Interactive elements must respond to keyboard (`Enter`, `Space`, or custom hotkeys).
- [ ] **Images**: Always specify `alt` (or explicit `alt=""` if purely decorative).
- [ ] **Decorative icons**: Mark with `aria-hidden="true"`.
- [ ] **Live announcements**: Dynamic notifications, toasts, or validation errors need `aria-live="polite"` or `role="alert"`.
- [ ] **Heading hierarchy**: Proper sequential order (`<h1>` through `<h6>`). Include a skip link for main content.

### 2. Focus States
- [ ] **Visible focus**: Interactive elements must show a distinct focus ring: `focus-visible:ring-2` (Tailwind) or `:focus-visible` CSS.
- [ ] **Never naked outline**: NEVER set `outline: none` or `outline-none` without an accessible focus replacement.
- [ ] **`:focus-visible` over `:focus`**: Prevents distracting rings on mouse clicks while keeping them for keyboard users.
- [ ] **Compound controls**: Use `:focus-within` to group related inputs (e.g. search bars with attached action buttons).
- [ ] **Covering elements**: Fixed headers/sticky footers must not conceal the currently focused element (`scroll-margin-top` / `scroll-margin-bottom`).

### 3. Forms & Inputs
- [ ] **Autocomplete & name**: Form inputs need meaningful `name` and appropriate `autocomplete` attributes.
- [ ] **Appropriate input types**: Use `type="email"`, `type="tel"`, `type="url"`, `type="number"`, and suitable `inputmode`.
- [ ] **No paste blocking**: Never intercept paste with `e.preventDefault()`.
- [ ] **Clickable labels**: Ensure tapping a label activates the input. Checkboxes/radios should share a generous hit target with their labels.
- [ ] **Disable spellcheck**: Add `spellCheck={false}` / `spellcheck="false"` on usernames, emails, code inputs, and typing exercise fields.
- [ ] **Clear error feedback**: Display error text inline adjacent to the invalid input, and focus the first invalid field upon submission.

### 4. Touch & Mobile Interaction
- [ ] **Touch action**: Apply `touch-action: manipulation` to eliminate double-tap zoom delay.
- [ ] **Touch target size**: Minimum touch target of 44×44px with at least 8px spacing between targets.
- [ ] **Scroll chaining**: In modals, sidebars, or dropdowns, use `overscroll-behavior: contain`.
- [ ] **Form auto-zoom prevention**: iOS Safari zooms in on `<input>` if `font-size` is below 16px. Ensure inputs are at least 16px.

### 5. Typography & Content
- [ ] **Typography hygiene**: Use ellipsis `…` instead of `...`, curly quotes `“` `”` for prose, and non-breaking spaces `&nbsp;` for units (`10&nbsp;MB`, `⌘&nbsp;K`).
- [ ] **Tabular numbers**: Use `font-variant-numeric: tabular-nums` for counters, timers, and aligned data.
- [ ] **Overflow handling**: Long text containers need `truncate`, `line-clamp-*`, or `overflow-wrap: break-word`. Flex children require `min-w-0` to truncate properly.

### 6. Animation & Motion
- [ ] **Reduced motion**: Always respect `@media (prefers-reduced-motion: reduce)`. Provide static alternatives or disable transitions.
- [ ] **GPU-friendly properties**: Animate only `transform` and `opacity`. Never `transition: all` — list animated properties explicitly.

---

## Anti-Patterns to Flag (Immediate Code Smells)

1. `user-scalable=no` or `maximum-scale=1` in `<meta name="viewport">` (violates WCAG accessibility).
2. `<div onClick={...}>` or `<span onClick={...}>` without `role="button"` and keyboard handlers.
3. `outline: none` without focus-visible styles.
4. `onPaste={(e) => e.preventDefault()}`.
5. Form inputs lacking visible labels or `aria-label`.
6. Icon buttons without `aria-label`.
7. `transition: all 0.3s ease`.
8. Uncontrolled inputs missing `onChange` or `defaultValue`.

---

## Audit Output Format

When auditing files, report findings using terse, actionable `file:line` citations:

```text
## src/components/TypingArea.tsx

src/components/TypingArea.tsx:45 - input missing aria-label or associated <label>
src/components/TypingArea.tsx:58 - outline-none used without focus-visible replacement
src/components/TypingArea.tsx:72 - transition: all → specify exact properties (opacity, transform)
src/components/TypingArea.tsx:88 - input font-size under 16px (will trigger iOS Safari auto-zoom)

## src/components/Header.tsx

✓ pass (all guidelines met)
```
