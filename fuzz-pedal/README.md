# VOLT — Germanium Fuzz Pedal

Interactive browser fuzz pedal built with the Web Audio API.

## Run

```bash
cd fuzz-pedal
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765).

## Controls

| Control | What it does |
|--------|----------------|
| **Fuzz** | Drive / asymmetric soft-clip amount |
| **Tone** | Low-pass + presence shelf |
| **Level** | Wet output gain |
| **Engage** | Footswitch bypass ↔ effect |
| **Play demo riff** | Synth power-chord riff through the pedal |
| **Use microphone** | Live input (needs permission) |
| **Load audio** | Loop a local audio file through the chain |

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
