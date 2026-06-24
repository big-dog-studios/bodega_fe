import AppIntents
import CoreLocation
import Foundation

// MARK: - API

/// Base URL + key for the read API. Mirrors the App Clip's APIConfig — read from
/// Info.plist (BODEGA_API_BASE_URL / BODEGA_API_KEY) so the key isn't hard-coded,
/// with the production gateway as a fallback. Same low-trust client ingestion key
/// the web bundle ships.
private enum IntentAPI {
    static var baseURL: String {
        (Bundle.main.object(forInfoDictionaryKey: "BODEGA_API_BASE_URL") as? String)
            ?? "https://bodega-gateway-2q60deae.ue.gateway.dev"
    }
    static var apiKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "BODEGA_API_KEY") as? String) ?? ""
    }

    /// One row from `GET /stores/nearest` — the light pin plus its distance.
    struct NearbyStore: Decodable {
        let license_number: String
        let dba: String
        let lat: Double
        let lon: Double
        let distance_m: Double
    }

    /// Closest stores to a point, optionally narrowed to a single feature and to
    /// currently-open. Server returns them already sorted by `distance_m` ascending.
    static func nearest(
        lat: Double,
        lon: Double,
        param: String?,
        openOnly: Bool,
        limit: Int
    ) async throws -> [NearbyStore] {
        var comps = URLComponents(string: baseURL + "/stores/nearest")!
        var items = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let param { items.append(URLQueryItem(name: param, value: "true")) }
        if openOnly { items.append(URLQueryItem(name: "is_open", value: "true")) }
        comps.queryItems = items

        var req = URLRequest(url: comps.url!)
        req.timeoutInterval = 10  // Siri's budget is short; don't ride the 60s default.
        if !apiKey.isEmpty { req.setValue(apiKey, forHTTPHeaderField: "x-api-key") }
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode([NearbyStore].self, from: data)
    }
}

// MARK: - One-shot location

/// Fetches a single location fix with async/await. Held on the stack for the
/// duration of the await so it (and its delegate callbacks) stay alive. Relies on
/// the When-In-Use permission the app already requests; if it's not granted we
/// surface a friendly error rather than prompting (an intent can't show the prompt).
@available(iOS 16.0, *)
private final class OneShotLocation: NSObject, CLLocationManagerDelegate {
    enum LocationError: Error { case denied, unavailable }

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    func current() async throws -> CLLocationCoordinate2D {
        // Prefer a recent cached fix: instant, and reliable from a background intent
        // where a fresh requestLocation() may never deliver an update *or* an error.
        if let cached = manager.location, -cached.timestamp.timeIntervalSinceNow < 600 {
            return cached.coordinate
        }
        return try await withCheckedThrowingContinuation { cont in
            continuation = cont
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            // Hard safety net — never let the intent hang on a fix that never arrives.
            // Whichever resumes first wins; finish() ignores the rest.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
                self?.finish(.failure(LocationError.unavailable))
            }
            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                manager.requestLocation()
            default:
                // Not authorized (or undetermined): an inline intent can't show the
                // permission prompt, so fail fast and point them at the app.
                finish(.failure(LocationError.denied))
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coord = locations.first?.coordinate else {
            finish(.failure(LocationError.unavailable))
            return
        }
        finish(.success(coord))
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish(.failure(error))
    }

    private func finish(_ result: Result<CLLocationCoordinate2D, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
}

/// "622 m" → "0.4 miles" / "150 feet". US-friendly, spoken-friendly.
private func formatDistance(_ meters: Double) -> String {
    let miles = meters / 1609.344
    if miles < 0.1 {
        let feet = Int((meters * 3.28084 / 10).rounded()) * 10
        return "\(feet) feet"
    }
    return String(format: "%.1f miles", miles)
}

// MARK: - Feature enum

/// The bodega features Siri can ask about. Each maps to the API query param and
/// the in-app filter key (both ported from filters.ts), plus a spoken fragment.
@available(iOS 16.0, *)
enum BodegaFeature: String, AppEnum {
    case hotFood, beerWine, snap, lottery, tobacco, atm, plantBased, cat

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Feature")
    static var caseDisplayRepresentations: [BodegaFeature: DisplayRepresentation] = [
        .hotFood: "Hot food",
        .beerWine: "Beer & wine",
        .snap: "SNAP / EBT",
        .lottery: "Lottery",
        .tobacco: "Tobacco",
        .atm: "ATM",
        .plantBased: "Plant-based",
        .cat: "Cat",
    ]

    /// `GET /stores` query param (matches StoreFilters in types.ts).
    var param: String {
        switch self {
        case .hotFood: return "has_prepared_food"
        case .beerWine: return "has_alcohol"
        case .snap: return "has_snap"
        case .lottery: return "has_lottery"
        case .tobacco: return "has_tobacco"
        case .atm: return "has_atm"
        case .plantBased: return "has_plant_based"
        case .cat: return "has_cat"
        }
    }

    /// In-app filter key for the `filter:{key}` deep link (matches FILTERS[].key).
    var filterKey: String {
        switch self {
        case .hotFood: return "preparedFood"
        case .beerWine: return "alcohol"
        case .snap: return "snap"
        case .lottery: return "lottery"
        case .tobacco: return "tobacco"
        case .atm: return "atm"
        case .plantBased: return "plantBased"
        case .cat: return "cat"
        }
    }

    /// Natural fragment for spoken dialog, e.g. "…bodega with hot food".
    var spoken: String {
        switch self {
        case .hotFood: return "hot food"
        case .beerWine: return "beer and wine"
        case .snap: return "SNAP or EBT"
        case .lottery: return "lottery"
        case .tobacco: return "tobacco"
        case .atm: return "an ATM"
        case .plantBased: return "plant-based food"
        case .cat: return "a cat"
        }
    }
}

// MARK: - Intents

/// "Hey Siri, find the nearest bodega with hot food" — answers inline (no app
/// open). Prefers an open store; if none are open, falls back to the nearest
/// regardless and says so.
@available(iOS 16.0, *)
struct FindNearestBodegaIntent: AppIntent {
    static var title: LocalizedStringResource = "Find the Nearest Bodega"
    static var description = IntentDescription("Finds the closest bodega with the feature you ask for.")
    static var openAppWhenRun = false

    @Parameter(title: "Feature")
    var feature: BodegaFeature

    static var parameterSummary: some ParameterSummary {
        Summary("Find the nearest bodega with \(\.$feature)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let coord: CLLocationCoordinate2D
        do {
            let locator = OneShotLocation()
            coord = try await locator.current()
        } catch {
            return .result(dialog: "I need location access to find bodegas near you. Open Bodega Finder to turn it on.")
        }

        // Open stores only — never send someone to a closed bodega.
        let results = (try? await IntentAPI.nearest(
            lat: coord.latitude, lon: coord.longitude, param: feature.param, openOnly: true, limit: 1
        )) ?? []

        guard let store = results.first else {
            return .result(dialog: "I couldn't find an open bodega with \(feature.spoken) near you right now.")
        }

        let name = store.dba.capitalized
        let distance = formatDistance(store.distance_m)
        return .result(dialog: "The nearest open bodega with \(feature.spoken) is \(name), about \(distance) away.")
    }
}

/// "Open bodegas near me" — just launches the app, which auto-centers on the user.
@available(iOS 16.0, *)
struct OpenMapNearMeIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Bodegas Near Me"
    static var description = IntentDescription("Opens the map centered on your location.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        .result()
    }
}

/// "Show bodegas with an ATM" — opens the app and applies that filter via the
/// shared deep-link bridge (`filter:{key}`, handled by DeepLinkRouter.tsx).
@available(iOS 16.0, *)
struct ShowBodegasWithIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Bodegas With a Feature"
    static var description = IntentDescription("Opens the map filtered to bodegas with a feature.")
    static var openAppWhenRun = true

    @Parameter(title: "Feature")
    var feature: BodegaFeature

    static var parameterSummary: some ParameterSummary {
        Summary("Show bodegas with \(\.$feature)")
    }

    func perform() async throws -> some IntentResult {
        AppRouterPlugin.open("filter:\(feature.filterKey)")
        return .result()
    }
}

// MARK: - Shortcuts

/// Registers the Siri phrases. Every phrase must contain `\(.applicationName)`.
@available(iOS 16.0, *)
struct BodegaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: FindNearestBodegaIntent(),
            phrases: [
                "Find the nearest bodega with \(\.$feature) in \(.applicationName)",
                "Nearest bodega with \(\.$feature) in \(.applicationName)",
                "Closest bodega with \(\.$feature) in \(.applicationName)",
            ],
            shortTitle: "Nearest Bodega",
            systemImageName: "mappin.and.ellipse"
        )
        AppShortcut(
            intent: OpenMapNearMeIntent(),
            phrases: [
                "Open bodegas near me in \(.applicationName)",
                "Show bodegas near me in \(.applicationName)",
            ],
            shortTitle: "Bodegas Near Me",
            systemImageName: "map"
        )
        AppShortcut(
            intent: ShowBodegasWithIntent(),
            phrases: [
                "Show bodegas with \(\.$feature) in \(.applicationName)",
                "Find bodegas with \(\.$feature) in \(.applicationName)",
            ],
            shortTitle: "Bodegas by Feature",
            systemImageName: "line.3.horizontal.decrease.circle"
        )
    }
}
