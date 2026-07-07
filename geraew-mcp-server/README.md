# GeraEW MCP Server

An [MCP](https://modelcontextprotocol.io) server that lets **Claude Code** (or any MCP
client) generate images and videos through the GeraEW AI API — text-to-image,
image editing, text/image-to-video, face swap, and motion control — and download
the finished files straight to disk.

## Tools

| Tool | What it does |
|---|---|
| `geraew_generate_image` | Text-to-image, or image-to-image when `input_images` (local paths) are given |
| `geraew_generate_video_from_text` | Text-to-video (Veo) |
| `geraew_generate_video_from_image` | Animate a still image into a video (first/last frame) |
| `geraew_face_swap` | Swap a source face onto a target scene |
| `geraew_motion_control` | Replace the subject of a reference video with an image (motion transfer) |
| `geraew_get_generation` | Poll a job by id and/or (re)download its outputs |
| `geraew_list_generations` | List gallery history with filters |
| `geraew_credit_balance` | Check plan + bonus credit balance |

Every generation tool accepts:
- `wait` (default `true`) — block until the job finishes and **download outputs locally**.
- `download_dir` — where to save the files (defaults to `GERAEW_DOWNLOAD_DIR` or cwd).
- `max_wait_seconds` — raise this for long video jobs, or set `wait=false` and poll with `geraew_get_generation`.

Inputs are given as **local file paths**; the server base64-encodes them for the API.
Outputs are returned as local file paths so Claude Code can open them directly.

## Setup

```bash
cd geraew-mcp-server
npm install
npm run build
```

Configure credentials (see `.env.example`): either `GERAEW_EMAIL` + `GERAEW_PASSWORD`
(the server logs in and refreshes the JWT automatically) or a pre-issued
`GERAEW_ACCESS_TOKEN`. Point `GERAEW_BASE_URL` at your API (default
`http://localhost:3000`).

## Register with Claude Code

From the repo root:

```bash
claude mcp add geraew \
  --env GERAEW_BASE_URL=http://localhost:3000 \
  --env GERAEW_EMAIL=you@example.com \
  --env GERAEW_PASSWORD=your-password \
  -- node /absolute/path/to/geraew-mcp-server/dist/index.js
```

Or add it to a project-scoped `.mcp.json`:

```json
{
  "mcpServers": {
    "geraew": {
      "command": "node",
      "args": ["/absolute/path/to/geraew-mcp-server/dist/index.js"],
      "env": {
        "GERAEW_BASE_URL": "http://localhost:3000",
        "GERAEW_EMAIL": "you@example.com",
        "GERAEW_PASSWORD": "your-password"
      }
    }
  }
}
```

Then in Claude Code:

> "Generate a 9:16 image of a cyberpunk city at sunset and save it to ./out"
>
> "Animate ./out/city.png into an 8s 1080p video with gentle camera motion"

## Notes

- Requires the GeraEW API to be reachable and the account to have credits.
- Failed generations auto-refund credits (per the GeraEW API); the tool reports the error.
- Video jobs can take minutes — the default wait window is 8 minutes.
