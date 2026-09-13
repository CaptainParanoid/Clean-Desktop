#ifndef VOLT_DSP_H
#define VOLT_DSP_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  float b0, b1, b2, a1, a2;
  float z1, z2;
} VoltBiquad;

typedef struct {
  float sample_rate;

  float fuzz;   /* 0..1 */
  float tone;   /* 0..1 */
  float level;  /* 0..1 */
  int engaged;  /* 0 = bypass, 1 = effect */

  VoltBiquad hpf;
  VoltBiquad lpf;
  VoltBiquad presence;

  float dry_gain;
  float wet_gain;
} VoltFuzz;

void volt_fuzz_init(VoltFuzz *fx, double sample_rate);
void volt_fuzz_set_fuzz(VoltFuzz *fx, float fuzz01);
void volt_fuzz_set_tone(VoltFuzz *fx, float tone01);
void volt_fuzz_set_level(VoltFuzz *fx, float level01);
void volt_fuzz_set_engaged(VoltFuzz *fx, int engaged);

/* Process interleaved mono buffers in-place or out-of-place. */
void volt_fuzz_process(VoltFuzz *fx,
                       const float *in,
                       float *out,
                       unsigned n_samples);

#ifdef __cplusplus
}
#endif

#endif /* VOLT_DSP_H */
