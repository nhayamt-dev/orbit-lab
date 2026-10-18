from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import Enum
from math import hypot
from typing import Any


class LimitingReagent(str, Enum):
    """Reagente limitante da reação NaHCO3 + CH3COOH (proporção 1:1)."""

    BICARBONATE = "bicarbonate"
    ACETIC_ACID = "acetic_acid"
    STOICHIOMETRIC = "stoichiometric"  # mols iguais, nenhum sobra


@dataclass(frozen=True, slots=True)
class RocketParameters:
    """
    Parâmetros físicos e químicos iniciais do foguete.
    Unidades SI: kg, m, m², s, graus.
    """

    # Massa
    dry_mass: float                 # estrutura, kg
    initial_liquid_mass: float      # solução de ácido acético, kg
    # Massa total inicial = dry_mass + initial_liquid_mass + bicarbonate_mass

    # Geometria
    frontal_area: float             # m²
    drag_coefficient: float         # adimensional
    nozzle_area: float              # m² (necessário ao modelo de empuxo)

    # Lançamento
    launch_angle_deg: float         # 0 = horizontal, 90 = vertical

    # Química
    bicarbonate_mass: float         # kg de NaHCO3
    acetic_acid_mass: float         # kg de CH3COOH PURO (não a massa do vinagre)
    reaction_rate: float            # k, 1/s (parâmetro calibrável)

    # Atmosfera e gravidade
    rho0: float = 1.225             # kg/m³ ao nível do mar
    scale_height: float = 8500.0    # H, m
    g0: float = 9.80665             # m/s²
    earth_radius: float = 6_371_000.0  # m

    # Simulação
    time_step: float = 0.001
    simulation_time: float = 30.0

    def __post_init__(self) -> None:
        positive = {
            "dry_mass": self.dry_mass,
            "frontal_area": self.frontal_area,
            "nozzle_area": self.nozzle_area,
            "reaction_rate": self.reaction_rate,
            "rho0": self.rho0,
            "scale_height": self.scale_height,
            "g0": self.g0,
            "earth_radius": self.earth_radius,
            "time_step": self.time_step,
            "simulation_time": self.simulation_time,
        }
        for name, value in positive.items():
            if value <= 0:
                raise ValueError(f"{name} deve ser > 0 (recebido {value})")

        non_negative = {
            "initial_liquid_mass": self.initial_liquid_mass,
            "bicarbonate_mass": self.bicarbonate_mass,
            "acetic_acid_mass": self.acetic_acid_mass,
            "drag_coefficient": self.drag_coefficient,
        }
        for name, value in non_negative.items():
            if value < 0:
                raise ValueError(f"{name} deve ser >= 0 (recebido {value})")

        if self.acetic_acid_mass > self.initial_liquid_mass:
            raise ValueError(
                "acetic_acid_mass não pode exceder initial_liquid_mass"
            )
        if not 0 <= self.launch_angle_deg <= 90:
            raise ValueError("launch_angle_deg deve estar entre 0 e 90")
        if self.time_step > self.simulation_time:
            raise ValueError("time_step não pode exceder simulation_time")

    @property
    def initial_mass(self) -> float:
        return self.dry_mass + self.initial_liquid_mass + self.bicarbonate_mass


@dataclass(frozen=True, slots=True)
class RocketState:
    """Estado instantâneo: s = [x, y, vx, vy, m]."""

    time: float
    x: float
    y: float
    vx: float
    vy: float
    mass: float

    @property
    def speed(self) -> float:
        return hypot(self.vx, self.vy)

    @property
    def altitude(self) -> float:
        return self.y

    def as_vector(self) -> list[float]:
        return [self.x, self.y, self.vx, self.vy, self.mass]

    @classmethod
    def from_vector(cls, time: float, v: list[float]) -> RocketState:
        return cls(time=time, x=v[0], y=v[1], vx=v[2], vy=v[3], mass=v[4])


@dataclass(frozen=True, slots=True)
class MassBreakdown:
    """Decomposição da massa total (kg)."""

    structural: float
    liquid: float
    gas_ejected: float


@dataclass(frozen=True, slots=True)
class Forces:
    """Forças (N) atuando sobre o foguete."""

    thrust_x: float
    thrust_y: float
    drag_x: float
    drag_y: float
    gravity_x: float
    gravity_y: float
    resultant_x: float
    resultant_y: float

    @property
    def thrust(self) -> float:
        return hypot(self.thrust_x, self.thrust_y)

    @property
    def drag(self) -> float:
        return hypot(self.drag_x, self.drag_y)

    @property
    def gravity(self) -> float:
        return hypot(self.gravity_x, self.gravity_y)

    @property
    def resultant(self) -> float:
        return hypot(self.resultant_x, self.resultant_y)


@dataclass(frozen=True, slots=True)
class Acceleration:
    """Aceleração instantânea (m/s²)."""

    ax: float
    ay: float

    @property
    def magnitude(self) -> float:
        return hypot(self.ax, self.ay)


@dataclass(frozen=True, slots=True)
class Energy:
    """Energias mecânicas instantâneas (J)."""

    kinetic: float
    potential: float

    @property
    def mechanical(self) -> float:
        return self.kinetic + self.potential


@dataclass(frozen=True, slots=True)
class ChemicalState:
    """Estado químico da reação (mol)."""

    bicarbonate_moles: float
    acetic_acid_moles: float
    limiting_reagent: LimitingReagent

    max_co2_moles: float      # ξ_max = min(n_NaHCO3, n_CH3COOH)
    xi_moles: float           # ξ(t); n_CO2(t) = ξ(t)
    co2_mass: float           # kg de gás gerado

    @property
    def co2_moles(self) -> float:
        return self.xi_moles

    @property
    def reaction_progress(self) -> float:
        """Fração concluída da reação, 0 a 1 (ξ / ξ_max)."""
        if self.max_co2_moles <= 0:
            return 0.0
        return min(self.xi_moles / self.max_co2_moles, 1.0)


@dataclass(frozen=True, slots=True)
class TelemetryPoint:
    """Registro completo de um instante da simulação."""

    state: RocketState
    forces: Forces
    acceleration: Acceleration
    energy: Energy
    chemistry: ChemicalState
    mass_breakdown: MassBreakdown

    air_density: float   # kg/m³, ρ(h)
    gravity: float       # m/s², g(h)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["chemistry"]["limiting_reagent"] = self.chemistry.limiting_reagent.value
        data["velocity_magnitude"] = self.state.speed
        data["acceleration_magnitude"] = self.acceleration.magnitude
        data["forces_magnitude"] = {
            "thrust": self.forces.thrust,
            "drag": self.forces.drag,
            "gravity": self.forces.gravity,
            "resultant": self.forces.resultant,
        }
        data["energy"]["mechanical"] = self.energy.mechanical
        data["chemistry"]["co2_moles"] = self.chemistry.co2_moles
        data["chemistry"]["reaction_progress"] = self.chemistry.reaction_progress
        return data