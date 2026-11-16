# Projectile Lab — Projectile Motion Simulator

An open-source, research-informed projectile motion simulator built with **HTML, CSS, JavaScript and Python (Flask)**. The browser provides the interface and charts; Python performs the numerical physics calculations.

## Features

- Compare ideal projectile motion (no aerodynamic drag) with quadratic air resistance.
- Interactive controls for initial speed, launch angle, height, mass, diameter, drag coefficient, air density, gravity and horizontal wind.
- Live trajectory chart with Chart.js.
- Range, flight time, maximum height, impact speed and percentage range reduction.
- Export the drag-model time series as CSV.
- Research data table with official NASA, NIST and NOAA references.
- Responsive dark interface.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Charts | Chart.js (CDN) |
| Backend | Python 3, Flask |
| Numerical method | Fourth-order Runge–Kutta (RK4) |
| API | Flask JSON endpoint |

## Run locally

1. Install Python 3.10 or newer.
2. Clone or download this repository.
3. Open a terminal in the project directory.
4. Create and activate a virtual environment (recommended):

   **Windows**
   ```bash
   py -m venv .venv
   .venv\Scripts\activate
   ```

   **macOS / Linux**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

5. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
6. Start Flask:
   ```bash
   python app.py
   ```
7. Visit **http://127.0.0.1:5000**.

## Project structure

```text
projectile-motion-github/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── LICENSE
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

## API

### `POST /api/simulate`

Example JSON body:

```json
{
  "speed": 30,
  "angle": 45,
  "height": 1.5,
  "mass": 0.145,
  "diameter": 0.073,
  "cd": 0.47,
  "rho": 1.217,
  "gravity": 9.80665,
  "wind": 0,
  "dt": 0.01
}
```

Returns the ideal and drag trajectories, summary metrics, and range reduction percentage.

### `GET /api/references`

Returns the reference dataset and source links as JSON.

## Mathematical model

For a projectile with frontal area `A = π(d/2)²`, quadratic drag magnitude is:

`D = ½ ρ Cd A |v_rel|²`

The relative air velocity is the projectile velocity minus the wind velocity. Drag acceleration is opposite to that relative velocity:

`a_drag = -(ρ Cd A / (2m)) |v_rel| v_rel`

Gravity acts vertically downward. The state vector `[x, y, vx, vy]` is integrated with fourth-order Runge–Kutta (RK4). The simulation terminates at ground contact; the last segment is interpolated to `y = 0`.

The ideal model uses the same initial conditions but sets aerodynamic drag to zero.

## Research dataset and official references

The following are official reference facts/parameters used for model configuration and scientific context. They are not a dataset of measured projectile flights.

| Parameter | Value | How it is used |
|---|---:|---|
| Standard acceleration due to gravity | 9.80665 m/s² | Default gravity |
| Earth mean surface gravity | 9.820 m/s² | Earth reference comparison |
| Earth surface air density | 1.217 kg/m³ | Default air density |
| Sphere drag coefficient range | 0.07–0.50 | Context for sphere Cd |
| Bullet drag coefficient example | 0.295 | Shape comparison only |
| Standard atmospheric pressure | 101,325 Pa | Atmospheric reference |
| Standard atmosphere | Reference vertical profile | Context for atmospheric variation |

Sources:
1. **NIST — Guide to the SI, Appendix B.9 (standard acceleration of gravity):**  
   https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9
2. **NASA NSSDCA — Earth Fact Sheet (mean gravity and surface atmospheric density):**  
   https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
3. **NASA Glenn — Drag of a Sphere (sphere drag coefficient and flow dependence):**  
   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-of-a-sphere/
4. **NASA Glenn — Shape Effects on Drag (shape-dependent drag examples):**  
   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/
5. **NIST — Guide to the SI, Appendix B.8 (standard atmosphere pressure):**  
   https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b8
6. **NOAA National Weather Service — Standard atmosphere glossary:**  
   https://forecast.weather.gov/glossary.php?word=standard+atmosphere

### Research integrity and limitations

- Default `g = 9.80665 m/s²` is the NIST standard acceleration due to gravity.
- Default `rho = 1.217 kg/m³` is taken from the NASA Earth fact sheet.
- Default `Cd = 0.47` is an illustrative constant sphere assumption within the NASA-reported sphere range; it is not a universal value.
- The bullet coefficient example is listed for comparison only and is not used in the sphere simulation.
- The model holds air density and Cd constant during one trajectory. Real Cd varies with Reynolds number and flow conditions; air density also varies with altitude and weather.
- Spin/Magnus lift, vertical wind, changing atmospheric profiles, terrain and three-dimensional effects are omitted.
- This is a numerical model, not an experimentally validated predictor. For a research report, conduct a safe classroom-scale experiment and compare measured range/time with model output.

## Suggested experiments

1. Change the launch angle while holding all other inputs fixed; find the angle that gives the largest range in each model.
2. Increase speed and compare the ideal and drag ranges.
3. Increase mass while keeping size fixed; observe the effect of area-to-mass ratio.
4. Compare a headwind, still air and tailwind.
5. Change the time step in the backend and discuss numerical convergence.

## Push to GitHub

1. Create a new empty repository on GitHub (for example, `projectile-motion-simulator`).
2. In the project folder, run:

   ```bash
   git init
   git add .
   git commit -m "Build research-based projectile motion simulator"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/projectile-motion-simulator.git
   git push -u origin main
   ```

3. Replace `YOUR-USERNAME` with your GitHub username.

Do not commit your virtual environment, API secrets or local machine files. `.gitignore` is included.

## Deployment note

This is a Flask application, so GitHub Pages alone cannot run the Python backend. Use a Python-capable host (for example, Render or Railway) for a live deployed version. GitHub is used to host the source repository.
