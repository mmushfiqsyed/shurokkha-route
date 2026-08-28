# {{crew_name}} Crew

Welcome to the {{crew_name}} Crew project, powered by [crewAI](https://crewai.com). This template is designed to help you set up a multi-agent AI system with ease, leveraging the powerful and flexible framework provided by crewAI. Our goal is to enable your agents to collaborate effectively on complex tasks, maximizing their collective intelligence and capabilities.

## Installation

Ensure you have Python >=3.10 <3.14 installed on your system. This project uses [UV](https://docs.astral.sh/uv/) for dependency management and package handling, offering a seamless setup and execution experience.

First, if you haven't already, install uv:

```bash
pip install uv
```

Next, navigate to the `ai-service` directory and install the dependencies:

```bash
uv sync
```

Create a `.env` file in this directory and add your LLM key:

```dotenv
GEMINI_API_KEY=your_key_here
```

### Customizing

**Add your `OPENAI_API_KEY` into the `.env` file**

- Modify `src/shurokkha_route/config/agents.yaml` to define your agents
- Modify `src/shurokkha_route/config/tasks.yaml` to define your tasks
- Modify `src/shurokkha_route/crew.py` to add your own logic, tools and specific args
- Modify `src/shurokkha_route/main.py` to add custom inputs for your agents and tasks

## Running the Project

To start the HTTP/SSE server used by the Next.js dashboard, run this from the `ai-service` directory:

```bash
uv run python -m shurokkha_route.server
```

The server listens on `http://127.0.0.1:8787`. Start the Next.js dashboard in a separate terminal from the repository root with `npm run dev`, then open `http://localhost:3000`.

For a direct command-line flow run without the HTTP server, use:

```bash
uv run crewai run
```

This example, unmodified, will run a content creation flow on AI Agents and save the output to `output/post.md`.

## Understanding Your Crew

The latest-ai-flow Crew is composed of multiple AI agents, each with unique roles, goals, and tools. These agents collaborate on a series of tasks, defined in `config/tasks.yaml`, leveraging their collective skills to achieve complex objectives. The `config/agents.yaml` file outlines the capabilities and configurations of each agent in your crew.

## Support

For support, questions, or feedback regarding the {{crew_name}} Crew or crewAI.

- Visit our [documentation](https://docs.crewai.com)
- Reach out to us through our [GitHub repository](https://github.com/joaomdmoura/crewai)
- [Join our Discord](https://discord.com/invite/X4JWnZnxPb)
- [Chat with our docs](https://chatg.pt/DWjSBZn)

Let's create wonders together with the power and simplicity of crewAI.
