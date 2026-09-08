# ai-service/app/onboarding/test_load_model_cuda_fallback.py
#
# Real, automated test (unittest, stdlib only -- no pytest installed in
# this repo, and this deliberately avoids adding a new dependency just for
# one test file). NOT a manual demo script like ai-service/test_agent.py.
#
# Named explicitly (not "test.py") to avoid the exact problem hit on the
# Node side with substitution/test.js: a same-named manual script that a
# test runner's default discovery pattern picked up and ran for real.
#
# _load_model() runs unconditionally at module import time
# (`_model = _load_model()`, transcribe.py's own module-level statement),
# with no dependency-injection seam -- so isolating it from the real,
# heavy distil-large-v3 model download/load requires faking
# `faster_whisper`/`ctranslate2` in sys.modules BEFORE
# app.onboarding.transcribe is ever imported, not patching them after the
# fact (by then the real model load has already run).
#
# Run directly: ai-service/venv/Scripts/python.exe -m unittest
#   app.onboarding.test_load_model_cuda_fallback -v
# (from the ai-service/ directory, so `app` resolves as a package).

import sys
import types
import unittest
from unittest.mock import MagicMock

# Deliberately NOT unittest.mock.patch.dict: patch.dict snapshots the
# *entire* sys.modules dict on __enter__ and, on __exit__, clears it
# completely and restores from that snapshot -- not just the specific keys
# it was given. Since importing app.onboarding.transcribe pulls in numpy
# (and its C-extension submodules) DURING the with-block, those never
# make it into the pre-entry snapshot, so patch.dict's exit wipes numpy
# out of sys.modules entirely. The next test then tries to re-run
# numpy/__init__.py from scratch, and numpy's C extension genuinely cannot
# be re-initialized a second time in the same process: "ImportError:
# cannot load module more than once per process." Confirmed by direct
# A/B comparison before writing this -- plain manual sys.modules
# assignment/deletion (same net effect on the two keys we care about, no
# full-dict clear+restore) does not trigger this; patch.dict does, on the
# second test every time. Managing sys.modules by hand below avoids it.


def install_fake_whisper_backend(cuda_device_count, cuda_transcribe_error=None):
    """
    Installs fake `ctranslate2`/`faster_whisper` modules into sys.modules.
    Returns (fake_ctranslate2, fake_faster_whisper, constructed_devices) --
    `constructed_devices` records, in order, the `device` argument every
    WhisperModel(...) construction was called with, so a test can assert
    exactly what _load_model() tried, not just what it ended up returning.
    """
    fake_ctranslate2 = types.ModuleType("ctranslate2")
    fake_ctranslate2.get_cuda_device_count = MagicMock(return_value=cuda_device_count)

    constructed_devices = []

    class FakeWhisperModel:
        def __init__(self, model_name, device, compute_type):
            constructed_devices.append(device)
            self.model_name = model_name
            self.device = device
            self.compute_type = compute_type

        def transcribe(self, audio):
            # Simulates the real, confirmed production failure: construction
            # succeeds, but the first actual compute call (here, the dummy
            # probe transcription) is where a broken CUDA runtime surfaces.
            if self.device == "cuda" and cuda_transcribe_error is not None:
                raise cuda_transcribe_error
            info = MagicMock(language="en")
            return iter([]), info

    fake_faster_whisper = types.ModuleType("faster_whisper")
    fake_faster_whisper.WhisperModel = FakeWhisperModel

    return fake_ctranslate2, fake_faster_whisper, constructed_devices


class LoadModelCudaProbeTest(unittest.TestCase):
    MODULE_NAME = "app.onboarding.transcribe"

    def setUp(self):
        # Clean slate: drop any cached import from a previous test in this
        # class (or a previous real run) so each test's sys.modules fakes
        # actually take effect on the next `import`.
        for name in (self.MODULE_NAME, "faster_whisper", "ctranslate2"):
            sys.modules.pop(name, None)

    def tearDown(self):
        # Remove only the two keys we ourselves manage -- leave numpy (and
        # everything else genuinely imported along the way) alone. See the
        # module docstring for why patch.dict is not used for this.
        for name in ("faster_whisper", "ctranslate2"):
            sys.modules.pop(name, None)
        sys.modules.pop(self.MODULE_NAME, None)

    def _import_transcribe_with_fakes(self, fake_ctranslate2, fake_faster_whisper):
        sys.modules["ctranslate2"] = fake_ctranslate2
        sys.modules["faster_whisper"] = fake_faster_whisper
        import app.onboarding.transcribe as transcribe_module

        return transcribe_module

    def test_cuda_construction_succeeds_but_dummy_probe_throws_falls_back_to_cpu(self):
        # This is the exact confirmed production scenario: CUDA device
        # detected, WhisperModel(..., device="cuda") constructs without
        # error, and only the first real compute call fails with the
        # missing-cuBLAS-DLL error.
        fake_ct2, fake_fw, constructed_devices = install_fake_whisper_backend(
            cuda_device_count=1,
            cuda_transcribe_error=OSError("Library cublas64_12.dll is not found or cannot be loaded"),
        )

        transcribe_module = self._import_transcribe_with_fakes(fake_ct2, fake_fw)

        # Both attempts happened, in order: CUDA first (and its probe
        # failed), then the CPU fallback construction.
        self.assertEqual(constructed_devices, ["cuda", "cpu"])
        # And the model actually returned/used by the module is the CPU
        # one, not the broken CUDA candidate.
        self.assertEqual(transcribe_module._model.device, "cpu")
        self.assertEqual(transcribe_module._model.compute_type, "int8")

    def test_cuda_construction_and_probe_both_succeed_stays_on_cuda(self):
        # Control case: a genuinely working CUDA setup must not be
        # penalized by the new probe -- it should still end up on CUDA.
        fake_ct2, fake_fw, constructed_devices = install_fake_whisper_backend(
            cuda_device_count=1,
            cuda_transcribe_error=None,
        )

        transcribe_module = self._import_transcribe_with_fakes(fake_ct2, fake_fw)

        self.assertEqual(constructed_devices, ["cuda"])
        self.assertEqual(transcribe_module._model.device, "cuda")
        self.assertEqual(transcribe_module._model.compute_type, "float16")

    def test_no_cuda_devices_goes_straight_to_cpu_without_attempting_a_probe(self):
        # get_cuda_device_count() == 0: the `if` guard around the whole
        # CUDA branch is never entered, so nothing is even constructed on
        # "cuda" to probe in the first place.
        fake_ct2, fake_fw, constructed_devices = install_fake_whisper_backend(cuda_device_count=0)

        transcribe_module = self._import_transcribe_with_fakes(fake_ct2, fake_fw)

        self.assertEqual(constructed_devices, ["cpu"])
        self.assertEqual(transcribe_module._model.device, "cpu")


if __name__ == "__main__":
    unittest.main()
