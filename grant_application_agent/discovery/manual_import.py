from ..models import GrantDetails


def manual_opportunity(url: str, title: str = "Manual grant URL") -> GrantDetails:
    return GrantDetails(title=title, url=url, source="manual_url")

