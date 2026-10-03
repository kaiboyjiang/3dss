# Generic Vibe Coded Space Game

A procedural browser-based space combat simulator built with Three.js. Pilot the Valkyrie assault frigate through the Kaltos system, engage Corsair raiders, navigate asteroid fields, warp between landmarks, and dock at Ardent Relay Station or the high-tech Helion Orbital Shipyard, where you can inspect and buy hulls (Kestrel, Valkyrie, Warden, Paladin) in a 3D hangar and fit weapons and modules in the outfitter.

## Play

Open the [GitHub Pages deployment](https://kaiboyjiang.github.io/3dss/) in a desktop browser with WebGL enabled.

- Hold middle mouse: the ship turns towards the pointer (M toggles follow mode on)
- Pointer: turrets aim at the pointer; the reticle compass shows the direction of the target and other ships
- Arrow Up / Down: thrust and throttle
- Arrow Left / Right: strafe
- W / S: throttle
- Q / E: roll
- A / D: strafe
- R / B: vertical thrust up / down
- Shift: afterburner
- Left mouse: primary weapons
- Right mouse: secondary weapons
- Hold left Ctrl: lock the ship nearest the pointer
- T: lock target near the pointer / reticle
- Tab: cycle hostiles
- F: missile salvo after locking
- 1–7: select navigation destination
- Space / J: warp to the selected destination
- G: dock at Ardent Relay Station (1) or Helion Orbital Shipyard (7)
- V: cycle cameras
- Esc: pause and show controls
- H: help

## Local development

This is a build-free static site. Serve the repository root with any local HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
