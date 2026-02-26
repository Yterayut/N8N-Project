# Deployment Workflow

This project treats the MacBook Air as the development environment and the Ubuntu 22.04 server (`oneclimate-uat@10.100.1.11`) as production.

## Local Development (Mac)
- Run n8n locally with test credentials (avoid using the production Facebook/LINE tokens concurrently with the server instance).
- Export or save workflow changes to version-controlled files such as `workflow_patch.json`.
- Commit changes to git so history is preserved.

## Deploy to Server
1. Ensure you are on the Mac project root.
2. Run `./scripts/deploy-to-server.sh`.
   - The script stops remote n8n/ngrok, rsyncs the project (excluding secrets), optionally syncs `~/.n8n`, then restarts `start-n8n.sh` on the server.
   - When prompted, answer `y` to sync the local `~/.n8n` directory if you need to push new executions/credentials.
3. Watch remote logs if needed: `ssh oneclimate-uat@10.100.1.11 "tail -f /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/logs/server-start-*.log"`.

## Ground Rules
- Do not edit workflows directly on the server UI unless absolutely necessary.
- If urgent changes are made on the server, export them and merge back into git on the Mac immediately.
- Never run production tokens simultaneously on both the Mac and the server to avoid duplicate Facebook replies.

## Useful Commands
- Stop remote n8n manually:  
  `sshpass -p 'y5?@7Aa#03' ssh oneclimate-uat@10.100.1.11 'pkill -f n8n; pkill -f ngrok'`
- Check running processes:  
  `sshpass -p 'y5?@7Aa#03' ssh oneclimate-uat@10.100.1.11 'pgrep -fl n8n || echo "n8n not running"'`
