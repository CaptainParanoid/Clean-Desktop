# VOLT — Germanium Fuzz Pedal

Interactive browser fuzz pedal built with the Web Audio API.

## Run

```bash
cd fuzz-pedal
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765).

## Guitar + audio interface (browser)

Browsers treat your interface as a **microphone**. The built-in MacBook mic is often the default — pick the interface explicitly.

1. Guitar → interface input (set gain so the interface meter moves, no clip)
2. Headphones / monitors on the interface (turn **direct monitoring off** or you’ll hear dry + wet)
3. Serve the page and open it in **Chrome** (best getUserMedia support):
   ```bash
   cd fuzz-pedal && python3 -m http.server 8765
   ```
   Open http://localhost:8765
4. When prompted, **Allow** microphone access
5. In the **Guitar / interface input** dropdown, choose your interface (e.g. Scarlett, Zoom, Apollo) — not “MacBook Pro Microphone” / FaceTime
6. Click **Enable guitar input**, then **Engage**, then play

If the dropdown only shows the laptop mic:
- Chrome → site padlock → Site settings → Microphone → allow, and select the interface there too
- macOS **System Settings → Sound → Input** → select the interface
- Unplug/replug the interface, then refresh the page

Expect some latency — this is a browser demo, not a replacement for the LV2 plugin in a DAW.


## Stack

- Vanilla HTML / CSS / ES modules
- WaveShaper fuzz with asymmetric germanium-style transfer curve
- No build step

## Native LV2 plugin (C)

Same fuzz model as a real DAW plugin — see [`plugin/`](plugin/):

```bash
cd plugin
make && make install   # → ~/.lv2/volt-fuzz.lv2
make test              # offline DSP smoke test
```
