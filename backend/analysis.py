from math import hypot

from .models import RocketParameters, RocketState
from .physics import calculate_forces, calculate_acceleration


def analyze_trajectory(
    states: list[RocketState],
    params: RocketParameters,
    thrust: float = 0.0,
) -> dict:
    """Extrai métricas físicas e séries temporais da trajetória."""

    if not states:
        raise ValueError("A lista de estados não pode estar vazia.")

    times = []
    altitudes = []
    horizontal_positions = []
    speeds = []
    accelerations = []
    kinetic_energies = []
    potential_energies = []
    thrust_values = []
    drag_values = []
    gravity_values = []
    resultant_values = []

    for state in states:
        forces = calculate_forces(state, params, thrust)
        ax, ay = calculate_acceleration(forces, state.mass)

        speed = hypot(state.vx, state.vy)
        acceleration = hypot(ax, ay)

        kinetic_energy = 0.5 * state.mass * speed**2
        potential_energy = (
            state.mass
            * params.g0
            * params.earth_radius
            * state.y
            / (params.earth_radius + max(state.y, 0.0))
        )

        times.append(state.time)
        altitudes.append(state.y)
        horizontal_positions.append(state.x)
        speeds.append(speed)
        accelerations.append(acceleration)
        kinetic_energies.append(kinetic_energy)
        potential_energies.append(potential_energy)
        thrust_values.append(forces.thrust)
        drag_values.append(forces.drag)
        gravity_values.append(forces.gravity)
        resultant_values.append(forces.resultant)

    max_altitude_index = max(
        range(len(altitudes)),
        key=altitudes.__getitem__,
    )
    max_speed_index = max(
        range(len(speeds)),
        key=speeds.__getitem__,
    )

    return {
        "time_s": times,
        "altitude_m": altitudes,
        "horizontal_position_m": horizontal_positions,
        "speed_m_s": speeds,
        "acceleration_m_s2": accelerations,
        "kinetic_energy_j": kinetic_energies,
        "potential_energy_j": potential_energies,
        "thrust_n": thrust_values,
        "drag_n": drag_values,
        "weight_n": gravity_values,
        "resultant_force_n": resultant_values,
        "max_altitude_m": altitudes[max_altitude_index],
        "time_at_max_altitude_s": times[max_altitude_index],
        "max_speed_m_s": speeds[max_speed_index],
        "time_at_max_speed_s": times[max_speed_index],
        "final_altitude_m": altitudes[-1],
        "final_speed_m_s": speeds[-1],
    }
