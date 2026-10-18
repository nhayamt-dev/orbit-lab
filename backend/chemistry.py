from __future__ import annotations

from dataclasses import dataclass
from math import exp, isclose

from .models import ChemicalState, LimitingReagent


# Massas molares em kg/mol
MOLAR_MASS_NAHCO3 = 0.0840066
MOLAR_MASS_ACETIC_ACID = 0.060052
MOLAR_MASS_CO2 = 0.0440095

# Tolerância relativa para considerar mols "iguais" (estequiométrico)
STOICHIOMETRIC_REL_TOL = 1e-9


@dataclass(frozen=True, slots=True)
class ReactionSetup:
    """Grandezas químicas constantes, calculadas uma única vez."""

    initial_bicarbonate_moles: float
    initial_acetic_acid_moles: float
    limiting_reagent: LimitingReagent
    max_co2_moles: float          # ξ_max
    reaction_rate: float          # k, 1/s


def mass_to_moles(mass: float, molar_mass: float) -> float:
    """Converte massa em kg para quantidade de matéria em mol."""
    if mass < 0:
        raise ValueError("A massa não pode ser negativa.")
    if molar_mass <= 0:
        raise ValueError("A massa molar deve ser positiva.")
    return mass / molar_mass


def calculate_initial_moles(
    bicarbonate_mass: float,
    acetic_acid_mass: float,
) -> tuple[float, float]:
    """Calcula os mols iniciais dos dois reagentes."""
    return (
        mass_to_moles(bicarbonate_mass, MOLAR_MASS_NAHCO3),
        mass_to_moles(acetic_acid_mass, MOLAR_MASS_ACETIC_ACID),
    )


def determine_limiting_reagent(
    bicarbonate_moles: float,
    acetic_acid_moles: float,
) -> LimitingReagent:
    """Determina o reagente limitante pela estequiometria 1:1."""
    if isclose(
        bicarbonate_moles,
        acetic_acid_moles,
        rel_tol=STOICHIOMETRIC_REL_TOL,
        abs_tol=0.0,
    ):
        return LimitingReagent.STOICHIOMETRIC

    if bicarbonate_moles < acetic_acid_moles:
        return LimitingReagent.BICARBONATE

    return LimitingReagent.ACETIC_ACID


def build_reaction_setup(
    bicarbonate_mass: float,
    acetic_acid_mass: float,
    reaction_rate: float,
) -> ReactionSetup:
    """Prepara os dados constantes da reação (chamar uma vez por simulação)."""
    if reaction_rate <= 0:
        raise ValueError("reaction_rate deve ser > 0.")

    n_bic, n_ace = calculate_initial_moles(bicarbonate_mass, acetic_acid_mass)

    return ReactionSetup(
        initial_bicarbonate_moles=n_bic,
        initial_acetic_acid_moles=n_ace,
        limiting_reagent=determine_limiting_reagent(n_bic, n_ace),
        max_co2_moles=min(n_bic, n_ace),
        reaction_rate=reaction_rate,
    )


def reaction_progress(t: float, setup: ReactionSetup) -> float:
    """
    ξ(t) = ξ_max * (1 - exp(-k t))

    k é um parâmetro fenomenológico calibrável (1/s).
    """
    if t < 0:
        raise ValueError("O tempo não pode ser negativo.")

    xi = setup.max_co2_moles * (1.0 - exp(-setup.reaction_rate * t))
    return min(max(xi, 0.0), setup.max_co2_moles)


def reaction_rate_moles_per_second(xi: float, setup: ReactionSetup) -> float:
    """dξ/dt = k (ξ_max - ξ). Útil para a vazão de gás e dm/dt."""
    return setup.reaction_rate * max(setup.max_co2_moles - xi, 0.0)


def build_chemical_state(t: float, setup: ReactionSetup) -> ChemicalState:
    """Estado químico completo no instante t (mols RESTANTES)."""
    xi = reaction_progress(t, setup)

    return ChemicalState(
        bicarbonate_moles=max(setup.initial_bicarbonate_moles - xi, 0.0),
        acetic_acid_moles=max(setup.initial_acetic_acid_moles - xi, 0.0),
        limiting_reagent=setup.limiting_reagent,
        max_co2_moles=setup.max_co2_moles,
        xi_moles=xi,
        co2_mass=xi * MOLAR_MASS_CO2,
    )