from math import isclose

from backend.chemistry import (
    MOLAR_MASS_ACETIC_ACID,
    MOLAR_MASS_CO2,
    MOLAR_MASS_NAHCO3,
    build_chemical_state,
    build_reaction_setup,
    reaction_progress,
    reaction_rate_moles_per_second,
)
from backend.models import LimitingReagent


def test_stoichiometric_mixture():
    setup = build_reaction_setup(
        bicarbonate_mass=MOLAR_MASS_NAHCO3,
        acetic_acid_mass=MOLAR_MASS_ACETIC_ACID,
        reaction_rate=1.0,
    )

    assert setup.limiting_reagent == LimitingReagent.STOICHIOMETRIC
    assert isclose(
        setup.max_co2_moles,
        1.0,
        rel_tol=1e-9,
    )


def test_limiting_bicarbonate():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.120104,
        reaction_rate=1.0,
    )

    assert setup.limiting_reagent == LimitingReagent.BICARBONATE


def test_limiting_acetic_acid():
    setup = build_reaction_setup(
        bicarbonate_mass=0.1680132,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    assert setup.limiting_reagent == LimitingReagent.ACETIC_ACID


def test_reaction_starts_at_zero():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    xi = reaction_progress(0.0, setup)

    assert isclose(
        xi,
        0.0,
        abs_tol=1e-12,
    )


def test_reaction_progress_increases():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    xi_1 = reaction_progress(1.0, setup)
    xi_2 = reaction_progress(2.0, setup)

    assert xi_2 > xi_1


def test_reaction_never_exceeds_maximum():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    xi = reaction_progress(1000.0, setup)

    assert xi <= setup.max_co2_moles


def test_reagents_are_consumed():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    state = build_chemical_state(
        t=1.0,
        setup=setup,
    )

    assert state.bicarbonate_moles < setup.initial_bicarbonate_moles
    assert state.acetic_acid_moles < setup.initial_acetic_acid_moles


def test_stoichiometric_conservation():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    state = build_chemical_state(
        t=1.0,
        setup=setup,
    )

    assert isclose(
        state.bicarbonate_moles + state.xi_moles,
        setup.initial_bicarbonate_moles,
        rel_tol=1e-9,
    )

    assert isclose(
        state.acetic_acid_moles + state.xi_moles,
        setup.initial_acetic_acid_moles,
        rel_tol=1e-9,
    )


def test_co2_mass():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    state = build_chemical_state(
        t=1.0,
        setup=setup,
    )

    expected_mass = (
        state.xi_moles * MOLAR_MASS_CO2
    )

    assert isclose(
        state.co2_mass,
        expected_mass,
        rel_tol=1e-12,
    )


def test_reaction_rate():
    setup = build_reaction_setup(
        bicarbonate_mass=0.0840066,
        acetic_acid_mass=0.060052,
        reaction_rate=1.0,
    )

    xi = reaction_progress(
        t=1.0,
        setup=setup,
    )

    rate = reaction_rate_moles_per_second(
        xi=xi,
        setup=setup,
    )

    expected = setup.reaction_rate * (
        setup.max_co2_moles - xi
    )

    assert isclose(
        rate,
        expected,
        rel_tol=1e-12,
    )
