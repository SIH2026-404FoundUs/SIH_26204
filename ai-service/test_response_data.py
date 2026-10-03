from app.main import _response_data


def test_envelope_is_unwrapped():
    assert _response_data({"ok": True, "data": [1, 2], "meta": {}}) == [1, 2]


def test_bare_list_passes_through():
    # /api/v1/businesses/search and /api/v1/alerts return bare arrays
    assert _response_data([{"name": "x"}]) == [{"name": "x"}]
    assert _response_data([]) == []


def test_failure_and_non_json_are_dropped():
    assert _response_data({"ok": False, "error": "boom"}) is None
    assert _response_data(None) is None
