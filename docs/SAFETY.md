# ⚠️ Safety Information & Medical Disclaimer

**PLEASE READ THIS DOCUMENT CAREFULLY BEFORE USING ATTUNELY.**

TuneSoar generates binaural beats — rhythmic audio frequencies created by playing slightly different tones in each ear. The brain perceives a "beat" at the difference frequency (e.g., 200 Hz in the left ear and 210 Hz in the right ear creates a perceived 10 Hz Alpha beat).

While many people use binaural beats without issue, **these rhythmic audio stimuli carry real physiological risks** for certain individuals. This document explains those risks and the safety measures we take to protect you.

---

## Medical Disclaimer

**TuneSoar is not a medical device.** It has not been evaluated or approved by the U.S. Food and Drug Administration (FDA), the European Medicines Agency (EMA), the Hong Kong Department of Health (HKFDA), or any other regulatory body. TuneSoar is not intended to diagnose, treat, cure, or prevent any disease, condition, or disorder.

Use of TuneSoar is **entirely at your own risk**. The developers (`Wealth Maker Masterclass Limited`) and its affiliates assume no liability for any injury, loss, or damage arising from the use of this software.

---

## ⚠️ DO NOT USE ATTUNELY IF

The following conditions **absolutely preclude** the use of binaural beats:

### Epilepsy & Seizure Disorders

- You have **epilepsy** or any **seizure disorder** (including photosensitive or audiogenic epilepsy)
- You have ever experienced **any type of seizure**, regardless of cause
- You have a **family history** of epilepsy or unexplained seizures
- You have been diagnosed with **photosensitive epilepsy** or experience discomfort from flashing lights or rhythmic patterns

Binaural beats produce rhythmic audio frequencies that may trigger seizures in susceptible individuals. The risk is particularly elevated with **Gamma frequency bands (30–40 Hz)**, which operate in a range that overlaps with known photosensitive triggers.

### Other Contraindications

- You are **pregnant** or suspect you may be pregnant (effects on fetal development are unknown)
- You have a **pacemaker**, implantable cardioverter-defibrillator (ICD), or any other implanted electronic medical device
- You have been diagnosed with a **serious psychiatric condition** (schizophrenia, bipolar disorder with psychotic features, severe dissociative disorders) without explicit approval from your treating psychiatrist
- You are **under 18 years of age** without the consent and supervision of a parent or legal guardian
- You have a history of **severe migraines** or chronic headaches triggered by auditory stimuli
- You have **tinnitus** or hyperacusis (extreme sensitivity to sound)
- You have a history of **vertigo** or balance disorders

---

## Known Side Effects

Even in healthy individuals, binaural beats may cause:

| Side Effect | Frequency | Notes |
|---|---|---|
| **Headache** | Common | Often due to excessive volume or prolonged sessions. Reduce volume and take a break. |
| **Dizziness / Vertigo** | Occasional | More common with Theta and Delta frequencies. Stop immediately and sit down. |
| **Nausea** | Occasional | May accompany dizziness. Lie down in a quiet, dark room. |
| **Anxiety / Agitation** | Rare | Some users report paradoxical anxiety, especially with Beta and Gamma frequencies. |
| **Tinnitus (ringing in ears)** | Rare | May indicate volume is too high or prolonged exposure. Discontinue use. |
| **Disorientation** | Uncommon | More common when abruptly stopping deep Theta/Delta sessions. Allow time to re-orient. |
| **Fatigue / Drowsiness** | Expected with Delta/Theta | These frequency bands are designed to induce relaxation and sleep. Do not use while driving or operating machinery. |

### If You Experience Any Side Effects:

1. **STOP IMMEDIATELY.** Remove headphones and pause playback.
2. **Move to a quiet environment.** Reduce sensory input.
3. **Sit or lie down** if dizzy or nauseous.
4. **Drink water** and rest for at least 15–20 minutes.
5. **Do not resume** until you feel completely normal.
6. **Consult a physician** if symptoms persist or recur.

---

## Emergency Warning Signs

Seek immediate medical attention (call emergency services) if you experience:

- **Convulsions or uncontrolled muscle jerking** (possible seizure)
- **Loss of consciousness or altered awareness**
- **Confusion lasting more than a few minutes**
- **Severe vertigo** preventing you from standing
- **Chest pain, irregular heartbeat, or palpitations**
- **Sudden, severe headache unlike any you've had before**

### Emergency Contacts

| Region | Number |
|---|---|
| **Hong Kong** | **999** |
| **United States / Canada** | **911** |
| **United Kingdom** | **999** |
| **European Union** | **112** |
| **Australia** | **000** |
| **Japan** | **119** |
| **Singapore** | **995** |
| **Mainland China** | **120** |

---

## How TuneSoar Protects You

We have built multiple layers of safety into the application. **No software safeguard is a substitute for your own judgment and medical advice.** That said, here is what we do:

### 1. Volume Hard Cap (25% of System Output)

TuneSoar **physically cannot exceed 25%** of your system's maximum volume. The volume slider in the UI maps 0–100% display to 0–25% of actual output. This is enforced server-side in the Rust audio engine — it cannot be bypassed by the UI or any IPC call.

- **Default volume:** 10% of system output
- **Maximum volume:** 25% of system output
- The `AudioState.volume` field is clamped to `[0.0, 0.25]` in `set_volume()`

### 2. Gamma Gate (Disabled by Default)

**Gamma frequencies (30–40 Hz) are disabled by default** in the default context mappings. While Gamma is available as a beat profile for custom mappings, no default context automatically engages it. Users must explicitly and deliberately enable Gamma.

- Gamma frequencies overlap with known photosensitive epilepsy trigger ranges
- We do not recommend Gamma for users with any history of neurological conditions

### 3. Smooth Transitions (2-Second Crossfade)

Every context change triggers a **2-second crossfade** rather than an abrupt switch. This prevents audio "shock" — sudden discontinuities in frequency or volume that could startle or disorient the listener.

The `BinauralEngine` implements `fade_in()` and `fade_out()` methods that ramp volume linearly over 2 seconds.

### 4. Auto-Pause During Calls & Music

TuneSoar **automatically pauses** binaural beat playback when it detects:

- **Meeting apps:** Zoom, Google Meet, Microsoft Teams, Skype, FaceTime, Webex, etc.
- **Music apps:** Spotify, Apple Music, Tidal, YouTube Music, VLC, etc.
- **YouTube music/ASMR content** (detected via URL keywords: `music`, `asmr`, `meditation`, `lofi`, `ambient`, etc.)

When auto-paused, the frequency is set to **0 Hz** (silent) and the UI displays "Paused for Audio."

### 5. Idle Fade-Out

If no user activity is detected for **5 continuous minutes**, TuneSoar fades out the audio. This prevents prolonged unconscious exposure and saves system resources. Playback resumes automatically when activity is detected again.

### 6. Mandatory Safety Acknowledgment

On first launch, TuneSoar presents a **mandatory safety dialog** that cannot be dismissed without explicit acknowledgment. The user must check a box confirming they:

- Understand the risks and safety guidelines
- Do not have a history of seizures
- Agree to use TuneSoar responsibly

This acknowledgment is stored persistently and the dialog will not reappear unless preferences are reset.

### 7. Sleep Mode (10 PM – 6 AM)

During late-night hours (22:00–06:00 local time), TuneSoar defaults to **Delta wave profiles (1–4 Hz, deep sleep)** with low beat frequencies (~2 Hz). This prevents accidental exposure to high-frequency Beta/Gamma beats during hours when the user is likely preparing for or entering sleep.

---

## Best Practices for Safe Use

1. **Start low, go slow.** Begin at 5–10% volume. Increase only if comfortable.
2. **Use over-ear headphones.** Earbuds at close proximity increase risk. Over-ear headphones provide safer distance and better binaural separation.
3. **Limit session duration.** We recommend sessions of 30–60 minutes with breaks in between.
4. **Do not use while driving.** Drowsiness from Delta/Theta frequencies can impair reaction time.
5. **Do not use while operating heavy machinery.** Same reason — any cognitive alteration is unsafe around machinery.
6. **Stay hydrated.** Dehydration can exacerbate headaches and dizziness.
7. **Remove headphones before sleeping.** Do not wear headphones to bed, even for sleep prep. Use speakers at low volume instead.
8. **Monitor how you feel.** Keep a mental note of which frequency bands feel beneficial vs. uncomfortable. Customize mappings accordingly.
9. **Consult your doctor** if you have ANY pre-existing medical condition, even if not listed above.

---

## Regulatory Status

| Jurisdiction | Status |
|---|---|
| United States (FDA) | Not evaluated. Not a medical device. No 510(k) clearance. |
| European Union (CE) | Not CE marked. Not a medical device under EU MDR 2017/745. |
| Hong Kong (HKFDA) | Not registered. Not a medical device under MDACS. |
| United Kingdom (MHRA) | Not registered. Not a medical device under UK MDR 2002. |
| Canada (Health Canada) | Not licensed. Not a medical device under Food and Drugs Act. |
| Australia (TGA) | Not included in ARTG. Not a therapeutic good. |

**TuneSoar is a general wellness application**, not a therapeutic or diagnostic tool. It falls under the category of "general wellness products" as defined by FDA guidance, which are low-risk products intended to promote general well-being without making medical claims.

---

## Scientific References & Resources

### Understanding Binaural Beats & Risks

| Resource | Link |
|---|---|
| Epilepsy Foundation — Music & Seizures | [https://www.epilepsy.com](https://www.epilepsy.com) |
| NHS — Hearing & Balance Disorders | [https://www.nhs.uk](https://www.nhs.uk) |
| Hong Kong Epilepsy Association | [https://www.epilepsy.org.hk](https://www.epilepsy.org.hk) |
| FDA — General Wellness Policy | [https://www.fda.gov](https://www.fda.gov) |
| WHO — Deafness & Hearing Loss | [https://www.who.int](https://www.who.int) |

### Selected Research

- Chaieb, L., Wilpert, E. C., Reber, T. P., & Fell, J. (2015). Auditory beat stimulation and its effects on cognition and mood states. *Frontiers in Psychiatry*, 6, 70.
- Garcia-Argibay, M., Santed, M. A., & Reales, J. M. (2019). Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis. *Psychological Research*, 83(2), 357–372.
- Wahbeh, H., Calabrese, C., & Zwickey, H. (2007). Binaural beat technology in humans: a pilot study to assess psychologic and physiologic effects. *Journal of Alternative and Complementary Medicine*, 13(1), 25–32.

---

## Contact

If you have safety concerns or experience adverse effects, please contact us:

- **Email:** fiverrkroft@gmail.com
- **Parent Brand:** Wealth Maker Masterclass Limited
- **Related Product:** MindGlow AI

---

*Last updated: May 2026*
*This document may be updated without notice. The latest version is always available within the TuneSoar application and at our documentation repository.*
