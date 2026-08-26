from typing import List
import os

from crewai import LLM, Agent, Crew, Process, Task, tools
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from pydantic import BaseModel, Field

def _resolve_llm() -> LLM:
    """Pick a model from LLM_MODEL, else a sensible default per available key."""
    model = os.environ.get("LLM_MODEL")
    if not model:
        if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
            model = "gemini/gemini-3.5-flash-lite"
        else:
            model = "openai/gpt-4o-mini"
    print(f"[LLM] Resolved model: {model}")        
    return LLM(model=model)


def _agent(config, llm=None, **kwargs):
    return Agent(config=config, llm=llm or _resolve_llm(), verbose=True, **kwargs)


class HazardAssessment(BaseModel):
    disaster_type: str
    severity: int = Field(ge=1, le=5)
    zone: str
    secondary_risks: list[str]
    notes: str
    
class CommanderDecision(BaseModel):
    priority_action: str
    destination_shelter_id: str | None
    viable_asset_id: str | None
    route_id: str | None
    alternate_considered: bool
    justification: str
    
class Advisory(BaseModel):
    steps: list[str]
    
class RoutingAssessment(BaseModel):
    selected_shelter_id: str | None
    selected_route_id: str | None
    safe_routes: list[str]
    blocked_routes: list[str]
    available_assets: list[str]
    notes: str
    
class ShelterAssessment(BaseModel):
    recommended_shelter_id: str | None
    viable_shelters: list[str]
    unavailable_shelters: list[str]
    notes: str
    
@CrewBase
class Shurokkha_Route():
    """Shurokkha Route crew"""

    agents: List[BaseAgent]
    tasks: List[Task]


    @agent
    def hazard_agent(self) -> Agent:
        return _agent(self.agents_config['hazard_agent'])
    @agent
    def routing_and_operations_agent(self) -> Agent:
        return _agent(
            self.agents_config['routing_and_operations_agent'], llm="gemini/gemini-3.5-flash"
        )
    @agent
    def logistics_and_shelter_agent(self) -> Agent:
        return _agent(self.agents_config['logistics_and_shelter_agent'])

    @agent
    def commander(self) -> Agent:
        return _agent(self.agents_config['commander'], llm = "gemini/gemini-3.5-flash")
    @agent
    def advisory_agent(self) -> Agent:
        return _agent(self.agents_config['advisory_agent'])

    @task
    def hazard_assessment_task(self) -> Task:
        return Task(config = self.tasks_config['hazard_assessment_task'], output_pydantic=HazardAssessment)
    
    @task
    def routing_and_operations_task(self) -> Task:
        return Task(config = self.tasks_config['routing_and_operations_task'], output_pydantic=RoutingAssessment)
    @task
    def logistics_and_shelter_task(self) -> Task:
        return Task(config = self.tasks_config['logistics_and_shelter_task'], output_pydantic=ShelterAssessment)
    @task
    def commander_task(self) -> Task:
        return Task(config = self.tasks_config['commander_task'], output_pydantic=CommanderDecision)

    @task
    def advisory_task(self) -> Task:
        return Task(config = self.tasks_config['advisory_task'], output_pydantic=Advisory)
    
    

    @crew
    def crew(self) -> Crew:
        """Creates the shurokkha_route crew"""

        return Crew(
            agents=self.agents,
            tasks=[
            self.hazard_assessment_task(), 
            self.logistics_and_shelter_task(), 
            self.routing_and_operations_task(),
            self.commander_task(), 
            self.advisory_task()
            ],
            process=Process.sequential,
            max_rpm=10,
            verbose=True,
            
        )