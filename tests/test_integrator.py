import math

import pytest

from backend.integrator import rk4_step


def test_rk4_exponential_growth():
    # dy/dt = y; solução exata: y(t + dt) = y(t) * exp(dt)
    result = rk4_step(
        derivative=lambda t, state: [state[0]],
        time=0.0,
        state=[1.0],
        dt=0.1,
    )

    assert result[0] == pytest.approx(math.exp(0.1), abs=1e-6)


def test_rk4_constant_derivative():
    result = rk4_step(
        derivative=lambda t, state: [2.0, -3.0],
        time=1.0,
        state=[0.0, 10.0],
        dt=0.5,
    )

    assert result == pytest.approx([1.0, 8.5])


@pytest.mark.parametrize("dt", [0.0, -0.1])
def test_rk4_rejects_nonpositive_time_step(dt):
    with pytest.raises(ValueError):
        rk4_step(
            derivative=lambda t, state: [1.0],
            time=0.0,
            state=[0.0],
            dt=dt,
        )


def test_rk4_rejects_derivative_with_wrong_dimension():
    def derivative(t, state):
        return [1.0, 2.0]

    with pytest.raises(ValueError, match="dimens"):
        rk4_step(derivative, 0.0, [0.0], 0.1)


@pytest.mark.parametrize("dt", [math.nan, math.inf, -math.inf])
def test_rk4_rejects_nonfinite_time_step(dt):
    with pytest.raises(ValueError):
        rk4_step(
            derivative=lambda t, state: [1.0],
            time=0.0,
            state=[0.0],
            dt=dt,
        )
