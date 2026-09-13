/*
 * VOLT — germanium-style fuzz as an LV2 plugin (C).
 *
 * URI: https://github.com/CaptainParanoid/Clean-Desktop#volt-fuzz
 */

#include "volt_dsp.h"

#include <lv2/core/lv2.h>

#include <stdlib.h>
#include <string.h>

#define VOLT_URI "https://github.com/CaptainParanoid/Clean-Desktop#volt-fuzz"

typedef enum {
  PORT_AUDIO_IN = 0,
  PORT_AUDIO_OUT = 1,
  PORT_FUZZ = 2,
  PORT_TONE = 3,
  PORT_LEVEL = 4,
  PORT_BYPASS = 5 /* 0 = engaged, 1 = bypass (LV2 convention-friendly) */
} PortIndex;

typedef struct {
  const float *audio_in;
  float *audio_out;
  const float *fuzz;
  const float *tone;
  const float *level;
  const float *bypass;

  VoltFuzz dsp;
  float last_fuzz;
  float last_tone;
  float last_level;
  float last_bypass;
} VoltPlugin;

static LV2_Handle instantiate(const LV2_Descriptor *descriptor,
                              double rate,
                              const char *bundle_path,
                              const LV2_Feature *const *features) {
  (void)descriptor;
  (void)bundle_path;
  (void)features;

  VoltPlugin *self = (VoltPlugin *)calloc(1, sizeof(VoltPlugin));
  if (!self) {
    return NULL;
  }

  volt_fuzz_init(&self->dsp, rate);
  self->last_fuzz = -1.f;
  self->last_tone = -1.f;
  self->last_level = -1.f;
  self->last_bypass = -1.f;
  return (LV2_Handle)self;
}

static void connect_port(LV2_Handle instance, uint32_t port, void *data) {
  VoltPlugin *self = (VoltPlugin *)instance;
  switch ((PortIndex)port) {
    case PORT_AUDIO_IN:
      self->audio_in = (const float *)data;
      break;
    case PORT_AUDIO_OUT:
      self->audio_out = (float *)data;
      break;
    case PORT_FUZZ:
      self->fuzz = (const float *)data;
      break;
    case PORT_TONE:
      self->tone = (const float *)data;
      break;
    case PORT_LEVEL:
      self->level = (const float *)data;
      break;
    case PORT_BYPASS:
      self->bypass = (const float *)data;
      break;
  }
}

static void activate(LV2_Handle instance) {
  VoltPlugin *self = (VoltPlugin *)instance;
  /* Re-init filter memory on activate. */
  double sr = self->dsp.sample_rate;
  float fuzz = self->dsp.fuzz;
  float tone = self->dsp.tone;
  float level = self->dsp.level;
  int engaged = self->dsp.engaged;
  volt_fuzz_init(&self->dsp, sr);
  volt_fuzz_set_fuzz(&self->dsp, fuzz);
  volt_fuzz_set_tone(&self->dsp, tone);
  volt_fuzz_set_level(&self->dsp, level);
  volt_fuzz_set_engaged(&self->dsp, engaged);
}

static void run(LV2_Handle instance, uint32_t n_samples) {
  VoltPlugin *self = (VoltPlugin *)instance;

  if (!self->audio_in || !self->audio_out) {
    return;
  }

  float fuzz = self->fuzz ? *self->fuzz : 72.f;
  float tone = self->tone ? *self->tone : 48.f;
  float level = self->level ? *self->level : 55.f;
  float bypass = self->bypass ? *self->bypass : 0.f;

  if (fuzz != self->last_fuzz) {
    volt_fuzz_set_fuzz(&self->dsp, fuzz / 100.f);
    self->last_fuzz = fuzz;
  }
  if (tone != self->last_tone) {
    volt_fuzz_set_tone(&self->dsp, tone / 100.f);
    self->last_tone = tone;
  }
  if (level != self->last_level) {
    volt_fuzz_set_level(&self->dsp, level / 100.f);
    self->last_level = level;
  }
  if (bypass != self->last_bypass) {
    /* bypass port: 0 = effect on, 1 = bypass */
    volt_fuzz_set_engaged(&self->dsp, bypass < 0.5f);
    self->last_bypass = bypass;
  }

  volt_fuzz_process(&self->dsp, self->audio_in, self->audio_out, n_samples);
}

static void deactivate(LV2_Handle instance) {
  (void)instance;
}

static void cleanup(LV2_Handle instance) {
  free(instance);
}

static const void *extension_data(const char *uri) {
  (void)uri;
  return NULL;
}

static const LV2_Descriptor descriptor = {
  VOLT_URI,
  instantiate,
  connect_port,
  activate,
  run,
  deactivate,
  cleanup,
  extension_data
};

LV2_SYMBOL_EXPORT
const LV2_Descriptor *lv2_descriptor(uint32_t index) {
  return index == 0 ? &descriptor : NULL;
}
