import re, shutil, os, sys, datetime

HOSTS = r"C:\Windows\System32\drivers\etc\hosts"
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
bak = rf"C:\Windows\System32\drivers\etc\hosts.bak-{stamp}"

targets = {
    "github.com", "api.github.com", "github.dev", "github.githubassets.com",
    "education.github.com", "resources.github.com", "uploads.github.com",
    "archiveprogram.github.com", "raw.github.com", "githubusercontent.com",
    "raw.githubusercontent.com", "camo.githubusercontent.com",
    "cloud.githubusercontent.com", "avatars.githubusercontent.com",
    "avatars0.githubusercontent.com", "avatars1.githubusercontent.com",
    "avatars2.githubusercontent.com", "avatars3.githubusercontent.com",
    "user-images.githubusercontent.com", "objects.githubusercontent.com",
    "private-user-images.githubusercontent.com", "pages.github.com",
    "gist.github.com", "githubapp.com", "github.io", "www.github.io",
}

data = open(HOSTS, "rb").read()
line_end = b"\r\n" if b"\r\n" in data else b"\n"
lines = data.split(line_end)
changed = 0
out = []
for line in lines:
    decoded = line.decode("utf-8", "ignore")
    stripped = decoded.strip()
    if stripped and not stripped.startswith("#"):
        parts = stripped.split()
        if len(parts) >= 2 and parts[0] == "127.0.0.1" and parts[1].lower() in targets:
            out.append(f"# [HERMES-FIX {stamp}] DISABLED ".encode() + line)
            changed += 1
            continue
    out.append(line)

if not changed:
    print("no change needed")
    sys.exit(0)

new = line_end.join(out)
tmp = HOSTS + ".tmp-hermes"
with open(tmp, "wb") as f:
    f.write(new)

try:
    shutil.copyfile(HOSTS, bak)
    with open(tmp, "rb") as f:
        payload = f.read()
    with open(HOSTS, "wb") as f:
        f.write(payload)
    os.remove(tmp)
    print(f"ok: disabled {changed} lines, backup={bak}")
except PermissionError as e:
    print(f"permission denied: {e}; prepared {tmp}")
    sys.exit(3)
