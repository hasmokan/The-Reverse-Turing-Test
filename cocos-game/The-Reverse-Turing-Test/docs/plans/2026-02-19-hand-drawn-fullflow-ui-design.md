# Hand-Drawn Full-Flow UI Redesign (Design)

Date: 2026-02-19
Scope: MainScene + MultiPlayerScene + multiplayer-related UI panels (visual consistency and interaction refactor)

## 1. Goals

- Rebuild the full gameplay flow UI to match the provided hand-drawn wireframe style.
- Keep the game playable end-to-end (draw -> sync -> vote -> result -> return/restart).
- Allow interaction/rule orchestration changes at phase boundaries while avoiding risky changes to core battle data structures.
- Use Cocos-native components (`cc.Sprite`, `cc.Mask`, `cc.Button`, `cc.Label`) and MCP-driven scene editing. No CSS layer.

## 2. Non-Goals

- No introduction of WebView/CSS rendering.
- No backend protocol changes.
- No full rewrite of battle simulation internals unless blocking issues are found.

## 3. Target Layout & Visual Language

### 3.1 Global screen language (9:16 priority)

- Primary target is portrait mobile (9:16).
- Centered rounded main card as the visual anchor.
- Top strip: theme + fish count/status.
- Middle: primary content area (draw board / phase content).
- Bottom fixed CTA area with pill-like button (e.g., “画一条鱼”).

### 3.2 Styling primitives

- Rounded container: `Sprite + Mask(SPRITE_STENCIL)` with rounded transparent sprite frame.
- Cards and buttons share color and radius system from a central config.
- Label hierarchy:
  - Headline: stage title and key status.
  - Body: hints and actions.
  - Foot: helper text/error notices.

## 4. Architecture

### 4.1 Scene-level structure

MultiPlayerScene becomes a single root experience container:

- `GameScreenRoot`
  - `TopStatusBar`
  - `PhaseContainer`
    - `DrawPhase`
    - `SyncPhase`
    - `VotePhase`
    - `ResultPhase`
  - `BottomActionBar`

MainScene and other related entry panels adopt the same visual primitives (card/button typography and spacing), while preserving scene routing behavior.

### 4.2 Script boundaries

- `SinglePlayerController` remains the main phase orchestrator.
- Phase rendering logic is split into smaller update methods:
  - phase container visibility
  - button state/text updates
  - top status refresh
  - helper text/transition tip refresh
- Shared visual constants are centralized in a new config module (e.g., `HandDrawnUIConfig`).

## 5. Interaction & Data Flow

### 5.1 Phase flow

1. DrawPhase
   - User enters drawing panel from main card CTA.
   - Draw -> submit -> refresh count and fish metadata.
2. SyncPhase
   - Starts from “开始游戏”.
   - Shows bounded-duration sync overlay/progress text.
3. VotePhase
   - Existing vote mechanics stay, but wrapped in redesigned UI shell.
   - “再画一条” allowed as secondary action, returning to draw flow and then back.
4. ResultPhase
   - Reuses existing win/lose determination signals.
   - Uses redesigned card/button composition for result actions.

### 5.2 State ownership

- Core runtime state remains in `SinglePlayerController` and `GameManager`.
- UI nodes remain projection of state, never source of truth.
- Existing IDs/maps/sets for fish and votes are preserved unless migration is strictly required.

## 6. MCP-based Scene Refactor Plan

1. Build/reshape phase containers and shared top/bottom bars in `MultiPlayerScene`.
2. Apply rounded sprite/mask components and visual props to key containers.
3. Rebind script fields to rebuilt nodes (UUID/property alignment).
4. Harmonize `MainScene` entry area visuals with same primitive set.
5. Extend style unification to other related UI panels used in the full loop.
6. Remove obsolete nodes only after references and flow are validated.

## 7. Error Handling & Safety

- Guard all node/component lookups in controller code.
- If a required node is missing, fail gracefully with warning and fallback visibility.
- Keep legacy nodes until migration checkpoints pass.
- Keep phase transitions explicit and debounced to avoid double-entry race conditions.

## 8. Testing & Verification

### 8.1 Functional checks

- Entry from MainScene into MultiPlayerScene.
- Draw, submit, count update, start game.
- Sync phase appears/disappears correctly.
- Vote interactions still function.
- Result panel appears with valid actions (restart/back).

### 8.2 UI checks

- 9:16 portrait framing and safe-area sanity.
- Rounded mask clipping correctness.
- Bottom CTA visibility and touchability in all phases.
- Text clipping/overflow behavior for Chinese labels.

### 8.3 Regression checks

- Scene transition stability.
- Existing gameplay data integrity (votes/elimination/end conditions).
- No missing references in editor console after migration.

## 9. Delivery Strategy

Recommended rollout is staged integration:

- Stage A: MultiPlayerScene full flow shell + controller adaptation.
- Stage B: MainScene and related panel style unification.
- Stage C: polish + cleanup of deprecated nodes/scripts.

This staging minimizes rollback risk and keeps each checkpoint testable.
