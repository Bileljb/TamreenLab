# ADR 010 — Shortcut drills

- **Status:** accepted
- **Date:** 2026-11-09
- **Decider:** Claude Code (approach), within PLAN Phase 6; developer approved the plan

## Context

Phase 6 turns SHORTCUT steps, which the engine could already check from a key press (ADR 003), into real exercises. There are three constraints:

- **The browser keeps some shortcuts.** A page cannot stop the browser from acting on them, because `preventDefault` has no effect. New tab and close tab are examples.
- **Phones have no keyboard.**
- **Windows and Mac differ.** Mac uses ⌘ where Windows uses Ctrl, and some Mac combos are different altogether.

## Decision

**Two ways to answer, one checker.** A SHORTCUT answer is either:

- a captured key press, `{ keys, platform }`, or
- a combo picked from a list, `{ combo, platform }`.

The engine checks both against the step's combos for that platform. The API scores both with the same `checkAnswer`; there is still no client "correct" flag.

**The mode is decided in the engine.** `shortcutMode(step, platform, { touch })` returns `choice` in three cases:

- the device is touch-only;
- the author set `blockedInBrowser`;
- every correct combo for that platform is in `RESERVED_COMBOS`.

Otherwise the learner presses the keys. `referenceAnswer` and `content:lint` use the same rule, so every step is proved solvable on both platforms.

**The reserved list errs on the safe side.** A step wrongly sent to choice is only less fun. A step wrongly left as capture may never be answerable. The list contains:

- **Windows (Chrome and Firefox):**
  - new window, new tab and close tab, with and without Shift;
  - Ctrl+Shift+P and Ctrl+Shift+Q;
  - Ctrl+Tab and Ctrl+PageUp/PageDown, which switch tabs;
  - Ctrl+1…9;
  - Ctrl+F4, Alt+F4 and Alt+Tab;
  - F11;
  - any combo with the Windows key.
- **Mac:**
  - ⌘N/T/W/Q/H/M, and ⌘⇧N/T/W;
  - ⌘Tab, ⌘\` and ⌘1…9;
  - ⌘Space and Ctrl+Space, which macOS keeps for Spotlight and input sources;
  - Ctrl+arrows, which Mission Control uses.

Ctrl/⌘+1…9 are listed although some browsers let pages take them.

**Options are fixed per step.**
- `shortcutOptions` lists the taught combo plus the authored `distractors`, shuffled from a hash of the slug, so the player, the API and the tests always see the same order.
- `content:lint` requires at least two distractors, none of which is a correct combo.
- `content:lint` also prints the steps that fall back to choice on each platform, so every fallback is deliberate.

**Key matching works across keyboard layouts.**
- A press matches by the character typed and by the physical key (`code`). On an Arabic layout, Ctrl+D reports `ي` but `KeyD`.
- Punctuation keys match by their code (`Equal`, `Semicolon`, `Backquote`).
- With Shift held, a digit key also stands for its US symbol, so `Ctrl+Shift+$` matches Ctrl+Shift+4 on any layout.

**The player:**
- **Capture box.** A focusable box shows the modifiers being held, checks on the first non-modifier key, and shows what was pressed.
- **Tab.** Tab still leaves the box, unless the step teaches a Tab combo.
- **Platform.** The platform comes from `navigator.userAgentData.platform`, then `navigator.platform`, then the user agent. A Windows/Mac switch overrides it and is remembered in `tamreen.platform.v1`.
- **Touch.** A touch-only device is `(pointer: coarse)` without `(any-pointer: fine)`.

## Consequences

- Seven lessons (track `shortcuts`) teach navigation, selection, editing, fill, AutoSum and formula keys, and formatting, then review them.
  - On Windows, two steps fall back to choice on purpose: next sheet and Format Cells.
  - On Mac, six do, including AutoSum (⌘⇧T) and F4's Mac equivalent (⌘T).
- **Firefox testing.**
  - Playwright has a `firefox` project for `e2e/shortcuts.spec.ts`, and CI installs Firefox.
  - On the developer's Windows machine, Windows' application-control policy blocks Playwright's Firefox build. Firefox runs there only in CI, which uses Linux.
  - Chromium on Windows is tested locally.
- **Known limitation.** On layouts where `$` is not Shift+4 (French AZERTY), the currency step does not register the key press. The learner can use a hint or Show Answer.
- Some browser and system shortcuts may change over time. Add a combo to `RESERVED_COMBOS` when it can no longer be captured, and `content:lint` will show which steps change mode.
