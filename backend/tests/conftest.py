import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_service import data_service
from . import fixture_data


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def frame(tmp_path_factory, client):
    """Load the synthetic fixture into the data service for analytics tests."""
    path = tmp_path_factory.mktemp("fx") / "synthetic.csv"
    df = fixture_data.write_csv(path)
    data_service.load(path)
    assert data_service.loaded, data_service.load_error
    yield df
    data_service.loaded = False
