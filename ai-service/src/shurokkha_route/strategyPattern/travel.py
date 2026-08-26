from abc import ABC, abstractmethod


class TravelModeStrategy(ABC):
    """Strategy for determining an appropriate evacuation travel mode."""

    @abstractmethod
    def determine(self, distance_km: float, mobility: str) -> str:
        raise NotImplementedError


class LocalTravelStrategy(TravelModeStrategy):
    """Used for nearby evacuation destinations."""

    def determine(self, distance_km: float, mobility: str) -> str:
        if mobility == "limited":
            return "local_vehicle"
        return "local"


class OrganizedTransportStrategy(TravelModeStrategy):
    """Used when the destination is too far for ordinary local evacuation."""

    def determine(self, distance_km: float, mobility: str) -> str:
        return "organized_transport"


class TravelModeContext:
    """Selects the appropriate strategy based on operational conditions."""

    def __init__(self, strategy: TravelModeStrategy):
        self.strategy = strategy

    def determine(self, distance_km: float, mobility: str) -> str:
        return self.strategy.determine(distance_km, mobility)


def determine_travel_mode(distance_km: float, mobility: str) -> str:
    """
    Select a travel strategy using deterministic operational thresholds.

    Local evacuation:
        <= 40 km

    Beyond local range:
        organized transport
    """
    if distance_km <= 40:
        strategy = LocalTravelStrategy()
    else:
        strategy = OrganizedTransportStrategy()

    context = TravelModeContext(strategy)
    return context.determine(distance_km, mobility)