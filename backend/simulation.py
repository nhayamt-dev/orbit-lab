
from .models import RocketParameters, RocketState
from .physics import calculate_forces, calculate_acceleration
from .integrator import rk4_step


def state_derivative(
    time: float,
    values: list[float],
    params: RocketParameters,
    thrust: float,
) -> list[float]:
    """Calcula as derivadas de posição e velocidade em 2D."""

    if len(values) != 4:
        raise ValueError("O estado deve conter [x, y, vx, vy].")

    x, y, vx, vy = values

    state = RocketState(
        time=time,
        x=x,
        y=y,
        vx=vx,
        vy=vy,
        mass=params.initial_mass,
    )

    forces = calculate_forces(state, params, thrust=thrust)
    ax, ay = calculate_acceleration(forces, state.mass)

    return [vx, vy, ax, ay]


def simulate_constant_thrust(
    params: RocketParameters,
    thrust: float,
    duration: float,
    dt: float | None = None,
) -> list[RocketState]:
    """Simulação matemática com empuxo constante."""

    if duration <= 0:
        raise ValueError("A duração deve ser positiva.")

    if thrust < 0:
        raise ValueError("O empuxo não pode ser negativo.")

    step = params.time_step if dt is None else dt

    if step <= 0:
        raise ValueError("O passo de tempo deve ser positivo.")

    time = 0.0
    values = [0.0, 0.0, 0.0, 0.0]

    states = [
        RocketState(
            time=0.0,
            x=0.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            mass=params.initial_mass,
        )
    ]

    while time < duration:
        current_dt = min(step, duration - time)

        def derivative(t: float, y: list[float]) -> list[float]:
            return state_derivative(t, y, params, thrust)

        previous_values = values.copy()

        next_values = rk4_step(
            derivative,
            time,
            values,
            current_dt,
        )

        next_time = time + current_dt

        # Interrompe quando o objeto toca o solo durante a descida.
        if next_values[1] <= 0 and next_values[3] < 0:
            y_before = previous_values[1]
            y_after = next_values[1]

            if y_before > 0 and y_before != y_after:
                fraction = y_before / (y_before - y_after)
                impact_time = time + fraction * current_dt
                impact_x = previous_values[0] + fraction * (
                    next_values[0] - previous_values[0]
                )
                impact_vx = previous_values[2] + fraction * (
                    next_values[2] - previous_values[2]
                )
            else:
                impact_time = next_time
                impact_x = next_values[0]
                impact_vx = next_values[2]

            states.append(
                RocketState(
                    time=impact_time,
                    x=impact_x,
                    y=0.0,
                    vx=impact_vx,
                    vy=0.0,
                    mass=params.initial_mass,
                )
            )
            break

        values = next_values
        time = next_time

        states.append(
            RocketState(
                time=time,
                x=values[0],
                y=max(0.0, values[1]),
                vx=values[2],
                vy=values[3],
                mass=params.initial_mass,
            )
        )

    return states
