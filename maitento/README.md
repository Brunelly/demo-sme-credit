# The app's Maitento definitions

The agents and interactions the app's AI features run. The platform deploys this folder to the app's Maitento
namespace (`MAITENTO_NAMESPACE`) on every deploy, before the new version starts.

| File | What it is | Used by |
|---|---|---|
| `agents/assistant.mtr` | the assistant agent and its model | `ask-assistant` |
| `interactions/one-shot/ask-assistant.mtr` | one question in, a typed answer out | `POST /api/assistant/ask` |
| `prompts/*.md` | the agent's instructions and the interaction's task | |
| `json/assistant-answer.json` | the answer's shape | the API checks it |

`.mtr` is Maitento's own format: read `.agents/skills/maitento/SKILL.md` before changing anything here, and run
`npm run check:maitento` (offline, no key) after every change. `npm test` runs it too.

A file's name is the definition's name, so `ask-assistant.mtr` is the interaction `ask-assistant` that the API runs
by name. A deploy never deletes: removing a file leaves the definition in Maitento.
