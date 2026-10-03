# Generic Vibe Coded Space Game

GVCSG is a procedural browser-based space combat simulator built with Three.js. Pilot the Valkyrie assault frigate out of the Kaltos system, engage Corsair raiders, navigate asteroid fields, warp between landmarks, and jump through gates to chart eleven star systems, each with its own star, planets, stations and belts. Federation systems are patrolled by the Helion Navy; Corsair Clan systems are lawless. Dock at stations such as Ardent Relay Station or the high-tech Helion Orbital Shipyard, where you can inspect and buy hulls (Kestrel, Corvid, Valkyrie, Mantis, Warden, Bastion, Paladin) in a 3D hangar and fit weapons and modules in the outfitter.

## Play

Open the [GitHub Pages deployment](https://kaiboyjiang.github.io/GVCSG/) in a desktop browser with WebGL enabled.

- Hold middle mouse and drag: set a heading marker; the ship turns to it and stops there (M toggles mouse flight without holding)
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
- Hold left Ctrl: lock the ship nearest the pointer
- T: lock target near the pointer / reticle
- Tab: cycle hostiles
- F: missile salvo after locking
- 1–9: select navigation destination
- Space / J: warp to the selected destination, or jump when within 3.5 km of a jump gate
- N: star map (only charted systems are shown; click a system to plot a route)
- O: collapse / expand overview
- G: dock at the nearest station
- V: cycle cameras
- Esc: pause and show controls
- H: help

## Local development

This is a build-free static site. Serve the repository root with any local HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
