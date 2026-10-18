from math import cos, sin, radians, hypot

from .models import RocketParameters, RocketState, Forces
from .atmosphere import air_density, gravity_at_altitude


def calculate_forces(
    state: RocketState,
    params: RocketParameters,
    thrust: float = 0.0,
) -> Forces:
    """
    Calcula as forças sobre o foguete em 2D.
    O empuxo é um valor de entrada do modelo matemático,
    não uma previsão da propulsão química real.
    """
    if thrust < 0:
        raise ValueError("O empuxo não pode ser negativo.")

    angle = radians(params.launch_angle_deg)

    thrust_x = thrust * cos(angle)
    thrust_y = thrust * sin(angle)

    speed = hypot(state.vx, state.vy)
    rho = air_density(state.y, params)

    drag_factor = -0.5 * rho * params.drag_coefficient * params.frontal_area * speed

    drag_x = drag_factor * state.vx
    drag_y = drag_factor * state.vy

    g = gravity_at_altitude(state.y, params)

    gravity_x = 0.0
    gravity_y = -state.mass * g

    resultant_x = thrust_x + drag_x + gravity_x
    resultant_y = thrust_y + drag_y + gravity_y

    return Forces(
        thrust_x=thrust_x,
        thrust_y=thrust_y,
        drag_x=drag_x,
        drag_y=drag_y,
        gravity_x=gravity_x,
        gravity_y=gravity_y,
        resultant_x=resultant_x,
        resultant_y=resultant_y,
    )


def calculate_acceleration(
    forces: Forces,
    mass: float,
) -> tuple[float, float]:
    """Calcula ax e ay pela segunda lei de Newton."""
    if mass <= 0:
        raise ValueError("A massa deve ser positiva.")

    return (
        forces.resultant_x / mass,
        forces.resultant_y / mass,
    )
