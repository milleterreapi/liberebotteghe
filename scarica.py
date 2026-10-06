import json, os, urllib.request
U = "https://rvfwfpndvvpdwobkmxus.supabase.co"
K = "sb_publishable_2AIfrhYSt5AqnS0-RAU09Q_DtQabGW8"
req = urllib.request.Request(U + "/rest/v1/botteghe?select=id,data", headers={"apikey": K})
shops = [s for s in json.load(urllib.request.urlopen(req, timeout=30)) if s.get("data", {}).get("nome")]
os.makedirs("foto", exist_ok=True)
json.dump(shops, open("foto/botteghe.json", "w"), ensure_ascii=False, indent=1)
def get(sid, key, v):
    os.makedirs(f"foto/{sid}", exist_ok=True)
    try:
        data = urllib.request.urlopen(f"{U}/storage/v1/object/public/foto/{sid}/{key}.jpg?v={v}", timeout=30).read()
        open(f"foto/{sid}/{key}.jpg", "wb").write(data); print("ok", sid, key, len(data))
    except Exception as e: print("ERR", sid, key, e)
for s in shops:
    d = s["data"]
    if d.get("bannerV"): get(s["id"], "_banner", d["bannerV"])
    if d.get("coverV"): get(s["id"], "_cover", d["coverV"])
    for p in [p for p in d.get("prodotti") or [] if p and p.get("fotoV")][:6]:
        get(s["id"], p["id"], p["fotoV"])
