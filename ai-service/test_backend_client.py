from app.services import backend_client as bc


class _Resp:
    def json(self):
        return {"ok": True}


def _capture(monkeypatch):
    seen = {}

    def fake(method, url, timeout, headers, **kwargs):
        seen.update(method=method, url=url, timeout=timeout, kwargs=kwargs)
        return _Resp()

    monkeypatch.setattr(bc.requests, "request", fake)
    return seen


def test_default_timeout_is_5s(monkeypatch):
    seen = _capture(monkeypatch)
    bc.get("/api/x", {"a": 1})
    assert seen["timeout"] == 5 and seen["kwargs"] == {"params": {"a": 1}}


def test_post_timeout_can_be_raised_per_call(monkeypatch):
    seen = _capture(monkeypatch)
    bc.post("/api/alternatives", {"k": "v"}, timeout=60)
    assert seen["timeout"] == 60 and seen["kwargs"] == {"json": {"k": "v"}}
