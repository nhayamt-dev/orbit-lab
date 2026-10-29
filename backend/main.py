
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import os
import sys

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"

sys.path.insert(0, str(ROOT))

from backend.models import RocketParameters
from backend.simulation import simulate_constant_thrust
from backend.analysis import analyze_trajectory
from backend.chemistry import build_reaction_setup, build_chemical_state


class RocketHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def do_POST(self):
        if self.path != "/api/simulate":
            self.send_error(404, "Endpoint não encontrado")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 100_000:
                self.send_error(400, "Corpo da requisição inválido")
                return

            payload = json.loads(self.rfile.read(length))

            thrust = float(payload.get("thrust", 10))
            duration = float(payload.get("duration", 10))
            angle = float(payload.get("angle", 90))

            if not all(map(lambda n: n == n and abs(n) != float("inf"),
                           [thrust, duration, angle])):
                raise ValueError("Os valores precisam ser números finitos.")

            if not 0 <= thrust <= 1000:
                raise ValueError("Empuxo fora do intervalo permitido.")
            if not 0.1 <= duration <= 30:
                raise ValueError("Duração deve estar entre 0,1 e 30 segundos.")
            if not 0 <= angle <= 90:
                raise ValueError("Ângulo deve estar entre 0 e 90 graus.")

            params = RocketParameters(
                dry_mass=1.0,
                initial_liquid_mass=0.5,
                frontal_area=0.01,
                drag_coefficient=0.47,
                nozzle_area=0.0001,
                launch_angle_deg=angle,
                bicarbonate_mass=0.05,
                acetic_acid_mass=0.1,
                reaction_rate=1.0,
                time_step=0.05,
                simulation_time=duration,
            )

            states = simulate_constant_thrust(
                params=params,
                thrust=thrust,
                duration=duration,
                dt=0.05,
            )

            analysis = analyze_trajectory(states, params, thrust)
            reaction_setup = build_reaction_setup(
                params.bicarbonate_mass,
                params.acetic_acid_mass,
                params.reaction_rate,
            )
            chemistry = [
                {
                    "time": float(state.time),
                    "bicarbonate_moles": chemical.bicarbonate_moles,
                    "acetic_acid_moles": chemical.acetic_acid_moles,
                    "limiting_reagent": chemical.limiting_reagent.value,
                    "co2_moles": chemical.co2_moles,
                    "co2_mass": chemical.co2_mass,
                    "reaction_progress": chemical.reaction_progress,
                }
                for state in states
                for chemical in [build_chemical_state(state.time, reaction_setup)]
            ]

            result = {
                "states": [
                    {
                        "time": float(s.time),
                        "x": float(s.x),
                        "y": float(s.y),
                        "vx": float(s.vx),
                        "vy": float(s.vy),
                        "speed": float(s.speed),
                    }
                    for s in states
                ],
                "analysis": analysis,
                "chemistry": chemistry,
                "parameters": {
                    "thrust": thrust,
                    "duration": duration,
                    "angle": angle,
                },
            }

            body = json.dumps(result, allow_nan=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            body = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        except Exception as exc:
            print(f"Erro na simulação: {exc}", file=sys.stderr)
            body = json.dumps(
                {"error": "Falha interna ao executar a simulação."}
            ).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), RocketHandler)
    print(f"ORBIT LAB disponível na porta {port}")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
