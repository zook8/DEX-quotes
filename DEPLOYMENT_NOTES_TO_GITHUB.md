## Deployment Key Information
- Path: .ssh/github_deploy_key
- Created: Sept 08, 2025
- Last updated: Sept 08, 2025
- Purpose: GitHub Actions deployment to VPS
- To regenerate: 
  1. `ssh-keygen -t ed25519 -f .ssh/github_deploy_key -N ""`
  2. Update GitHub Secrets
  3. Add public key to server: `cat .ssh/github_deploy_key.pub >> ~/.ssh/authorized_keys`
