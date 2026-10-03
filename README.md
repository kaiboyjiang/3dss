# Generic Vibe Coded Space Game

GVCSG is a procedural browser-based space combat simulator built with Three.js. Pilot the Valkyrie assault frigate out of the Kaltos system, engage Corsair raiders, navigate asteroid fields, warp between landmarks, and jump through gates to chart eleven star systems, each with its own star, planets, stations and belts. Federation systems are patrolled by the Helion Navy; Corsair Clan systems are lawless. Dock at stations such as Ardent Relay Station or the high-tech Helion Orbital Shipyard, where you can inspect and buy hulls (Kestrel, Corvid, Valkyrie, Mantis, Warden, Bastion, Paladin) in a 3D hangar and fit weapons and modules in the outfitter.

## Play

Open the [GitHub Pages deployment](https://kaiboyjiang.github.io/GVCSG/) in a desktop browser with WebGL enabled.

- Hold middle mouse and drag: set a heading marker; the ship turns to it and stops there (K toggles mouse flight without holding)
- The reticle compass shows the direction of the target and other ships
- Arrow Up / Down: thrust and throttle
- Arrow Left / Right: strafe
- W / S: throttle
- Q / E: roll
- A / D: strafe
- R / B: vertical thrust up / down
- Shift: afterburner
- Left mouse: fixed forward guns (auto-aim when the locked target's lead pip is near the reticle)
- Right mouse: heavy fixed guns (railgun / plasma lance)
- Turrets: engage hostiles automatically; L toggles hold fire
- Hold right Ctrl: lock the ship nearest the pointer
- T: lock target near the pointer / reticle
- Tab: cycle hostiles
- F: missile salvo after locking
- 1–9: select navigation destination
- Space: warp to the selected destination
- J: jump through a gate within 3.5 km (plays a jump cutscene); otherwise warp to the selected or next route gate and jump on arrival
- M: star map (only charted systems are shown; click a system to plot a route)
- O: collapse / expand overview
- G: dock at the nearest station (plays a docking cutscene; Space or Esc skips docking, undocking and jump cutscenes)
- V: cycle cameras
- Esc: pause and show controls
- H: help

## Saving

The game auto-saves to browser local storage whenever you are docked (on docking and after every purchase, fitting or repair). Reloading resumes from that save. If your ship is destroyed, everything — ships, fittings, credits, ammo, kills and charted systems — reverts to your last docked save. Use **New Game** on the start menu to wipe the save.

## Graphics

The start menu and pause screen have a **Graphics** preset and a **Show FPS** toggle (frame rate and current render scale, bottom-right). Both are remembered in the browser.

- **Min**: for low-end hardware. 75% render scale, no shadows or anti-aliasing, low-res sky, simpler planet shading, no cloud layers, thinner asteroid belts and dust.
- **Normal**: balance of looks and speed. Native render scale up to 1×, 4× MSAA, 1024 shadows.
- **Max**: full display resolution (up to 2×), 8× MSAA, soft 2048 shadows, 1024 sky, extra planet detail, full belts.

Render scale also adapts automatically within each preset's range to hold 60 fps.

## Local development

This is a build-free static site. Serve the repository root with any local HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
