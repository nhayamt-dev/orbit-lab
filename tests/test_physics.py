import pytest

from backend.models import RocketParameters, RocketState
from backend.physics import calculate_forces, calculate_acceleration


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
    )


def test_gravity_points_downward(params):
    state = RocketState(
        time=0,
        x=0,
        y=0,
        vx=0,
        vy=0,
        mass=params.initial_mass,
    )

    forces = calculate_forces(state, params)

    assert forces.gravity_y < 0
    assert forces.gravity_x == 0


def test_drag_is_zero_at_rest(params):
    state = RocketState(
        time=0,
        x=0,
        y=0,
        vx=0,
        vy=0,
        mass=params.initial_mass,
    )

    forces = calculate_forces(state, params)

    assert forces.drag_x == 0
    assert forces.drag_y == 0


def test_drag_opposes_vertical_motion(params):
    state = RocketState(
        time=0,
        x=0,
        y=10,
        vx=0,
        vy=20,
        mass=params.initial_mass,
    )

    forces = calculate_forces(state, params)

    assert forces.drag_y < 0


def test_vertical_thrust_points_upward(params):
    state = RocketState(
        time=0,
        x=0,
        y=0,
        vx=0,
        vy=0,
        mass=params.initial_mass,
    )

    forces = calculate_forces(state, params, thrust=10)

    assert forces.thrust_y == pytest.approx(10)
    assert forces.resultant_y > 0


def test_newton_second_law(params):
    acceleration = calculate_acceleration(
        type(
            "ForcesMock",
            (),
            {
                "resultant_x": 4.0,
                "resultant_y": 10.0,
            },
        )(),
        mass=2.0,
    )

    assert acceleration == pytest.approx((2.0, 5.0))


def test_nonpositive_mass_is_rejected():
    with pytest.raises(ValueError):
        calculate_acceleration(
            type(
                "ForcesMock",
                (),
                {
                    "resultant_x": 1.0,
                    "resultant_y": 1.0,
                },
            )(),
            mass=0,
        )


def test_negative_thrust_is_rejected(params):
    state = RocketState(
        time=0,
        x=0,
        y=0,
        vx=0,
        vy=0,
        mass=params.initial_mass,
    )

    with pytest.raises(ValueError):
        calculate_forces(state, params, thrust=-1)
