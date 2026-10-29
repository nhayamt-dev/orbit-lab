import pytest

from backend.models import RocketParameters
from backend.simulation import simulate_constant_thrust


@pytest.fixture
def params():
    return RocketParameters(
        dry_mass=0.15,
        initial_liquid_mass=0.5,
        frontal_area=0.007,
        drag_coefficient=0.5,
        nozzle_area=0.0001,
        launch_angle_deg=90,
        bicarbonate_mass=0.05,
        acetic_acid_mass=0.04,
        reaction_rate=1.0,
        time_step=0.01,
        simulation_time=2.0,
    )


def test_simulation_starts_at_origin_with_initial_mass(params):
    states = simulate_constant_thrust(
        params=params,
        thrust=10.0,
        duration=1.0,
    )

    initial = states[0]

    assert initial.time == pytest.approx(0.0)
    assert initial.x == pytest.approx(0.0)
    assert initial.y == pytest.approx(0.0)
    assert initial.vx == pytest.approx(0.0)
    assert initial.vy == pytest.approx(0.0)
    assert initial.mass == pytest.approx(params.initial_mass)


def test_simulation_times_are_strictly_increasing(params):
    states = simulate_constant_thrust(
        params=params,
        thrust=10.0,
        duration=1.0,
    )

    assert all(
        current.time > previous.time
        for previous, current in zip(states, states[1:])
    )


def test_simulation_rejects_nonpositive_duration(params):
    for duration in (0.0, -1.0):
        with pytest.raises(ValueError):
            simulate_constant_thrust(params, thrust=10.0, duration=duration)


def test_simulation_rejects_negative_thrust(params):
    with pytest.raises(ValueError):
        simulate_constant_thrust(params, thrust=-1.0, duration=1.0)
