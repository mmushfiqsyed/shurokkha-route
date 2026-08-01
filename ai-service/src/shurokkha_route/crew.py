from typing import List

from crewai import LLM, Agent, Crew, Process, Task, tools
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from pydantic import BaseModel, Field


class HazardAssessment(BaseModel):
    disaster_type: str
    severity: int = Field(ge=1, le=5)
    zone: str
    secondary_risks: list[str]
    notes: str
    
class ResponseDecision(BaseModel):
    priority_action: str
    destination: str
    reasoning: str
    
    
@CrewBase
class Shurokkha_Route():
    """Surokkha Route crew"""

    agents: List[BaseAgent]
    tasks: List[Task]


    @agent
    def hazard_agent(self) -> Agent:
        return Agent(config=self.agents_config['hazard_agent'], verbose=True)

    @agent
    def commander(self) -> Agent:
        return Agent(config=self.agents_config['commander'], verbose=True)
    @agent
    def advisory_agent(self) -> Agent:
        return Agent(config=self.agents_config['advisory_agent'], verbose=True)
        

    @task
    def hazard_assessment_task(self) -> Task:
        return Task(config = self.tasks_config['hazard_assessment_task'], output_pydantic=HazardAssessment)
    @task
    def commander_task(self) -> Task:
        return Task(config = self.tasks_config['commander_task'], output_pydantic=ResponseDecision)

    @task
    def advisory_task(self) -> Task:
        return Task(config = self.tasks_config['advisory_task'])

    @crew
    def crew(self) -> Crew:
        """Creates the shurokkha_route crew"""

        return Crew(
            agents=self.agents,
            tasks=[self.hazard_assessment_task(), self.commander_task(), self.advisory_task()],
            process=Process.sequential,
            verbose=True,
        )