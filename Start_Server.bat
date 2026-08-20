@echo off
echo Starting Physics Game Lab Server...
cd c:\Users\nikhi\Documents\antigravity\optimistic-bell
start http://localhost:8000/login.html
python -m http.server 8000
