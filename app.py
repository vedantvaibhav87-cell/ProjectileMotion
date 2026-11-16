from __future__ import annotations

import math
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Research/reference values. Sources and interpretation are documented in README.md.
REFERENCE_DATA = [
    {
        "parameter": "Standard acceleration due to gravity",
        "value": "9.80665",
        "unit": "m/s²",
        "use": "Default g input",
        "source": "NIST Guide to the SI, Appendix B.9",
        "url": "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9",
    },
    {
        "parameter": "Earth mean surface gravity",
        "value": "9.820",
        "unit": "m/s²",
        "use": "Earth reference comparison",
        "source": "NASA NSSDCA Earth Fact Sheet",
        "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    },
    {
        "parameter": "Earth surface air density",
        "value": "1.217",
        "unit": "kg/m³",
        "use": "Default air-density input",
        "source": "NASA NSSDCA Earth Fact Sheet",
        "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    },
    {
        "parameter": "Sphere drag coefficient range",
        "value": "0.07–0.50",
        "unit": "dimensionless",
        "use": "Context for selecting a sphere Cd; it varies with flow conditions",
        "source": "NASA Glenn — Drag of a Sphere",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-of-a-sphere/",
    },
    {
        "parameter": "Bullet drag coefficient example",
        "value": "0.295",
        "unit": "dimensionless",
        "use": "Shape comparison only; not used as the default sphere value",
        "source": "NASA Glenn — Shape Effects on Drag",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/",
    },
    {
        "parameter": "Standard atmospheric pressure",
        "value": "101325",
        "unit": "Pa",
        "use": "Atmospheric reference",
        "source": "NIST Guide to the SI, Appendix B.8",
        "url": "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b8",
    },
    {
        "parameter": "Standard atmosphere",
        "value": "Reference vertical profile",
        "unit": "",
        "use": "Context for variation of atmospheric properties with altitude",
        "source": "NOAA National Weather Service Glossary",
        "url": "https://forecast.weather.gov/glossary.php?word=standard+atmosphere",
    },
]

def acceleration(state, mass, area, cd, rho, gravity, wind, include_drag):
    x, y, vx, vy = state
    if not include_drag:
        return (0.0, -gravity)

    # Relative air velocity: projectile velocity minus horizontal wind velocity.
    rel_vx = vx - wind
    rel_vy = vy
    rel_speed = math.hypot(rel_vx, rel_vy)
    if rel_speed == 0:
        return (0.0, -gravity)

    factor = 0.5 * rho * cd * area * rel_speed / mass
    return (-factor * rel_vx, -gravity - factor * rel_vy)

def derivative(state, mass, area, cd, rho, gravity, wind, include_drag):
    x, y, vx, vy = state
    ax, ay = acceleration(state, mass, area, cd, rho, gravity, wind, include_drag)
    return (vx, vy, ax, ay)

def add_scaled(a, b, scale):
    return tuple(a[i] + scale * b[i] for i in range(4))

def rk4_step(state, dt, args):
    f = lambda s: derivative(s, *args)
    k1 = f(state)
    k2 = f(add_scaled(state, k1, dt / 2))
    k3 = f(add_scaled(state, k2, dt / 2))
    k4 = f(add_scaled(state, k3, dt))
    return tuple(
        state[i] + dt * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) / 6
        for i in range(4)
    )

def simulate(params, include_drag=True):
    v0 = params["speed"]
    angle = math.radians(params["angle"])
    height = params["height"]
    mass = params["mass"]
    diameter = params["diameter"]
    cd = params["cd"]
    rho = params["rho"]
    gravity = params["gravity"]
    wind = params["wind"]
    dt = params["dt"]

    area = math.pi * (diameter / 2) ** 2
    state = (0.0, height, v0 * math.cos(angle), v0 * math.sin(angle))
    args = (mass, area, cd, rho, gravity, wind, include_drag)
    points = []
    t = 0.0
    max_steps = 200000

    for step in range(max_steps):
        points.append({
            "t": t, "x": state[0], "y": state[1],
            "vx": state[2], "vy": state[3]
        })
        if step > 0 and state[1] <= 0:
            break

        next_state = rk4_step(state, dt, args)
        if next_state[1] < 0:
            # Interpolate the final segment to y=0 to estimate impact accurately.
            fraction = state[1] / (state[1] - next_state[1])
            impact = tuple(state[i] + fraction * (next_state[i] - state[i]) for i in range(4))
            t_impact = t + fraction * dt
            points.append({
                "t": t_impact, "x": impact[0], "y": 0.0,
                "vx": impact[2], "vy": impact[3]
            })
            break

        state = next_state
        t += dt
    else:
        raise ValueError("Simulation exceeded the maximum number of steps.")

    return points

def summarize(points):
    peak = max(points, key=lambda p: p["y"])
    last = points[-1]
    return {
        "range": last["x"],
        "flight_time": last["t"],
        "max_height": peak["y"],
        "impact_speed": math.hypot(last["vx"], last["vy"]),
    }

def parse_params(data):
    params = {
        "speed": float(data.get("speed", 30)),
        "angle": float(data.get("angle", 45)),
        "height": float(data.get("height", 1.5)),
        "mass": float(data.get("mass", 0.145)),
        "diameter": float(data.get("diameter", 0.073)),
        "cd": float(data.get("cd", 0.47)),
        "rho": float(data.get("rho", 1.217)),
        "gravity": float(data.get("gravity", 9.80665)),
        "wind": float(data.get("wind", 0)),
        "dt": float(data.get("dt", 0.01)),
    }
    limits = {
        "speed": (1, 150), "angle": (1, 89), "height": (0, 100),
        "mass": (0.01, 100), "diameter": (0.005, 1),
        "cd": (0.01, 3), "rho": (0.1, 2), "gravity": (1, 30),
        "wind": (-50, 50), "dt": (0.001, 0.05),
    }
    for key, (low, high) in limits.items():
        if not math.isfinite(params[key]) or not low <= params[key] <= high:
            raise ValueError(f"{key} must be between {low} and {high}.")
    return params

@app.get("/")
def index():
    return render_template("index.html", references=REFERENCE_DATA)

@app.get("/api/references")
def references():
    return jsonify(REFERENCE_DATA)

@app.post("/api/simulate")
def simulate_api():
    try:
        params = parse_params(request.get_json(force=True) or {})
        ideal = simulate(params, include_drag=False)
        drag = simulate(params, include_drag=True)
        ideal_summary = summarize(ideal)
        drag_summary = summarize(drag)
        reduction = 0.0
        if ideal_summary["range"] > 0:
            reduction = (ideal_summary["range"] - drag_summary["range"]) / ideal_summary["range"] * 100
        return jsonify({
            "ideal": ideal,
            "drag": drag,
            "ideal_summary": ideal_summary,
            "drag_summary": drag_summary,
            "range_reduction_percent": reduction,
        })
    except (ValueError, TypeError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 400

if __name__ == "__main__":
    app.run(debug=True)
