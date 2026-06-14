# Fix Ctrl+W Space Direction in Word Deletion

**Date:** 2026-06-15
**Status:** Draft

## Problem

The `deleteWordBackward` regex `/(?:\s+\S*|\s+|\S+)$/` bundles spaces to the **left** of the deleted word. For example, on `hello   world   |foo` (cursor at 3 spaces), the first press deletes only the 3 spaces, the second deletes `   world` (spaces left of word + word).

Tools like Codex and Claude Code bundle spaces to the **right** of the word — one press on `hello   world   |foo` should delete `world   ` (word + spaces to its right).

## Goal

Flip the regex so it matches `\S+\s*` (word first, then trailing spaces to its right) instead of `\s+\S*` (spaces first, then word to their left).

## Change

**File:** `src/renderer/hooks/useShortcuts.ts`, line 12

**Current:**
```typescript
const trimmed = beforeCursor.replace(/(?:\s+\S*|\s+|\S+)$/, '');
```

**New:**
```typescript
const trimmed = beforeCursor.replace(/(?:\S+\s*|\s+)$/, '');
```

`\S+$` is dropped because `\S+\s*$` already covers the zero-trailing-spaces case.

## Behavior comparison

| Input (cursor at `\|`) | Old match | New match |
|---|---|---|
| `hello   world   \|foo` | `   ` (3 spaces) | `world   ` (word + trailing spaces) |
| `hello   world\|` | `   world` (spaces left + word) | `world` (just the word) |
| `hello   \|` | `   ` (spaces) | `hello   ` (word + spaces) |
| `   \|` | `   ` | `   ` (same) |
| `hello\|` | `hello` | `hello` (same) |

All callers and the function's return type are unchanged.
