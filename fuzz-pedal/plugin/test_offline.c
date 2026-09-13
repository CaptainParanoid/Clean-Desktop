/*
 * Offline smoke test for VOLT DSP — generates a short tone, runs fuzz,
 * writes a tiny mono WAV, and checks energy/NaN.
 */
#include "volt_dsp.h"

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static void write_wav(const char *path, const float *samples, unsigned n, unsigned sr) {
  FILE *f = fopen(path, "wb");
  if (!f) {
    perror(path);
    exit(1);
  }
  uint32_t data_bytes = n * 2;
  uint32_t riff_size = 36 + data_bytes;
  uint16_t audio_format = 1;
  uint16_t channels = 1;
  uint32_t byte_rate = sr * channels * 2;
  uint16_t block_align = channels * 2;
  uint16_t bits = 16;
  fwrite("RIFF", 1, 4, f);
  fwrite(&riff_size, 4, 1, f);
  fwrite("WAVEfmt ", 1, 8, f);
  uint32_t fmt_size = 16;
  fwrite(&fmt_size, 4, 1, f);
  fwrite(&audio_format, 2, 1, f);
  fwrite(&channels, 2, 1, f);
  fwrite(&sr, 4, 1, f);
  fwrite(&byte_rate, 4, 1, f);
  fwrite(&block_align, 2, 1, f);
  fwrite(&bits, 2, 1, f);
  fwrite("data", 1, 4, f);
  fwrite(&data_bytes, 4, 1, f);
  for (unsigned i = 0; i < n; ++i) {
    float x = samples[i];
    if (x > 1.f) x = 1.f;
    if (x < -1.f) x = -1.f;
    int16_t s = (int16_t)lrintf(x * 32767.f);
    fwrite(&s, 2, 1, f);
  }
  fclose(f);
}

int main(void) {
  const unsigned sr = 48000;
  const unsigned n = sr; /* 1 second */
  float *in = calloc(n, sizeof(float));
  float *out = calloc(n, sizeof(float));
  if (!in || !out) {
    fprintf(stderr, "alloc failed\n");
    return 1;
  }

  for (unsigned i = 0; i < n; ++i) {
    double t = (double)i / (double)sr;
    /* Rough power-chord-ish stack: E2 + B2 */
    in[i] = (float)(0.35 * sin(2.0 * M_PI * 82.41 * t) +
                    0.25 * sin(2.0 * M_PI * 123.47 * t));
  }

  VoltFuzz fx;
  volt_fuzz_init(&fx, sr);
  volt_fuzz_set_fuzz(&fx, 0.85f);
  volt_fuzz_set_tone(&fx, 0.55f);
  volt_fuzz_set_level(&fx, 0.6f);
  volt_fuzz_set_engaged(&fx, 1);
  volt_fuzz_process(&fx, in, out, n);

  double energy = 0.0;
  unsigned nan_count = 0;
  float peak = 0.f;
  for (unsigned i = 0; i < n; ++i) {
    if (!isfinite(out[i])) {
      ++nan_count;
      continue;
    }
    float a = fabsf(out[i]);
    if (a > peak) peak = a;
    energy += (double)out[i] * (double)out[i];
  }

  const char *wav = "/tmp/volt_fuzz_offline.wav";
  write_wav(wav, out, n, sr);

  printf("samples=%u peak=%.4f energy=%.4f nan=%u wav=%s\n",
         n, peak, energy, nan_count, wav);

  free(in);
  free(out);

  if (nan_count) {
    fprintf(stderr, "FAIL: NaN/Inf in output\n");
    return 1;
  }
  if (peak < 0.01f || energy < 1.0) {
    fprintf(stderr, "FAIL: output too quiet (effect may be dead)\n");
    return 1;
  }
  if (peak > 2.0f) {
    fprintf(stderr, "FAIL: output absurdly hot\n");
    return 1;
  }
  puts("PASS");
  return 0;
}
