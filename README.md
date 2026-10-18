# ORBIT LAB

Simulador de trajetoria de foguetes em Python e JavaScript.
\n[**Acessar o ORBIT LAB online**](https://orbit-lab.onrender.com/)


## Estado do projeto

Projeto experimental em desenvolvimento. O modelo atual usa empuxo constante e massa fixa.

## Executar

Ative o ambiente virtual e execute: `python -m backend.main`

Acesse o simulador online: [ORBIT LAB](https://orbit-lab.onrender.com/).

## Testes

Execute: `python -m pytest -q`

## Licenca

MIT — consulte o arquivo LICENSE.

## Parâmetros da simulação

- `thrust`: empuxo em newtons, de 0 a 1000 N.
- `duration`: duração em segundos, de 0,1 a 30 s.
- `angle`: ângulo de lançamento, de 0° a 90°.

### Valores padrão

`{"thrust": 10, "duration": 10, "angle": 90}`

### Presets de teste

- Teste 1: `{"thrust": 20, "duration": 5, "angle": 80}`
- Teste 2: `{"thrust": 5, "duration": 2, "angle": 30}`

### Limitações

O modelo atual usa empuxo constante e massa fixa. Os resultados são aproximações matemáticas, não previsões exatas de um foguete real.
