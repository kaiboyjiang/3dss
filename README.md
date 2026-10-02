# Kaltos 0.4 — 3D Space Simulator

A procedural browser-based space combat simulator built with Three.js. Pilot the Valkyrie assault frigate through the Kaltos system, engage Corsair raiders, navigate asteroid fields, warp between landmarks, and dock at Ardent Relay Station.

## Play

Open the [GitHub Pages deployment](https://kaiboyjiang.github.io/3dss/) in a desktop browser with WebGL enabled.

- Mouse: pitch and yaw
- W / S: throttle
- Q / E: roll
- A / D: strafe
- R / F: vertical thrust
- Shift: afterburner
- Left mouse: pulse lasers
- Right mouse: railgun
- T: lock selected target
- Tab: cycle hostiles
- F: missile salvo after locking
- 1–6: select navigation destination
- J: engage warp
- G: dock near Ardent Relay Station
- V: cycle cameras
- H: help

## Local development

This is a build-free static site. Serve the repository root with any local HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
