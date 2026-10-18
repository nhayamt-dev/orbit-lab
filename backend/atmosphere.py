from math import exp

from .models import RocketParameters


def air_density(altitude: float, params: RocketParameters) -> float:
    """Calcula a densidade aproximada do ar em kg/m³."""
    altitude = max(altitude, 0.0)
    return params.rho0 * exp(-altitude / params.scale_height)


def gravity_at_altitude(
    altitude: float,
    params: RocketParameters,
) -> float:
    """Calcula a gravidade em função da altitude, em m/s²."""
    altitude = max(altitude, 0.0)
    return params.g0 * (
        params.earth_radius / (params.earth_radius + altitude)
    ) ** 2
