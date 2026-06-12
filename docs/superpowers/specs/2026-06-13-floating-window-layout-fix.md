# Floating Window Layout Fix

## Summary

Fix the floating translation window so the footer (keyboard shortcuts bar) is always visible regardless of textarea content height. When content exceeds the max height, the textarea scrolls internally instead of pushing the footer off-screen. Also auto-scroll to the latest text during AI streaming.

## Problem

The textarea uses `[field-sizing:content]` which makes the element grow with its content. This overrides the flex layout, causing the footer to be pushed below the visible viewport when text is long. The `overflow-hidden` on the parent container clips the footer.

## Solution

### Textarea CSS Changes (FlowTranslate.tsx)

Removed: `[field-sizing:content]`
Added: `flex-1 min-h-0` — allows the textarea to fill remaining space and shrink below its intrinsic size.
Kept: `overflow-y-auto` — now actually functional since the textarea has a constrained height.
Kept: `resize-none` — unchanged.

The parent flex container (`flex flex-col`) and footer (`flex-none min-h-[60px]`) remain unchanged — they already have the correct constraints.

### Auto-scroll During AI Streaming

New `useEffect` that sets `textarea.scrollTop = textarea.scrollHeight` whenever `translation` changes during active translation. This ensures the latest AI-generated characters are always visible.

```typescript
useEffect(() => {
  if (isTranslating && textareaRef.current) {
    textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
  }
}, [translation, isTranslating]);
```

### Window Max Height

`useAutoResize` max height of 600px remains unchanged. Once the window hits 600px, the textarea's internal scroll handles overflow. The footer stays pinned at the bottom.

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/pages/FlowTranslate/FlowTranslate.tsx` | Remove `field-sizing:content`, add `flex-1 min-h-0`, add auto-scroll useEffect |
