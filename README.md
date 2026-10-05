# Generic Vibe Coded Space Game

GVCSG is a procedural browser-based space combat simulator built with Three.js. Pilot the Valkyrie assault frigate out of the Kaltos system, engage Corsair raiders, navigate asteroid fields, warp between landmarks, and jump through gates to chart thirty star systems, each with its own star, planets, moons, stations and belts. Land at planetary city spaceports, domed colonies, mining outposts and cloud-city aerostats, or dock at orbital stations and habitats. Federation systems are patrolled by the Helion Navy; Corsair Clan systems are lawless, and their pirate havens and black-market stations only let you land after a bribe — they also sell Clan hulls (Raider, Cutlass, Reaver, Marauder, Ravager). The Vanta Combine, a megacorporation, owns seven systems outright: its towers and company towns are guarded by Combine Security in cheap, mass-produced hulls (Unit-7, Enforcer, Compliance) that leave you alone, and its job boards sometimes offer a quiet contract to destroy a harmless merchant carrying stolen trade secrets. Dock at stations such as Ardent Relay Station or the high-tech Helion Orbital Shipyard, where you can inspect and buy hulls in a 3D hangar (scouts, fighters, freighters, a passenger liner and warships from the Kestrel interceptor up to the Leviathan superheavy dreadnought) and fit weapons and modules in the outfitter.

## Play

Open the [GitHub Pages deployment](https://kaiboyjiang.github.io/GVCSG/) in a desktop browser with WebGL enabled.

- Hold middle mouse and drag: set a heading marker; the ship turns to it and stops there (N toggles mouse flight without holding)
- The reticle compass shows the direction of the target and other ships
- I / K or Arrow Up / Down: thrust and throttle
- J / L or Arrow Left / Right: strafe
- W / S: throttle
- Q / E: roll
- A / D: strafe
- R / B: vertical thrust up / down
- Shift: afterburner
- Left mouse or U: fixed forward guns (auto-aim when the locked target's lead pip is near the reticle)
- Right mouse or O: heavy fixed guns (railgun / plasma lance)
- Turrets: engage hostiles automatically; Y toggles hold fire
- Hold right Ctrl: lock the ship nearest the pointer
- T: lock target near the pointer / reticle
- Tab: cycle hostiles
- ; or F: missile salvo after locking
- 1–9: select navigation destination
- Space: warp to the selected destination
- H: jump through a gate within 3.5 km (plays a jump cutscene); otherwise warp to the selected or next route gate and jump on arrival
- M: star map (only charted systems are shown; click a system to plot a route)
- P: collapse / expand overview
- F1: help
- G: dock or land at the nearest port (at a pirate port the first G shows the bribe, the second pays it; plays a docking cutscene; Space or Esc skips docking, undocking and jump cutscenes)
- V: cycle cameras
- Esc: pause and show controls
- H: help

## Saving

Every port has a job board: freight and passenger contracts to other ports (freighters like the Mule and Atlas have big cargo holds, the Aurora liner has 160 bunks, and cargo pods or passenger modules add space), sometimes at high risk of Clan hijackers who will board you and steal the load if your shields drop, plus bounties on Clan warlords flying Reavers and Ravager battleships. Accepted jobs mark their destination on the star map and have a jump deadline.

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
