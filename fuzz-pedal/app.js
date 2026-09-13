import { VoltFuzz } from "./fuzz.js";

const pedal = new VoltFuzz();

const fuzzInput = document.getElementById("fuzz");
const toneInput = document.getElementById("tone");
const levelInput = document.getElementById("level");
const engageBtn = document.getElementById("engageBtn");
const demoBtn = document.getElementById("demoBtn");
const micBtn = document.getElementById("micBtn");
const fileInput = document.getElementById("fileInput");
const inputDevice = document.getElementById("inputDevice");
const statusLed = document.getElementById("statusLed");
const statusLabel = document.getElementById("statusLabel");
const hint = document.getElementById("hint");

let liveInputOn = false;

function setHint(text, isError = false) {
  hint.textContent = text;
  hint.classList.toggle("is-error", isError);
}

function syncKnob(input) {
  const value = Number(input.value);
  const el = input.closest(".knob");
  const pointer = el.querySelector(".knob-pointer");
  const readout = document.querySelector(`.knob-value[data-for="${input.id}"]`);
  const deg = -140 + (value / 100) * 280;
  pointer.style.transform = `rotate(${deg}deg)`;
  if (readout) readout.textContent = String(value);
}

function applyControl(input) {
  const v = Number(input.value) / 100;
  if (input.id === "fuzz") pedal.setFuzz(v);
  if (input.id === "tone") pedal.setTone(v);
  if (input.id === "level") pedal.setLevel(v);
  syncKnob(input);
}

function setEngaged(on) {
  pedal.setEngaged(on);
  engageBtn.setAttribute("aria-pressed", String(on));
  statusLed.dataset.on = String(on);
  statusLabel.textContent = on ? "active" : "bypass";
  engageBtn.querySelector(".footswitch-label").textContent = on
    ? "engaged"
    : "engage";
}

async function bootAudio() {
  await pedal.ensureContext();
}

function selectedDeviceId() {
  return inputDevice.value || undefined;
}

async function refreshInputDevices(preferredId) {
  const devices = await pedal.listAudioInputs();
  const previous = preferredId ?? inputDevice.value;
  inputDevice.innerHTML = "";

  const fallback = document.createElement("option");
  fallback.value = "";
  fallback.textContent = devices.length
    ? "Default system input"
    : "Click Enable to grant mic access…";
  inputDevice.appendChild(fallback);

  for (const device of devices) {
    const opt = document.createElement("option");
    opt.value = device.deviceId;
    opt.textContent = device.label || `Input ${device.deviceId.slice(0, 8)}`;
    inputDevice.appendChild(opt);
  }

  if (previous && [...inputDevice.options].some((o) => o.value === previous)) {
    inputDevice.value = previous;
  } else {
    // Prefer anything that looks like an interface over FaceTime/built-in mics.
    const ranked = devices.find((d) => {
      const label = (d.label || "").toLowerCase();
      return (
        label &&
        !label.includes("facetime") &&
        !label.includes("built-in") &&
        !label.includes("macbook")
      );
    });
    if (ranked) inputDevice.value = ranked.deviceId;
  }
}

async function enableGuitarInput() {
  await bootAudio();
  if (engageBtn.getAttribute("aria-pressed") !== "true") {
    setEngaged(true);
  }

  const stream = await pedal.useMicrophone(selectedDeviceId());
  liveInputOn = true;
  micBtn.setAttribute("aria-pressed", "true");
  micBtn.textContent = "Guitar input on";

  await refreshInputDevices(selectedDeviceId());

  const track = stream.getAudioTracks()[0];
  const label = track?.label || "selected input";
  setHint(
    `Listening on “${label}”. Play your guitar — headphones/monitors on the interface are ideal.`
  );
}

for (const input of [fuzzInput, toneInput, levelInput]) {
  applyControl(input);
  input.addEventListener("input", () => applyControl(input));

  const face = input.closest(".knob").querySelector(".knob-face");
  let dragging = false;
  let startY = 0;
  let startVal = 0;

  const onMove = (clientY) => {
    if (!dragging) return;
    const delta = startY - clientY;
    const next = Math.max(0, Math.min(100, startVal + delta * 0.45));
    input.value = String(Math.round(next));
    applyControl(input);
  };

  face.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    startVal = Number(input.value);
    face.setPointerCapture(e.pointerId);
  });
  face.addEventListener("pointermove", (e) => onMove(e.clientY));
  face.addEventListener("pointerup", () => {
    dragging = false;
  });
  face.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

engageBtn.addEventListener("click", async () => {
  try {
    await bootAudio();
    const next = engageBtn.getAttribute("aria-pressed") !== "true";
    setEngaged(next);
    if (next) {
      setHint("Pedal engaged. Pick your interface, then Enable guitar input.");
    } else {
      setHint("Bypassed — clean signal path.");
    }
  } catch (err) {
    setHint(`Could not start audio: ${err.message}`, true);
  }
});

demoBtn.addEventListener("click", async () => {
  if (demoBtn.disabled) return;
  try {
    liveInputOn = false;
    micBtn.setAttribute("aria-pressed", "false");
    micBtn.textContent = "Enable guitar input";
    await bootAudio();
    if (engageBtn.getAttribute("aria-pressed") !== "true") {
      setEngaged(true);
    }
    demoBtn.disabled = true;
    demoBtn.setAttribute("aria-pressed", "true");
    demoBtn.textContent = "Playing…";
    setHint("Demo riff running through VOLT fuzz.");
    const ms = await pedal.playDemoRiff();
    setTimeout(() => {
      demoBtn.disabled = false;
      demoBtn.setAttribute("aria-pressed", "false");
      demoBtn.textContent = "Play demo riff";
      setHint("Demo finished. Tweak knobs and run it again.");
    }, ms + 50);
  } catch (err) {
    demoBtn.disabled = false;
    demoBtn.setAttribute("aria-pressed", "false");
    setHint(`Demo failed: ${err.message}`, true);
    demoBtn.textContent = "Play demo riff";
  }
});

micBtn.addEventListener("click", async () => {
  try {
    await enableGuitarInput();
  } catch (err) {
    liveInputOn = false;
    micBtn.setAttribute("aria-pressed", "false");
    micBtn.textContent = "Enable guitar input";
    setHint(
      `Input unavailable (${err.message}). In the browser site settings, allow Microphone and choose your audio interface.`,
      true
    );
  }
});

inputDevice.addEventListener("change", async () => {
  if (!liveInputOn) return;
  try {
    await enableGuitarInput();
  } catch (err) {
    setHint(`Could not switch input: ${err.message}`, true);
  }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    liveInputOn = false;
    micBtn.setAttribute("aria-pressed", "false");
    micBtn.textContent = "Enable guitar input";
    await bootAudio();
    if (engageBtn.getAttribute("aria-pressed") !== "true") {
      setEngaged(true);
    }
    await pedal.loadFile(file);
    setHint(`Looping “${file.name}” through the fuzz.`);
  } catch (err) {
    setHint(`Could not load audio: ${err.message}`, true);
  }
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    refreshInputDevices(selectedDeviceId()).catch(() => {});
  });
}

refreshInputDevices().catch(() => {});
