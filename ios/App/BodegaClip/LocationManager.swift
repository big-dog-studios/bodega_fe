import Combine
import CoreLocation

/// Equatable coordinate so SwiftUI `onChange` can observe location fixes
/// (CLLocationCoordinate2D isn't Equatable).
struct Coord: Equatable {
    let lat: Double
    let lon: Double
    var clCoordinate: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }
}

/// Thin CLLocationManager wrapper. Requests "when in use" on demand (a user tap),
/// not at launch — App Clips support Core Location the same as a full app.
final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    @Published var coord: Coord?
    @Published var authorization: CLAuthorizationStatus = .notDetermined

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        authorization = manager.authorizationStatus
    }

    /// Ask for permission (and a fix once granted). Safe to call repeatedly.
    func request() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let c = locations.last?.coordinate else { return }
        coord = Coord(lat: c.latitude, lon: c.longitude)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Ignore — the map just stays where it is.
    }
}
