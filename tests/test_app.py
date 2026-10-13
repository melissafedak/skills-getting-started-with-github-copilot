from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

import src.app as app_module


@pytest.fixture
def activities():
    return {
        "Chess Club": {
            "description": "Learn strategies and compete in chess tournaments",
            "schedule": "Fridays, 3:30 PM - 5:00 PM",
            "max_participants": 12,
            "participants": ["current@mergington.edu"],
        },
        "Art Club": {
            "description": "Explore drawing and painting",
            "schedule": "Wednesdays, 3:30 PM - 5:00 PM",
            "max_participants": 18,
            "participants": [],
        },
    }


@pytest.fixture
def client(monkeypatch, activities):
    monkeypatch.setattr(app_module, "activities", activities)
    with TestClient(app_module.app) as test_client:
        yield test_client


def test_get_activities_returns_activity_data(client, activities):
    # Arrange
    expected_activities = activities

    # Act
    response = client.get("/activities")

    # Assert
    assert response.status_code == 200
    assert response.json() == expected_activities


def test_signup_adds_participant_to_activity(client, activities):
    # Arrange
    email = "new@mergington.edu"

    # Act
    response = client.post(
        "/activities/Chess%20Club/signup",
        params={"email": email},
    )

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Signed up {email} for Chess Club"}
    assert activities["Chess Club"]["participants"] == [
        "current@mergington.edu",
        email,
    ]


def test_signup_rejects_duplicate_participant(client):
    # Arrange
    email = "current@mergington.edu"

    # Act
    response = client.post(
        "/activities/Chess%20Club/signup",
        params={"email": email},
    )

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "Student already signed up for this activity"}


def test_concurrent_signup_rejects_duplicate_participant(client, activities):
    email = "new@mergington.edu"

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(
            lambda _: client.post(
                "/activities/Chess%20Club/signup",
                params={"email": email},
            ),
            range(2),
        ))

    assert sorted(response.status_code for response in responses) == [200, 400]
    assert activities["Chess Club"]["participants"].count(email) == 1


def test_signup_returns_not_found_for_unknown_activity(client):
    # Arrange
    activity_name = "Unknown Club"

    # Act
    response = client.post(
        f"/activities/{activity_name}/signup",
        params={"email": "new@mergington.edu"},
    )

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


def test_signup_requires_email(client):
    # Arrange
    activity_path = "/activities/Chess%20Club/signup"

    # Act
    response = client.post(activity_path)

    # Assert
    assert response.status_code == 422


def test_unregister_removes_participant_from_activity(client, activities):
    # Arrange
    email = "current@mergington.edu"

    # Act
    response = client.delete(
        "/activities/Chess%20Club/participants",
        params={"email": email},
    )

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Unregistered {email} from Chess Club"}
    assert activities["Chess Club"]["participants"] == []


def test_unregister_returns_not_found_for_unknown_activity(client):
    # Arrange
    activity_name = "Unknown Club"

    # Act
    response = client.delete(
        f"/activities/{activity_name}/participants",
        params={"email": "student@mergington.edu"},
    )

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


def test_unregister_returns_not_found_for_unenrolled_participant(client):
    # Arrange
    email = "not-enrolled@mergington.edu"

    # Act
    response = client.delete(
        "/activities/Chess%20Club/participants",
        params={"email": email},
    )

    # Assert
    assert response.status_code == 404
    assert response.json() == {
        "detail": "Student is not signed up for this activity"
    }


def test_root_redirects_to_static_app(client):
    # Arrange
    root_path = "/"

    # Act
    response = client.get(root_path, follow_redirects=False)

    # Assert
    assert response.status_code == 307
    assert response.headers["location"] == "/static/index.html"