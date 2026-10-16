# Mangaluru ➔ Surathkal Coastal Corridor (NH-66)

The primary testbed corridor for Karavali-Transit connects central Mangaluru to NITK Surathkal across a high-density 10.5 km coastal transit artery.

---

## 1. Waypoint GPS Coordinates

| Sequence | Stop Name | Latitude | Longitude | Typical Traffic Density |
| :--- | :--- | :--- | :--- | :--- |
| **01 (Origin)** | Mangaluru Statebank Terminal | `12.8718` | `74.8430` | High (Central Interchange) |
| **02** | Hampankatta Circle | `12.8850` | `74.8450` | High (Commercial Hub) |
| **03** | Lalbagh (Mangalore City Corp) | `12.8970` | `74.8480` | Moderate |
| **04** | Nanthoor Junction | `12.8997` | `74.8530` | Congested (NH-66 / NH-75 junction) |
| **05** | Kuloor Bridge | `12.9271` | `74.8415` | Fast-moving |
| **06** | Baikampady Industrial Area | `12.9350` | `74.8210` | Moderate |
| **07 (Terminus)** | Surathkal Bus Stand / NITK | `12.9472` | `74.7963` | Terminal Interchange |

---

## 2. Delay & Speed Classification Engine

- **High Speed (`>= 35 km/h`)**: Free flow. Green indicator, ETA accuracy ±1 min.
- **Moderate Speed (`20 - 34 km/h`)**: Normal urban coastal traffic. Green indicator, 0–2 min delay.
- **Heavy Congestion (`< 20 km/h`)**: Bottleneck detected (e.g. Nanthoor flyover diversion). Amber/Red indicator, automatically adds dynamic delay compensation:
  $$\text{Delay}_{\text{calc}} = \left\lceil \frac{d_{\text{remaining}}}{v_{\text{current}}} - \frac{d_{\text{remaining}}}{v_{\text{expected}}} \right\rceil \text{ minutes}$$

