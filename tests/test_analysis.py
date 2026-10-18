import pytest

from backend.models import RocketParameters
from backend.simulation import simulate_constant_thrust
from backend.analysis import analyze_trajectory


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
    )


@pytest.fixture
def trajectory(params):
    return simulate_constant_thrust(
        params,
        thrust=10.0,
        duration=2.0,
    )


def test_analysis_has_all_time_points(params, trajectory):
    result = analyze_trajectory(trajectory, params, thrust=10.0)

    assert len(result["time_s"]) == len(trajectory)
    assert len(result["altitude_m"]) == len(trajectory)
    assert len(result["speed_m_s"]) == len(trajectory)


def test_maximum_altitude_is_consistent(params, trajectory):
    result = analyze_trajectory(trajectory, params, thrust=10.0)

    assert result["max_altitude_m"] == pytest.approx(
        max(state.y for state in trajectory)
    )


def test_final_speed_is_consistent(params, trajectory):
    result = analyze_trajectory(trajectory, params, thrust=10.0)

    assert result["final_speed_m_s"] == pytest.approx(
        trajectory[-1].speed
    )


def test_energy_values_are_nonnegative(params, trajectory):
    result = analyze_trajectory(trajectory, params, thrust=10.0)

    assert all(value >= 0 for value in result["kinetic_energy_j"])
    assert all(value >= 0 for value in result["potential_energy_j"])


def test_empty_trajectory_is_rejected(params):
    with pytest.raises(ValueError):
        analyze_trajectory([], params)
