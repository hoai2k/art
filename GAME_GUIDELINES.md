# Web Game Collection Guidelines

This folder will contain a collection of high-quality web-based games. These guidelines define the shared experience and quality bar for every title. Each game's mechanics, theme, and assets will be defined separately when that game is described.

## Core principles

- Build complete, polished games with clear rules, responsive controls, cohesive art direction, satisfying feedback, and strong performance.
- Treat Xbox controllers as first-class inputs for both gameplay and menu navigation. A player should be able to complete the entire experience with a controller once browser permissions allow it.
- Provide usable keyboard and pointer controls alongside controller support.
- Maintain a consistent shell across the collection while giving every game its own visual identity.
- Use generated imagery where it improves the result. Use the requested imagegen workflow for title logos and, as appropriate, backgrounds, illustrations, textures, and other assets. Use imagegen(2) if available; verify available generation capabilities at implementation time.

## Required title screen

Every game opens on a carefully composed title screen containing:

1. A title presented as a generated logo image, with readable lettering, a clean silhouette, and a composition suited to the game's theme. Include an accessible text equivalent.
2. The text **“Press Start”** below the title. It must be an actionable control with visible hover, focus, and pressed states.
3. Four icon buttons anchored to the bottom right, in this order: **Instructions** (a page), **Settings** (a gear, never a sun), **Sound** (a speaker that visibly switches between on and a crossed-out off state, with `aria-pressed` and a label that says which), and **Fullscreen**. Provide accessible names and readable labels on hover or focus. The Sound setting persists between visits.

The title screen must look finished at different viewport sizes, with sufficient contrast, comfortable spacing, safe edge margins, and restrained animation. Avoid placeholder assets in the finished game.

## Starting the game and fullscreen

- Clicking or tapping **Press Start**, activating it with the keyboard, or pressing any Xbox controller button while the title screen is idle starts the game.
- At that moment, request fullscreen and transition to the main game page or scene.
- Fullscreen is a request subject to browser restrictions. If the browser rejects the request, continue into the game without blocking or losing input, and keep an explicit fullscreen control available.
- The bottom-right Fullscreen button enters or exits fullscreen without starting the game.
- React gracefully when fullscreen is exited, including through the browser or Escape key. Resize the game correctly and preserve game state.
- Detect a fresh controller button press; a button held before the title screen appears must not accidentally start the game. Consume the start input so it does not also trigger a gameplay action.

### Title-screen controller navigation

The “any button starts” requirement and controller access to utility buttons need an explicit distinction:

- In the initial idle title state, any controller button starts the game, including D-pad buttons.
- Moving the left stick enters utility navigation, exposing a visible selection across Press Start, Instructions, Settings, and Fullscreen.
- Once utility navigation is active, controller buttons follow normal menu semantics: **A** activates the focused control, **B** backs out, and **Menu/Start** starts the game when no dialog is open.
- Show a subtle hint such as **“Move left stick for options”** so utility navigation is discoverable.
- When Instructions or Settings is open, inputs operate that dialog and must not start the game behind it.

## Controller-first interaction

### Shared menu conventions

- **D-pad or left stick:** move focus.
- **A:** select or confirm.
- **B:** go back or close the current dialog.
- **Menu/Start:** pause or resume during gameplay.
- Give every interactive control a clear, high-contrast focus state. Never require pointer hover to reveal essential information.
- Use predictable directional navigation, sensible default focus, and focus restoration when closing dialogs.
- Apply analog dead zones and controlled repeat timing so a single movement does not skip several items.
- Ensure sliders, toggles, tabs, scrolling instructions, pause menus, restart flows, and confirmation dialogs work with a controller.

### Gameplay input

- Define the controller mapping for each game before implementing its mechanics.
- Make movement and actions responsive, with suitable dead zones and sensitivity. Avoid accidental repeated activation of discrete actions.
- Detect controller connection and disconnection, including connection after the game has loaded. Handle reconnection without requiring a reload.
- Pause active gameplay when the controlling gamepad disconnects and provide a clear recovery path.
- Support switching between controller, keyboard, and pointer without resetting progress or duplicating actions. Update input prompts to match the active input method.
- For multiplayer games, define controller assignment and joining explicitly. For single-player games, identify which controller owns gameplay input.
- Treat vibration as optional enhancement when supported, with a setting to disable it. Core feedback must work without it.

## Instructions

Every title includes an Instructions screen accessible from the title screen and pause menu.

- Explain the objective, core rules, win and loss conditions, and any essential tips in concise language.
- Include a clear **Xbox controller diagram** with callouts for the game's actual actions. Show sticks, D-pad, face buttons, shoulders, triggers, and Menu/View buttons where relevant.
- Pair the diagram with a readable text mapping for accessibility and small screens. Keep labels accurate and avoid decorative controller art that misrepresents controls.
- Include keyboard and pointer mappings where supported.
- Allow the player to read, scroll, and dismiss instructions entirely with a controller.
- Keep instructions synchronized with implemented controls and any remapping options.

## Settings and pause

- Provide controller-operable settings appropriate to the game, including audio controls and relevant motion, sensitivity, and vibration options.
- Persist preferences locally where available, and recover gracefully if storage is unavailable.
- Include a pause menu with Resume, Instructions, Settings, Restart, and Return to Title as appropriate.
- Pause gameplay simulation and timers while paused; settings and instructions opened during play must preserve the paused state.
- Handle window focus loss and tab visibility changes without unfairly continuing active gameplay.
- Protect substantial progress from accidental restart or return-to-title actions with an appropriate confirmation.

## Visual, audio, and accessibility standards

- Establish a deliberate visual language for each game: palette, typography, composition, lighting, UI treatment, animation, and effects.
- Use generated assets consistently. Inspect logo lettering, transparency, scaling, and composition before accepting an asset.
- Optimize assets for web delivery and record their prompts or generation notes when useful for future revisions.
- Give important actions immediate visual feedback and suitable audio feedback. Respect audio preferences and browser playback restrictions.
- Mute all sound while the tab is hidden or the window loses focus, and restore it on return (unless the player muted it).
- Keep essential text legible, controls comfortably sized, and state changes understandable without relying only on color, sound, or vibration.
- Respect reduced-motion preferences and avoid unnecessary flashing or intense screen shake.
- Provide semantic, accessible UI controls with keyboard focus and accessible names.
- Adapt layout and rendering to window resizing, fullscreen changes, and different display densities without stretching artwork or obscuring controls.

## Engineering and delivery standards

- Keep each game independently understandable and runnable. Share shell and input behavior where useful without forcing unrelated game mechanics into a common abstraction.
- Separate input handling, game state, rendering, audio, and UI responsibilities enough to support reliable iteration.
- Use frame-rate-independent simulation and target smooth gameplay at 60 frames per second on the agreed target devices.
- Provide intentional loading, empty, error, pause, victory, defeat, and replay states as applicable.
- Avoid uncaught errors, missing assets, broken focus paths, and unfinished placeholder behavior.
- Document how to run each game, its controls, and any known browser limitations.
- Decide the supported browser and device matrix when implementing the first game; verify controller and fullscreen behavior on those targets.

## Acceptance checklist for every game

- [ ] Generated title logo is polished, readable, and accessible.
- [ ] Press Start appears below the title and works with pointer, keyboard, and controller.
- [ ] Any fresh controller button press starts from the idle title state.
- [ ] Start requests fullscreen and enters the main game; fullscreen rejection does not block play.
- [ ] Instructions, Settings (gear), Sound (on/off) and Fullscreen icons appear at the bottom right.
- [ ] Sound goes silent when the tab is hidden or the window loses focus.
- [ ] Title utilities and all subsequent menus are fully controller accessible.
- [ ] Instructions include an accurate Xbox controller diagram and text mappings.
- [ ] Gameplay controls, pause, restart, and return-to-title flows work end to end.
- [ ] Controller disconnect, reconnect, input switching, focus loss, and held-button transitions behave correctly.
- [ ] Fullscreen changes and resizing preserve layout and game state.
- [ ] Settings persist when possible, and audio and motion preferences are respected.
- [ ] Visuals, audio, loading, and game outcome states meet the game's quality bar.
- [ ] Relevant automated checks and browser checks pass. Record actual Xbox controller testing separately from simulated input checks, including any testing that remains outstanding.

## Next step

Wait for the first game's description before choosing its mechanics, theme, title, control mapping, or generating its assets. Apply these guidelines to that title and all subsequent games in this folder.

## Walking sprites

- A walking cycle must include a legs-together **passing pose** between the two opposite contact/stride poses. Two spread-leg pictures alone produce a shuffle or slide.
- Prefer four phases: contact A → passing A → contact B → passing B. One passing pose reused between contacts is the minimum; two passing poses distinguish the support legs. A passing frame has the support leg beneath the hips while the other foot swings through, not two feet planted in an idle stance.
- Provide the cycle for every walking character and costume/look, including walking while carrying someone. Keep face, costume colours, body/head scale and the ground anchor consistent. Review the frames together or animated, not only one at a time.
- Select walking frames from travelled distance (or an explicit motion phase for scripted walks). Idle, airborne, climbing and swimming actions retain their own poses. Procedural walkers must also pass through legs-together between contacts.
