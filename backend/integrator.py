from collections.abc import Callable
from math import isfinite


Vector = list[float]
Derivative = Callable[[float, Vector], Vector]


def rk4_step(
    derivative: Derivative,
    time: float,
    state: Vector,
    dt: float,
) -> Vector:
    """Executa um passo RK4 com validação das entradas e derivadas."""

    if not isfinite(time):
        raise ValueError("O tempo deve ser finito.")

    if not isfinite(dt) or dt <= 0:
        raise ValueError("dt deve ser positivo e finito.")

    if not state:
        raise ValueError("O estado não pode ser vazio.")

    if not all(isfinite(value) for value in state):
        raise ValueError("O estado deve conter apenas valores finitos.")

    def evaluate(t: float, values: Vector) -> Vector:
        slopes = derivative(t, values)

        if len(slopes) != len(state):
            raise ValueError(
                "A dimensão da derivada deve corresponder à dimensão do estado."
            )

        if not all(isfinite(value) for value in slopes):
            raise ValueError("A derivada deve conter apenas valores finitos.")

        return slopes

    k1 = evaluate(time, state)

    state2 = [
        value + dt * slope / 2
        for value, slope in zip(state, k1)
    ]
    k2 = evaluate(time + dt / 2, state2)

    state3 = [
        value + dt * slope / 2
        for value, slope in zip(state, k2)
    ]
    k3 = evaluate(time + dt / 2, state3)

    state4 = [
        value + dt * slope
        for value, slope in zip(state, k3)
    ]
    k4 = evaluate(time + dt, state4)

    result = [
        value + dt * (
            s1 + 2 * s2 + 2 * s3 + s4
        ) / 6
        for value, s1, s2, s3, s4 in zip(
            state, k1, k2, k3, k4
        )
    ]

    if not all(isfinite(value) for value in result):
        raise ValueError("O resultado do RK4 contém valores não finitos.")

    return result
