# Urban Shadows MU*

An **Urban Shadows 2e** tabletop RPG server built on [UrsaMU](https://jsr.io/@ursamu/ursamu) — a modern MU* engine for Deno — featuring an agentic AI Game Master powered by LangGraph and Google Gemini Flash.

## Features

- **AI Game Master** — LangGraph + Gemini Flash GM that narrates poses, adjudicates moves, answers oracle questions, and generates scene-set drafts for staff review
- **Full Urban Shadows 2e rules** — playbooks, moves, stats, XP tracking, advancement, debts, circles, factions, and NPCs
- **Session system** — session lifecycle management with end-of-session XP questions
- **Downtime system** — players submit downtime actions; staff resolves them with narrative
- **Jobs system** — staff-managed job tickets with player-visible comments
- **Scene system** — scene creation, poses, and GM-assisted scene narration
- **Tracker** — harm, stress, and condition tracking per character
- **REST API** — full HTTP API for all game systems
- **WebSocket + Telnet** — dual connection support via UrsaMU

## Requirements

- [Deno](https://deno.com) v2.x
- A [Google Gemini API key](https://aistudio.google.com/) (for the AI GM)

## Setup

```bash
# Clone the repo
git clone https://github.com/UrsaMU/example.git urban-shadows
cd urban-shadows

# Copy and edit config
cp config/config.example.json config/config.json

# Set your Gemini API key
echo "GOOGLE_API_KEY=your-key-here" > .env

# Start the server
deno task start
```

## Configuration

Edit `config/config.json` to set your server name, port, and other options. See `deno task config` for an interactive setup wizard.

## GM Commands

| Command | Description |
|---|---|
| `+gm/go` | Trigger GM narration for the current round |
| `+gm/oracle <question>=<probability>` | Ask the GM oracle a yes/no question |
| `+gm/move <move>=<total>` | Have the GM adjudicate a move result |
| `+gm/scene/publish <text>` | [Staff] Broadcast a GM scene narration draft |
| `+gm/config/mode <auto\|hybrid>` | [Staff] Set GM adjudication mode |
| `+gm/config/model <model>` | [Staff] Set the Gemini model |

## Development

```bash
deno task server    # Run server directly
deno task test      # Run tests
deno lint           # Lint
deno fmt            # Format
deno check src/main.ts  # Type-check
```

## License

MIT — Copyright (c) 2026 Lemuel Canady, Jr.
