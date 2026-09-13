#include "volt_dsp.h"

#include <math.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static float clampf(float x, float lo, float hi) {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

static void biquad_clear(VoltBiquad *f) {
  f->z1 = 0.f;
  f->z2 = 0.f;
}

static float biquad_process(VoltBiquad *f, float x) {
  float y = f->b0 * x + f->z1;
  f->z1 = f->b1 * x - f->a1 * y + f->z2;
  f->z2 = f->b2 * x - f->a2 * y;
  return y;
}

/* Audio EQ Cookbook — highpass */
static void biquad_highpass(VoltBiquad *f, float sr, float freq, float q) {
  float w0 = 2.f * (float)M_PI * (freq / sr);
  float cosw = cosf(w0);
  float sinw = sinf(w0);
  float alpha = sinw / (2.f * q);
  float a0 = 1.f + alpha;
  f->b0 = ((1.f + cosw) * 0.5f) / a0;
  f->b1 = (-(1.f + cosw)) / a0;
  f->b2 = ((1.f + cosw) * 0.5f) / a0;
  f->a1 = (-2.f * cosw) / a0;
  f->a2 = (1.f - alpha) / a0;
}

/* Audio EQ Cookbook — lowpass */
static void biquad_lowpass(VoltBiquad *f, float sr, float freq, float q) {
  float w0 = 2.f * (float)M_PI * (freq / sr);
  float cosw = cosf(w0);
  float sinw = sinf(w0);
  float alpha = sinw / (2.f * q);
  float a0 = 1.f + alpha;
  f->b0 = ((1.f - cosw) * 0.5f) / a0;
  f->b1 = (1.f - cosw) / a0;
  f->b2 = ((1.f - cosw) * 0.5f) / a0;
  f->a1 = (-2.f * cosw) / a0;
  f->a2 = (1.f - alpha) / a0;
}

/* Audio EQ Cookbook — peaking EQ (gain in dB) */
static void biquad_peaking(VoltBiquad *f, float sr, float freq, float q, float gain_db) {
  float A = powf(10.f, gain_db / 40.f);
  float w0 = 2.f * (float)M_PI * (freq / sr);
  float cosw = cosf(w0);
  float sinw = sinf(w0);
  float alpha = sinw / (2.f * q);
  float a0 = 1.f + alpha / A;
  f->b0 = (1.f + alpha * A) / a0;
  f->b1 = (-2.f * cosw) / a0;
  f->b2 = (1.f - alpha * A) / a0;
  f->a1 = (-2.f * cosw) / a0;
  f->a2 = (1.f - alpha / A) / a0;
}

static void update_tone_filters(VoltFuzz *fx) {
  float tone = fx->tone;
  float lpf_hz = 400.f + tone * 5800.f;
  float presence_db = -2.f + tone * 8.f;
  biquad_lowpass(&fx->lpf, fx->sample_rate, lpf_hz, 0.85f);
  biquad_peaking(&fx->presence, fx->sample_rate, 2200.f, 0.9f, presence_db);
}

static void update_levels(VoltFuzz *fx) {
  float g = fx->level * fx->level * 1.35f;
  if (fx->engaged) {
    fx->wet_gain = g;
    fx->dry_gain = 0.f;
  } else {
    fx->wet_gain = 0.f;
    fx->dry_gain = 0.9f;
  }
}

/* Asymmetric soft clip — mirrors the browser VOLT curve. */
static float volt_shape(float x, float fuzz) {
  float drive = 1.f + fuzz * 48.f;
  float y;
  if (x >= 0.f) {
    y = tanhf(x * drive);
  } else {
    y = tanhf(x * drive * 0.72f) * 0.92f;
  }
  y = y + 0.08f * y * y * (y >= 0.f ? 1.f : -1.f);
  {
    float gate_thresh = 0.02f * (1.f - fuzz * 0.5f);
    float gate = (fabsf(x) < gate_thresh) ? 0.35f : 1.f;
    y *= gate;
  }
  return clampf(y, -1.f, 1.f);
}

void volt_fuzz_init(VoltFuzz *fx, double sample_rate) {
  memset(fx, 0, sizeof(*fx));
  fx->sample_rate = (float)sample_rate;
  fx->fuzz = 0.72f;
  fx->tone = 0.48f;
  fx->level = 0.55f;
  fx->engaged = 0;

  biquad_clear(&fx->hpf);
  biquad_clear(&fx->lpf);
  biquad_clear(&fx->presence);

  biquad_highpass(&fx->hpf, fx->sample_rate, 80.f, 0.7f);
  update_tone_filters(fx);
  update_levels(fx);
}

void volt_fuzz_set_fuzz(VoltFuzz *fx, float fuzz01) {
  fx->fuzz = clampf(fuzz01, 0.f, 1.f);
}

void volt_fuzz_set_tone(VoltFuzz *fx, float tone01) {
  fx->tone = clampf(tone01, 0.f, 1.f);
  update_tone_filters(fx);
}

void volt_fuzz_set_level(VoltFuzz *fx, float level01) {
  fx->level = clampf(level01, 0.f, 1.f);
  update_levels(fx);
}

void volt_fuzz_set_engaged(VoltFuzz *fx, int engaged) {
  fx->engaged = engaged ? 1 : 0;
  update_levels(fx);
}

void volt_fuzz_process(VoltFuzz *fx,
                       const float *in,
                       float *out,
                       unsigned n_samples) {
  const float input_gain = 1.4f;
  const float master = 0.85f;
  float fuzz = fx->fuzz;
  float dry_g = fx->dry_gain;
  float wet_g = fx->wet_gain;

  for (unsigned i = 0; i < n_samples; ++i) {
    float x = in[i];
    float dry = x * dry_g;

    float w = x * input_gain;
    w = biquad_process(&fx->hpf, w);
    w = volt_shape(w, fuzz);
    w = biquad_process(&fx->lpf, w);
    w = biquad_process(&fx->presence, w);
    w *= wet_g;

    out[i] = (dry + w) * master;
  }
}
