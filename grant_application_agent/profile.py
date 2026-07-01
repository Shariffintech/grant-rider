from pathlib import Path

import yaml

from .models import FounderProfile


def load_profile(path: Path) -> FounderProfile:
    with path.open(encoding="utf-8") as profile_file:
        return FounderProfile.model_validate(yaml.safe_load(profile_file))

