import asyncio, json, httpx, websockets, pathlib

BASE = "http://127.0.0.1:9099"
WS = "ws://127.0.0.1:9099"
PDF = r"C:\Users\biswa\Downloads\Biswajith-Resume-AI&DataEngineer.pdf"


async def main():
    data = pathlib.Path(PDF).read_bytes()
    print("PDF bytes:", len(data))
    async with httpx.AsyncClient(timeout=120) as c:
        u = {"username": "pdfuser", "password": "pdfpass123"}
        await c.post(f"{BASE}/api/auth/register", json=u)
        r = await c.post(f"{BASE}/api/auth/login", json=u)
        token = r.json()["access_token"]
        files = {"file": ("Biswajith-Resume-AI&DataEngineer.pdf", data, "application/pdf")}
        r = await c.post(f"{BASE}/api/document/upload", files=files,
                         headers={"Authorization": f"Bearer {token}"})
        sid = r.json()["session_id"]
        print("UPLOAD OK", sid)

    async with websockets.connect(f"{WS}/api/document/process/{sid}?token={token}", max_size=None) as ws:
        await ws.send(data)
        while True:
            msg = json.loads(await ws.recv())
            print("PROCESS:", msg.get("stage"), msg.get("message", ""))
            if msg.get("stage") == "ready":
                print("READY KEYS:", list(msg.keys()))
                print("LANG:", repr(msg.get("original_language")), "TRANSLATED:", repr(msg.get("translated")))
                print("SUMMARY LEN:", len(msg.get("summary") or ""))
                print("QUESTIONS:", msg.get("suggested_questions"))
                break
            if msg.get("stage") == "error":
                return

    async with websockets.connect(f"{WS}/api/chat/{sid}?token={token}", max_size=None) as ws:
        await ws.send(json.dumps({"question": "what is this document about"}))
        answer = ""
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=60))
            t = msg.get("type")
            if t == "token":
                answer += msg["content"]
            elif t == "done":
                break
            elif t in ("error", "guard_reject"):
                print("CHAT", t, ":", msg.get("content")); break
        print("ANSWER:", answer[:500])


asyncio.run(main())
