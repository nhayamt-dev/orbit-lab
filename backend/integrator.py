from collections.abc import Callable


Vector = list[float]
Derivative = Callable[[float, Vector], Vector]


def rk4_step(
    derivative: Derivative,
    time: float,
    state: Vector,
    dt: float,
) -> Vector:
    """Executa um passo do método Runge-Kutta de quarta ordem."""

    if dt <= 0:
        raise ValueError("dt deve ser positivo.")

    k1 = derivative(time, state)

    state2 = [
        value + dt * slope / 2
        for value, slope in zip(state, k1)
    ]
    k2 = derivative(time + dt / 2, state2)

    state3 = [
        value + dt * slope / 2
        for value, slope in zip(state, k2)
    ]
    k3 = derivative(time + dt / 2, state3)

    state4 = [
        value + dt * slope
        for value, slope in zip(state, k3)
    ]
    k4 = derivative(time + dt, state4)

    return [
        value + dt * (
            s1 + 2 * s2 + 2 * s3 + s4
        ) / 6
        for value, s1, s2, s3, s4 in zip(
            state, k1, k2, k3, k4
        )
    ]
