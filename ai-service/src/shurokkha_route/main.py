#!/usr/bin/env python
import io
import sys
import warnings

from datetime import datetime
from pathlib import Path

from shurokkha_route.crew import Shurokkha_Route

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


def kickoff():
    inputs = {
        "scenario": "A flash flood is occurring in Sylhet, Bangladesh. Water is rising at 30 cm/hr and several local roads are already flooded. The nearest shelter is 2 km away.",
        "user_context": "the user is with an elderly family member with limited mobility. They have access to a car."
    }

    result = Shurokkha_Route().crew().kickoff(inputs=inputs)
    save_run_log(inputs, result)


def train():
    inputs = {
        "scenario": "A flash flood is occurring in Sylhet, Bangladesh. Water is rising at 30 cm/hr and several local roads are already flooded. The nearest shelter is 2 km away. The affected person is caring for an elderly family member with limited mobility. Electricity is still active in the area, and the person has access to a car but cannot safely carry the family member without assistance.",
        "user_context": "elderly family member, limited mobility"
    }
    Shurokkha_Route().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

def save_run_log(inputs,result):
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m_%d_%H-%M-%S")
    log_file = logs_dir/f"run_log_{timestamp}.txt"
    
    with io.open(log_file, "w", encoding="utf-8") as f:
        f.write("=" * 60 +"\n")
        f.write("Crew Run Log Surokkha Route\n")
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
    inputs = {
        "scenario": "A flash flood is occurring in Sylhet, Bangladesh. Water is rising at 30 cm/hr and several local roads are already flooded. The nearest shelter is 2 km away. The affected person is caring for an elderly family member with limited mobility. Electricity is still active in the area, and the person has access to a car but cannot safely carry the family member without assistance.",
        "user_context": "elderly family member, limited mobility"
    }

    Shurokkha_Route().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)
