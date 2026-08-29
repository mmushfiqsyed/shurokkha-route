"""Live thought capture from the CrewAI event bus.

A module-level listener subscribes to the singleton ``crewai_event_bus`` once
(at import time, so it is never garbage collected) and forwards every event to
whatever sink is currently set by the server. Runs are serialized by the
server, so a single sink at a time is safe.
"""

from __future__ import annotations

import threading
from typing import Any, Callable, Optional

from crewai.events import (
    AgentExecutionCompletedEvent,
    AgentExecutionStartedEvent,
    AgentLogsExecutionEvent,
    BaseEventListener,
    CrewKickoffCompletedEvent,
    CrewKickoffFailedEvent,
    CrewKickoffStartedEvent,
    TaskCompletedEvent,
    TaskStartedEvent,
    ToolUsageFinishedEvent,
    ToolUsageStartedEvent,
)

Sink = Optional[Callable[[dict], None]]
_sink: Sink = None
_sink_lock = threading.Lock()

AGENT_COLORS = {
    "Hazard Analyst": "#ef4444",
    "Logistics and shelter agent": "#22c55e",
    "Routing and operations agent": "#3b82f6",
    "Response Commander": "#a855f7",
    "Advisory agent": "#f59e0b",
}


def set_sink(sink: Sink) -> None:
    """Point the listener at a per-run emitter (usually a queue.put)."""
    global _sink
    with _sink_lock:
        _sink = sink


def _emit(event: dict) -> None:
    with _sink_lock:
        sink = _sink
    if sink is not None:
        try:
            sink(event)
        except Exception:
            pass


def _role(event: Any) -> str:
    role = getattr(event, "agent_role", None)
    if role:
        return role
    agent = getattr(event, "agent", None)
    if agent is not None:
        role = getattr(agent, "role", None) or getattr(agent, "name", None)
        if role:
            return role
    return "Agent"


def _trim(value: Any, limit: int = 2000) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return value[:limit]


class ThoughtListener(BaseEventListener):
    """Forwards CrewAI lifecycle events to the active sink as dicts."""

    def setup_listeners(self, crewai_event_bus) -> None:
        @crewai_event_bus.on(CrewKickoffStartedEvent)
        def _crew_started(source, event):
            _emit({"type": "crew_start", "agent": None, "message": "Crew kickoff started"})

        @crewai_event_bus.on(AgentExecutionStartedEvent)
        def _agent_started(source, event):
            _emit({"type": "agent_start", "agent": _role(event), "message": "Starting task"})

        @crewai_event_bus.on(AgentLogsExecutionEvent)
        def _agent_logs(source, event):
            answer = getattr(event, "formatted_answer", None)
            if answer is None:
                return
            _emit(
                {
                    "type": "thought",
                    "agent": getattr(event, "agent_role", None) or "Agent",
                    "thought": getattr(answer, "thought", None),
                    "tool": getattr(answer, "tool", None),
                    "tool_input": getattr(answer, "tool_input", None),
                    "text": getattr(answer, "text", None),
                }
            )

        @crewai_event_bus.on(ToolUsageStartedEvent)
        def _tool_started(source, event):
            args = getattr(event, "tool_args", None)
            if isinstance(args, dict):
                args = ", ".join(f"{k}={v}" for k, v in list(args.items())[:6])
            _emit(
                {
                    "type": "tool_start",
                    "agent": getattr(event, "agent_role", None) or "Agent",
                    "tool": getattr(event, "tool_name", "tool"),
                    "tool_input": _trim(args, 400),
                }
            )

        @crewai_event_bus.on(ToolUsageFinishedEvent)
        def _tool_finished(source, event):
            output = getattr(event, "output", None)
            if output is not None and hasattr(output, "raw"):
                output = output.raw
            _emit(
                {
                    "type": "tool_end",
                    "agent": getattr(event, "agent_role", None) or "Agent",
                    "tool": getattr(event, "tool_name", "tool"),
                    "output": _trim(output, 1200),
                }
            )

        @crewai_event_bus.on(TaskStartedEvent)
        def _task_started(source, event):
            task = getattr(event, "task", None)
            name = getattr(task, "name", None) or getattr(task, "description", None) or ""
            _emit({"type": "info", "agent": "Crew", "message": f"Task started: {name}"})

        @crewai_event_bus.on(TaskCompletedEvent)
        def _task_completed(source, event):
            task = getattr(event, "task", None)
            name = getattr(task, "name", None) or getattr(task, "description", None) or ""
            _emit({"type": "info", "agent": "Crew", "message": f"Task completed: {name}"})

        @crewai_event_bus.on(AgentExecutionCompletedEvent)
        def _agent_completed(source, event):
            output = getattr(event, "output", None)
            if output is not None and hasattr(output, "raw"):
                output = output.raw
            _emit(
                {
                    "type": "agent_end",
                    "agent": _role(event),
                    "output": _trim(output, 2000),
                }
            )

        @crewai_event_bus.on(CrewKickoffCompletedEvent)
        def _crew_completed(source, event):
            _emit({"type": "crew_end", "agent": None, "message": "Crew run completed"})

        @crewai_event_bus.on(CrewKickoffFailedEvent)
        def _crew_failed(source, event):
            error = getattr(event, "error", None) or "Crew run failed"
            _emit({"type": "error", "agent": None, "message": _trim(error, 800)})


# Keep a reference so the listener is never garbage collected.
THOUGHT_LISTENER = ThoughtListener()
