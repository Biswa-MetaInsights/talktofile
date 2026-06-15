import asyncio, json, httpx, websockets

BASE = "http://127.0.0.1:9099"
WS = "ws://127.0.0.1:9099"


async def main():
    async with httpx.AsyncClient(timeout=60) as c:
        # register (ignore if exists) then login
        u = {"username": "e2euser", "password": "e2epass123"}
        await c.post(f"{BASE}/api/auth/register", json=u)
        r = await c.post(f"{BASE}/api/auth/login", json=u)
        token = r.json()["access_token"]
        print("AUTH OK")

        # upload a tiny doc
        files = {"file": ("note.txt", b"The Eiffel Tower is 330 meters tall and located in Paris, France. It was completed in 1889.", "text/plain")}
        r = await c.post(f"{BASE}/api/document/upload", files=files,
                         headers={"Authorization": f"Bearer {token}"})
        sid = r.json()["session_id"]
        print("UPLOAD OK", sid)

    # process via WS
    async with websockets.connect(f"{WS}/api/document/process/{sid}?token={token}", max_size=None) as ws:
        await ws.send(b"The Eiffel Tower is 330 meters tall and located in Paris, France. It was completed in 1889.")
        while True:
            msg = json.loads(await ws.recv())
            print("PROCESS:", msg.get("stage"), msg.get("message", ""))
            if msg.get("stage") in ("ready", "error"):
                break

    # chat via WS
    async with websockets.connect(f"{WS}/api/chat/{sid}?token={token}", max_size=None) as ws:
        await ws.send(json.dumps({"question": "How tall is the Eiffel Tower?"}))
        answer = ""
        while True:
            msg = json.loads(await ws.recv())
            t = msg.get("type")
            if t == "token":
                answer += msg["content"]
            elif t == "done":
                break
            elif t in ("error", "guard_reject"):
                print("CHAT", t, ":", msg.get("content"))
                break
        print("ANSWER:", answer)


asyncio.run(main())
