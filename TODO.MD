cd geraew-mcp-server && npm install && npm run build   # already done ✓
claude mcp add geraew \
  --env GERAEW_BASE_URL=http://localhost:3000 \
  --env GERAEW_EMAIL=coven688@gmail.com \
  --env GERAEW_PASSWORD=Gomes688@ \
  -- node "$(pwd)/dist/index.js"
