#!/usr/bin/env python
import io
import sys
import warnings
import json
from datetime import datetime
from pathlib import Path

from shurokkha_route.crew import Shurokkha_Route

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

base = Path(__file__).resolve().parent.parent.parent.parent

shelters = json.loads(
    (base / "src/data/shelters.json").read_text()
)

routes = json.loads(
    (base / "src/data/routes.json").read_text()
)

assets = json.loads(
    (base / "src/data/assets.json").read_text()
)
TEST_SCENARIO = {
    "scenario": {
        "disaster_type": "Flood",
        "location": "Sylhet",
        "description": "Water rising at 30cm/hr"
    },
    "user_context": {
        "location": {"lat": 24.898, "lng": 91.875},
        "people": 2,
        "mobility": "limited"
    },
    "system_state": {
        "shelters": shelters,
        "routes": routes,
        "assets": assets
    }
}
def kickoff():
    inputs = TEST_SCENARIO

    result = Shurokkha_Route().crew().kickoff(inputs=inputs)
    save_run_log(inputs, result)


def train():
    inputs = TEST_SCENARIO
    Shurokkha_Route().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

def save_run_log(inputs,result):
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m_%d_%H-%M-%S")
    log_file = logs_dir/f"run_log_{timestamp}.txt"
    
    with io.open(log_file, "w", encoding="utf-8") as f:
        f.write("=" * 60 +"\n")
        f.write("Crew Run Log Shurokkha Route\n")
        f.write(f"Time: {datetime.now()}\n")
        f.write("=" *60 + "\n\n")
        
        f.write("Inputs:\n")
        f.write("=" * 60 +"\n")
        for key,value in inputs.items():
            f.write(f"{key}:\n{value}\n\n")
            
        f.write("=" * 60 +"\n")
        f.write("Result:\n")
        f.write("=" * 60 +"\n")
        for task_output in result.tasks_output:
            f.write(f"\nTASK: {task_output.name}\n")
            f.write("-" * 60 + "\n")

            if task_output.pydantic:
                f.write(task_output.pydantic.model_dump_json(indent=2))
            else:
                f.write(str(task_output.raw))

            f.write("\n")
        
    print(f"\nRun log saved to:, {log_file}")

        
    
def replay():
    Shurokkha_Route().crew().replay(task_id=sys.argv[1])

def test():
    inputs = TEST_SCENARIO

    Shurokkha_Route().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)
