from shurokkha_route.server import (
    _prepare_operational_candidates,
    parse_disaster,
    wants_live_location,
)
from shurokkha_route.strategyPattern.travel import determine_travel_mode


def test_parse_chittagong_cyclone():
    result = parse_disaster(
        "Cyclone in Chittagong, 5 people, normal mobility"
    )

    assert result["disaster_type"] == "Cyclone"
    assert result["location"] == "chittagong"
    assert result["coords"]["lat"] == 22.335
    assert result["coords"]["lng"] == 91.815
    assert result["people"] == 5
    assert result["mobility"] == "normal"


def test_parse_limited_mobility():
    result = parse_disaster(
        "Flood in Sylhet, 2 people with limited mobility"
    )

    assert result["disaster_type"] == "Flood"
    assert result["location"] == "sylhet"
    assert result["people"] == 2
    assert result["mobility"] == "limited"


def test_parse_unknown_location():
    result = parse_disaster(
        "Flood somewhere, 5 people"
    )

    assert result["coords"] is None


def test_live_location_requires_explicit_chat_instruction():
    assert wants_live_location("Earthquake in Mirpur, use my live location") is True
    assert wants_live_location("Earthquake in Mirpur") is False


def test_full_and_closed_shelters_are_removed():
    shelters = [
        {
            "id": "active",
            "coordinates": {"lat": 23.774, "lng": 90.375},
            "status": "Active",
        },
        {
            "id": "full",
            "coordinates": {"lat": 23.774, "lng": 90.375},
            "status": "Full",
        },
        {
            "id": "closed",
            "coordinates": {"lat": 23.774, "lng": 90.375},
            "status": "Closed",
        },
    ]

    routes = []

    candidate_shelters, candidate_routes, candidate_ids = (
        _prepare_operational_candidates(
            shelters=shelters,
            routes=routes,
            user_lat=23.774,
            user_lng=90.375,
            user_location="dhaka",
        )
    )

    assert "active" in candidate_ids
    assert "full" not in candidate_ids
    assert "closed" not in candidate_ids


def test_shelter_inside_disaster_zone_is_removed():
    shelters = [
        {
            "id": "mirpur-crisis",
            "coordinates": {"lat": 23.822, "lng": 90.365},
            "status": "Active",
        },
        {
            "id": "safe-dhaka",
            "coordinates": {"lat": 23.774, "lng": 90.375},
            "status": "Active",
        },
    ]

    candidate_shelters, _, candidate_ids = _prepare_operational_candidates(
        shelters=shelters,
        routes=[],
        user_lat=23.87,
        user_lng=90.39,
        user_location="mirpur",
        disaster_coords={"lat": 23.822, "lng": 90.365},
    )

    assert "mirpur-crisis" not in candidate_ids
    assert "safe-dhaka" in candidate_ids
    assert all(shelter["id"] != "mirpur-crisis" for shelter in candidate_shelters)


def test_far_shelter_is_retained_but_marked_non_local():
    shelters = [
        {
            "id": "far-active",
            "coordinates": {"lat": 24.898, "lng": 91.875},
            "status": "Active",
        }
    ]

    candidate_shelters, _, candidate_ids = (
        _prepare_operational_candidates(
            shelters=shelters,
            routes=[],
            user_lat=22.335,
            user_lng=91.815,
            user_location="chittagong",
        )
    )

    assert "far-active" in candidate_ids
    assert candidate_shelters[0]["within_local_range"] is False


def test_only_relevant_evacuation_route_is_retained():
    shelters = [
        {
            "id": "shel-002",
            "coordinates": {"lat": 23.822, "lng": 90.365},
            "status": "Active",
        }
    ]

    routes = [
        {
            "id": "dhaka-route",
            "routeType": "evacuation",
            "startLocation": "dhaka",
            "destinationShelterId": "shel-002",
            "status": "Safe",
        },
        {
            "id": "sylhet-route",
            "routeType": "evacuation",
            "startLocation": "sylhet",
            "destinationShelterId": "shel-002",
            "status": "Safe",
        },
        {
            "id": "logistics-route",
            "routeType": "logistics",
            "startLocation": "sylhet",
            "destinationShelterId": "shel-002",
            "status": "Safe",
        },
    ]

    _, candidate_routes, _ = _prepare_operational_candidates(
        shelters=shelters,
        routes=routes,
        user_lat=24.898,
        user_lng=91.875,
        user_location="sylhet",
    )

    route_ids = [route["id"] for route in candidate_routes]

    assert "sylhet-route" in route_ids
    assert "dhaka-route" not in route_ids
    assert "logistics-route" not in route_ids


def test_flooded_route_is_removed():
    shelters = [
        {
            "id": "shel-004",
            "coordinates": {"lat": 24.898, "lng": 91.875},
            "status": "At Risk",
        }
    ]

    routes = [
        {
            "id": "sylhet-flooded",
            "routeType": "evacuation",
            "startLocation": "sylhet",
            "destinationShelterId": "shel-004",
            "status": "Flooded",
        }
    ]

    _, candidate_routes, _ = _prepare_operational_candidates(
        shelters=shelters,
        routes=routes,
        user_lat=24.898,
        user_lng=91.875,
        user_location="sylhet",
    )

    assert candidate_routes == []
    
def test_local_travel_strategy():
    assert determine_travel_mode(10, "normal") == "local"


def test_long_distance_strategy():
    assert determine_travel_mode(190, "limited") == "organized_transport"