import Foundation

/// Base URL + key. Read from the clip's Info.plist so the key isn't hard-coded;
/// falls back to the production gateway. Add `BODEGA_API_BASE_URL` and
/// `BODEGA_API_KEY` to BodegaClip/Info.plist (the web app ships the same client
/// key in its bundle, so this is the same low-trust ingestion key).
enum APIConfig {
    static var baseURL: String {
        (Bundle.main.object(forInfoDictionaryKey: "BODEGA_API_BASE_URL") as? String)
            ?? "https://bodega-gateway-2q60deae.ue.gateway.dev"
    }
    static var apiKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "BODEGA_API_KEY") as? String) ?? ""
    }
}

enum APIClient {
    private static func authed(_ url: URL) -> URLRequest {
        var req = URLRequest(url: url)
        if !APIConfig.apiKey.isEmpty {
            req.setValue(APIConfig.apiKey, forHTTPHeaderField: "x-api-key")
        }
        return req
    }

    /// Pins in the viewport, narrowed by the active filter params.
    static func pins(bbox: Bbox, params: [String]) async throws -> [StorePin] {
        var comps = URLComponents(string: APIConfig.baseURL + "/stores")!
        var items = [URLQueryItem(name: "bbox", value: bbox.query)]
        items.append(contentsOf: params.map { URLQueryItem(name: $0, value: "true") })
        comps.queryItems = items
        let (data, resp) = try await URLSession.shared.data(for: authed(comps.url!))
        try ensureOK(resp)
        return try JSONDecoder().decode([StorePin].self, from: data)
    }

    /// Full record for one store (for the teaser).
    static func detail(_ license: String) async throws -> StoreDetail {
        let encoded = license.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? license
        let url = URL(string: APIConfig.baseURL + "/stores/" + encoded)!
        let (data, resp) = try await URLSession.shared.data(for: authed(url))
        try ensureOK(resp)
        return try JSONDecoder().decode(StoreDetail.self, from: data)
    }

    private static func ensureOK(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
