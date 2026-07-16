#!/bin/bash
set -e
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi
cd /var/www/sifrah-server
git pull origin master
npm run build
cd cierre_engine
./build-linux.sh
cd ..
pm2 restart all
pm2 status
git log -1 --oneline
