# Do I Mog or Dog

Landmark-based facial geometry analyzer. Upload or capture a frontal and a 90° profile photo, place 24 frontal + 15 profile landmarks with a 2.5× loupe, and get 18 morphometric measurements, critical-failo gates, and a PSL score (Gaussian, μ 5.0, σ 1.0).

Everything runs in the browser and photos stay on the device (saved in localStorage).

## Run

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Opening `index.html` directly also works, but the camera needs `localhost` or https.

## Single-file build

```bash
python3 build.py
```

This writes `dist/do-i-mog-or-dog.html`, a single file with all CSS and JS inlined that you can open or share on its own. Re-run it after editing anything in `css/` or `js/`.

## Layout

| File | Purpose |
| --- | --- |
| `js/landmarks.js` | Landmark definitions, template seeds, guide connections |
| `js/metrics.js` | Metric formulas and target bands (`BANDS`): edit thresholds here |
| `js/scoring.js` | Composite z → score, hard caps, tiers, radar axes |
| `js/editor.js` | Canvas landmark editor (drag, zoom, pinch, loupe, keyboard nudge) |
| `js/capture.js` | Upload normalization, camera modal, alignment guide overlays |
| `js/results.js` | Scan animation, odometer reveal, radar, bell curve, tables |
| `js/demo.js` | Synthetic demo subject |
| `js/app.js` | State, navigation, persistence, calibration protocol |

## Notes

- The mentolabial angle needs a lip–chin crease point, so the profile set has one extra node (`Profile_Mentolabial_Sulcus`).
- Frontal metrics are roll-corrected using the interpupillary axis. Profile angles use the image horizontal as the Frankfurt plane, so the head must be level when the photo is taken.
- Critical gates: canthal tilt < −1°, FWHR outside 1.68–2.18, midface < 0.90, philtrum:chin < 1:1.6, gonial > 135°, facial convexity < 155°.
