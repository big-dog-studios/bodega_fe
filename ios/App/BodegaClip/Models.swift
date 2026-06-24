import CoreLocation
import Foundation

/// Light pin from `GET /stores?bbox=…` — matches StorePin in types.ts.
struct StorePin: Decodable, Identifiable {
    let license_number: String
    let dba: String
    let lat: Double
    let lon: Double

    var id: String { license_number }
    var coordinate: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }
}

/// Subset of `GET /stores/{license}` we need for the teaser. Extra JSON keys are
/// ignored by Codable, so this only declares the fields the clip renders.
struct StoreDetail: Decodable {
    let dba: String
    let estab_type: String?
    let house: String?
    let street: String?
    let city: String?
    let county: String?
    let zip: String?
    let has_snap: Bool?
    let has_tobacco: Bool?
    let has_lottery: Bool?
    let has_quick_draw: Bool?
    let has_prepared_food: Bool?
    let has_wic: Bool?
    let has_atm: Bool?
    let has_cat: Bool?
    let takeout: Bool?
    let delivery: Bool?
    let alc_class: Int?
}

/// Viewport in API order: [west, south, east, north] = lon,lat first.
struct Bbox {
    let west: Double
    let south: Double
    let east: Double
    let north: Double

    var query: String { "\(west),\(south),\(east),\(north)" }
}

/// One feature filter chip → a `GET /stores` query param. Ported from filters.ts.
struct BodegaFilter: Identifiable, Hashable {
    let key: String
    let label: String
    let icon: String
    let param: String
    var id: String { key }
}

enum Filters {
    static let all: [BodegaFilter] = [
        .init(key: "openNow", label: "OPEN NOW", icon: "🕑", param: "is_open"),
        .init(key: "preparedFood", label: "HOT FOOD", icon: "🥪", param: "has_prepared_food"),
        .init(key: "lottery", label: "LOTTERY", icon: "🎟", param: "has_lottery"),
        .init(key: "alcohol", label: "BEER & WINE", icon: "🍺", param: "has_alcohol"),
        .init(key: "tobacco", label: "TOBACCO", icon: "🚬", param: "has_tobacco"),
        .init(key: "cat", label: "CAT", icon: "🐈", param: "has_cat"),
        .init(key: "atm", label: "ATM", icon: "🏧", param: "has_atm"),
        .init(key: "delivery", label: "DELIVERY", icon: "🛵", param: "delivery"),
        .init(key: "takeout", label: "TAKEOUT", icon: "🥡", param: "takeout"),
        .init(key: "snap", label: "SNAP/EBT", icon: "🛒", param: "has_snap"),
        .init(key: "wic", label: "WIC", icon: "🍼", param: "has_wic"),
        .init(key: "quickDraw", label: "QUICK DRAW", icon: "🎰", param: "has_quick_draw"),
        .init(key: "products", label: "HAS MENU", icon: "🛍️", param: "has_products"),
    ]
}
