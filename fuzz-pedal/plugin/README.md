# VOLT Fuzz — LV2 plugin (C)

Native LV2 fuzz pedal that mirrors the browser VOLT DSP:
asymmetric soft-clip, high-pass pre-filter, tone low-pass, presence shelf,
and dry/wet bypass.

## Build

```bash
cd fuzz-pedal/plugin
make
make install   # installs to ~/.lv2/volt-fuzz.lv2
```

Requires `lv2-dev` (`pkg-config --exists lv2`).

## Ports

| Port   | Type    | Range   | Notes                          |
|--------|---------|---------|--------------------------------|
| in     | audio   | —       | Mono input                     |
| out    | audio   | —       | Mono output                    |
| fuzz   | control | 0–100   | Drive / clip amount            |
| tone   | control | 0–100   | Darkness → openness            |
| level  | control | 0–100   | Wet output                     |
| bypass | control | 0 / 1   | `0` = engaged, `1` = bypassed  |

URI: `https://github.com/CaptainParanoid/Clean-Desktop#volt-fuzz`

## Test offline DSP

```bash
make test
```

Writes `/tmp/volt_fuzz_offline.wav` and checks for NaNs / silence.

## Use in a host

After `make install`, load **VOLT Fuzz** in any LV2 host (Carla, Reaper +
LINVST/Yabridge bridges where available, Ardour, PipeWire filter chains, etc.).

```bash
lv2ls | grep volt
```
